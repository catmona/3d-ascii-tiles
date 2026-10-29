import { Camera } from './Camera'
import {
    DETAIL_CHARS,
    DETAIL_COLORS,
    DETAIL_LOOKS,
    FLOWER_CHAR,
    FLOWER_COLORS,
} from './details'
import { BILLBOARD_GLSL, GLYPH_FRAG, SKY_GLSL } from './glsl'
import { Vector3 } from '../core/Types'
import { Lighting, MAX_LIGHTS, MOTE_CHARS } from '../map/Lighting'
import { FLORA_CHARS, SUN, grow } from '../map/flora'
import { Detail, Glyph, Plant, Tile } from '../map/Tile'
import { TileMap } from '../map/TileMap'
import { hash2 } from '../utils/Math'
import { Signal } from '../utils/Signal'
import createREGL from 'regl'

// A glyph that moves every frame (player, enemies), unlike the static map
export type Sprite = Glyph & { position: Vector3 }

// Per-glyph instance layout: world xyz, atlas uv, rgb, shade, effect, size
const FLOATS_PER_GLYPH = 11
const STRIDE = FLOATS_PER_GLYPH * 4
const MAX_SPRITES = 1024
const SPRITE_SIZE = 1.4
const RIPPLE = 1
const GLOW = 2
const BLINK = 3 // glows, but keeps closing

// Every tile with loose detail (grass, gravel, foam...) gets up to this many small
// glyphs. They're generated on the GPU from the tile and a blade number, so the
// scatter costs one detail record per tile plus a byte per blade
const BLADES = 8
const DETAIL_FLOATS = 6 // x, y, elevation, light, kind, density
const DETAIL_STRIDE = DETAIL_FLOATS * 4

// Far chunks get fewer blades per tile: they'd be sub-pixel anyway
const DETAIL_LODS = [
    // Just two levels: every change of level splits a draw, and up close those extra
    // draws cost more than the thinning saves
    { blades: 8, within: 150 },
    { blades: 2, within: Infinity },
]

// The map is stored chunk by chunk so a run of neighbouring chunks is one draw call,
// and chunks outside the view are never sent at all
const CHUNK = 32

// Power of two, so mipmap levels never blend one glyph into the next
const ATLAS_CELL = 128

// Dusk palette: a twilight sky, a soft slate behind the ground, and distant land
// fading toward the horizon
type RGB = [number, number, number]
const ZENITH: RGB = [0.07, 0.1, 0.21]
const HORIZON: RGB = [0.32, 0.36, 0.5]
const HORIZON_GLOW: RGB = [0.24, 0.15, 0.11] // warm band right on the horizon
const BACKDROP: RGB = [0.085, 0.12, 0.13] // behind the ground when looking down

const STATS_INTERVAL = 0.25 // seconds between HUD updates

const CORNERS = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
]
const QUAD = [0, 1, 2, 0, 2, 3]

type DrawProps = { buffer: createREGL.Buffer; first: number; count: number }
type DetailProps = { first: number; count: number; lod: number } // in detail tiles

// A run of neighbouring visible chunks in one row, drawn together. Detail runs also
// share a detail level.
type Run = { first: number; last: number; lod: number }

// Everything the shader needs from the camera, recomputed once per frame
type FrameUniforms = {
    eye: number[]
    right: number[]
    up: number[]
    forward: number[]
    focal: number // 1 / tan(fov / 2)
    aspect: number
    fogStart: number
    fogRange: number
    time: number
}

class GlyphBuffer {
    public data: Float32Array
    public count = 0

    public constructor(capacity: number) {
        this.data = new Float32Array(capacity * FLOATS_PER_GLYPH)
    }

    public push(
        x: number,
        y: number,
        z: number,
        uv: [number, number],
        rgb: [number, number, number],
        shade: number,
        effect: number,
        size: number
    ) {
        if ((this.count + 1) * FLOATS_PER_GLYPH > this.data.length) {
            const grown = new Float32Array(this.data.length * 2)
            grown.set(this.data)
            this.data = grown
        }
        const i = this.count++ * FLOATS_PER_GLYPH
        const d = this.data
        d[i] = x
        d[i + 1] = y
        d[i + 2] = z
        d[i + 3] = uv[0]
        d[i + 4] = uv[1]
        d[i + 5] = rgb[0]
        d[i + 6] = rgb[1]
        d[i + 7] = rgb[2]
        d[i + 8] = shade
        d[i + 9] = effect
        d[i + 10] = size
    }
}

export class Renderer {
    public Camera: Camera
    public map: TileMap
    public lighting: Lighting
    public sprites: Sprite[] = []

    private canvas: HTMLCanvasElement
    private regl: createREGL.Regl
    private pixelRatio: number
    private atlas: createREGL.Texture2D
    private atlasUV = new Map<string, [number, number]>()
    private cellUV: [number, number] = [0, 0]
    private colors = new Map<string, [number, number, number]>()

    private drawSky: createREGL.DrawCommand
    private drawGlyphs: createREGL.DrawCommand<
        createREGL.DefaultContext,
        DrawProps
    >
    // Same glyphs, dimmed and ignoring depth, so sprites show through whatever hides them
    private drawXray: createREGL.DrawCommand<
        createREGL.DefaultContext,
        DrawProps
    >
    private drawDetails: createREGL.DrawCommand<
        createREGL.DefaultContext,
        DetailProps
    >
    private mapBuffer: createREGL.Buffer
    private spriteBuffer: createREGL.Buffer
    private spriteGlyphs = new GlyphBuffer(MAX_SPRITES)
    private detailBuffer: createREGL.Buffer
    // One repeating 0..blades-1 pattern per detail level
    private bladeBuffers = new Map<number, createREGL.Buffer>()

    private chunksX: number
    private chunksY: number
    private chunkFirst: Uint32Array // first glyph of each chunk in the map buffer
    private chunkCount: Uint32Array
    private detailFirst: Uint32Array // first detail tile of each chunk
    private detailCount: Uint32Array
    private chunkCenterZ: Float32Array
    private chunkRadius: Float32Array // bounding sphere, for frustum culling
    private glyphRuns: Run[] = []
    private detailRuns: Run[] = []

    private frame: FrameUniforms = {
        eye: [0, 0, 0],
        right: [1, 0, 0],
        up: [0, 0, 1],
        forward: [0, -1, 0],
        focal: 1,
        aspect: 1,
        fogStart: 0,
        fogRange: 1,
        time: 0,
    }

    // debug info, refreshed a few times a second
    public draws: Signal<number> = new Signal(0)
    public glyphs: Signal<number> = new Signal(0)
    public drawn: Signal<number> = new Signal(0)
    public lights: Signal<number> = new Signal(0)
    private statsTime = 0

    public constructor() {
        this.map = new TileMap(20, 1024, 1024)
        const { x, y, z } = this.map.spawn
        this.Camera = new Camera(new Vector3(x, y, z), 0.6, 0.85)
        this.lighting = new Lighting(
            this.map.lights,
            (lx, ly) => this.map.HeightAt(lx, ly),
            (lx, ly) => this.map.RegionAt(lx, ly)
        )

        // Past 2x the extra pixels cost far more than they show
        this.canvas = document.getElementById('layer-game') as HTMLCanvasElement
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
        this.resize()
        window.addEventListener('resize', () => this.resize())

        this.regl = createREGL({
            canvas: this.canvas,
            extensions: ['ANGLE_instanced_arrays'],
            attributes: { alpha: false, antialias: true },
        })

        this.atlas = this.buildAtlas(this.collectChars())

        this.chunksX = Math.ceil(this.map.mapWidth / CHUNK)
        this.chunksY = Math.ceil(this.map.mapHeight / CHUNK)
        const chunks = this.chunksX * this.chunksY
        this.chunkFirst = new Uint32Array(chunks)
        this.chunkCount = new Uint32Array(chunks)
        this.detailFirst = new Uint32Array(chunks)
        this.detailCount = new Uint32Array(chunks)
        this.chunkCenterZ = new Float32Array(chunks)
        this.chunkRadius = new Float32Array(chunks)

        // The map never changes, so it goes to the GPU once; each frame only sends the camera
        const { glyphs, details, detailTiles, detailGlyphs } = this.buildMap()
        this.mapBuffer = this.regl.buffer(
            glyphs.data.subarray(0, glyphs.count * FLOATS_PER_GLYPH)
        )
        this.detailBuffer = this.regl.buffer(details)
        for (const { blades } of DETAIL_LODS) {
            this.bladeBuffers.set(
                blades,
                this.regl.buffer({
                    type: 'uint8',
                    data: Uint8Array.from(
                        { length: detailTiles * blades },
                        (_, i) => i % blades
                    ),
                })
            )
        }
        this.glyphs.data = glyphs.count + detailGlyphs

        this.spriteBuffer = this.regl.buffer({
            usage: 'dynamic',
            type: 'float',
            length: MAX_SPRITES * STRIDE,
        })

        this.drawSky = this.createSkyCommand()
        this.drawGlyphs = this.createGlyphCommand(false)
        this.drawXray = this.createGlyphCommand(true)
        this.drawDetails = this.createDetailCommand()
    }

    private resize() {
        this.canvas.width = Math.round(window.innerWidth * this.pixelRatio)
        this.canvas.height = Math.round(window.innerHeight * this.pixelRatio)
    }

    // The uniforms SKY_GLSL reads
    private skyUniforms() {
        return {
            uRight: () => this.frame.right,
            uUp: () => this.frame.up,
            uForward: () => this.frame.forward,
            uFocal: () => this.frame.focal,
            uAspect: () => this.frame.aspect,
            uResolution: (context: createREGL.DefaultContext) => [
                context.viewportWidth,
                context.viewportHeight,
            ],
            uZenith: ZENITH,
            uHorizon: HORIZON,
            uGlow: HORIZON_GLOW,
            uBackdrop: BACKDROP,
            uTime: () => this.frame.time,
        }
    }

    // The uniforms BILLBOARD_GLSL and GLYPH_FRAG read. The light arrays are views
    // into Lighting's buffers, so updating those is all a frame needs. They have to
    // be passed as functions: regl captures a plain array once, when the command is built.
    private glyphUniforms() {
        const uniforms: Record<string, unknown> = {
            ...this.skyUniforms(),
            atlas: this.atlas,
            uCellUV: this.cellUV,
            uEye: () => this.frame.eye,
            uFogStart: () => this.frame.fogStart,
            uFogRange: () => this.frame.fogRange,
            uLightBounds: () => this.lighting.bounds,
        }
        const { positions, colors } = this.lighting
        for (let i = 0; i < MAX_LIGHTS; i++) {
            const position = positions.subarray(i * 4, i * 4 + 4)
            const color = colors.subarray(i * 4, i * 4 + 4)
            uniforms[`uLightPos[${i}]`] = () => position
            uniforms[`uLightColor[${i}]`] = () => color
        }
        return uniforms
    }

    // One triangle covering the screen; every pixel looks up the sky in its own direction
    private createSkyCommand() {
        return this.regl({
            vert: `
            precision highp float;
            attribute vec2 position;

            void main() {
                gl_Position = vec4(position, 1.0, 1.0);
            }
            `,
            frag: `
            precision highp float;
            uniform float uTime;
            ${SKY_GLSL}

            // A sparse field of twinkling stars above the horizon
            float stars(vec3 dir) {
                vec2 p = vec2(atan(dir.y, dir.x), asin(dir.z)) * 140.0;
                float h = fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453);
                float spot = 1.0 - smoothstep(0.05, 0.2, length(fract(p) - 0.5));
                float twinkle = 0.65 + 0.35 * sin(uTime * 1.7 + h * 60.0);
                return step(0.988, h) * spot * twinkle * smoothstep(0.1, 0.35, dir.z);
            }

            // A pale moon low in the north-west, with a soft halo
            vec3 moon(vec3 dir) {
                float facing = dot(dir, normalize(vec3(-0.55, -0.75, 0.32)));
                float disc = smoothstep(0.9988, 0.9991, facing);
                float halo = pow(max(facing, 0.0), 300.0) * 0.35 + pow(max(facing, 0.0), 40.0) * 0.08;
                return vec3(0.98, 0.95, 0.85) * disc + vec3(0.7, 0.75, 0.9) * halo;
            }

            void main() {
                vec3 dir = viewRay(gl_FragCoord.xy);
                vec3 sky = skyColor(dir) + vec3(0.6, 0.65, 0.8) * stars(dir);
                gl_FragColor = vec4(sky + moon(dir), 1.0);
            }
            `,
            attributes: {
                position: [
                    [-1, -1],
                    [3, -1],
                    [-1, 3],
                ],
            },
            count: 3,
            uniforms: this.skyUniforms(),
            depth: { enable: false, mask: false },
        })
    }

    private createGlyphCommand(xray: boolean) {
        const instanced =
            (offset: number) =>
            (_: createREGL.DefaultContext, p: DrawProps) => ({
                buffer: p.buffer,
                offset: p.first * STRIDE + offset * 4,
                stride: STRIDE,
                divisor: 1,
            })

        return this.regl<object, object, DrawProps>({
            // Each glyph is a billboard placed in 3D and projected with a real
            // perspective, so distant land shrinks toward the horizon
            vert: `
            precision highp float;
            attribute vec2 corner;
            attribute vec3 world;
            attribute vec2 uv;
            attribute vec3 color;
            attribute float shade;
            attribute float effect;
            attribute float size;
            ${BILLBOARD_GLSL}

            void main() {
                float ripple = step(abs(effect - ${RIPPLE}.0), 0.5)
                    * 0.2 * sin(uTime * 1.5 + world.x * 0.5 + world.y * 0.35);
                float blinking = step(abs(effect - ${BLINK}.0), 0.5);
                float glow = step(abs(effect - ${GLOW}.0), 0.5) + blinking;
                billboard(world, corner, size, uv, color, shade + ripple, glow);

                // Eyes open for a while, shut for a while, and blink now and then
                float open = step(-0.3, sin(uTime * 0.45 + world.x * 1.7 + world.y * 2.3))
                    * step(0.05, fract(uTime * 0.31 + world.x * 0.13 + world.y * 0.07));
                if (blinking > 0.5 && open < 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
            }
            `,
            frag: GLYPH_FRAG,
            attributes: {
                corner: CORNERS,
                world: instanced(0),
                uv: instanced(3),
                color: instanced(5),
                shade: instanced(8),
                effect: instanced(9),
                size: instanced(10),
            },
            elements: QUAD,
            instances: (_: createREGL.DefaultContext, p: DrawProps) => p.count,
            uniforms: {
                ...this.glyphUniforms(),
                uDim: xray ? 0.45 : 1,
            },
            depth: xray
                ? { enable: true, func: 'always', mask: false }
                : { enable: true, func: 'less' },
            blend: { enable: false },
            sample: { alpha: true },
        })
    }

    // Loose detail: each tile's record is shared by all of its blades (the divisor is
    // the detail level's blade count); the blade number picks a spot, height, size,
    // glyph and colour from the tile's look
    private createDetailCommand() {
        const kinds = DETAIL_LOOKS.length
        const uniforms: Record<string, unknown> = {
            ...this.glyphUniforms(),
            uDim: 1,
            uFlowerUV: this.atlasUV.get(FLOWER_CHAR),
            uLod: (_: createREGL.DefaultContext, p: DetailProps) => p.lod,
        }
        DETAIL_LOOKS.forEach((look, kind) => {
            for (let pair = 0; pair < DETAIL_CHARS / 2; pair++) {
                const a = this.atlasUV.get(look.chars[pair * 2])!
                const b = this.atlasUV.get(look.chars[pair * 2 + 1])!
                uniforms[`uDetailUV[${kind * (DETAIL_CHARS / 2) + pair}]`] = [
                    ...a,
                    ...b,
                ]
            }
            look.colors.forEach((color, i) => {
                uniforms[`uDetailColor[${kind * DETAIL_COLORS + i}]`] =
                    this.rgb(color)
            })
            uniforms[`uDetailShape[${kind}]`] = [
                look.size,
                look.variation,
                look.sway,
                look.mode,
            ]
        })
        FLOWER_COLORS.forEach((color, i) => {
            uniforms[`uFlowerColor[${i}]`] = this.rgb(color)
        })

        const record =
            (offset: number) =>
            (_: createREGL.DefaultContext, p: DetailProps) => ({
                buffer: this.detailBuffer,
                offset: p.first * DETAIL_STRIDE + offset,
                stride: DETAIL_STRIDE,
                divisor: p.lod,
            })

        return this.regl<object, object, DetailProps>({
            vert: `
            precision highp float;
            attribute vec2 corner;
            attribute vec4 tile; // x, y, elevation, light
            attribute vec2 info; // kind, density (blades out of ${BLADES})
            attribute float blade;
            uniform float uLod; // blades per tile in this batch
            uniform vec4 uDetailUV[${(kinds * DETAIL_CHARS) / 2}];
            uniform vec3 uDetailColor[${kinds * DETAIL_COLORS}];
            uniform vec4 uDetailShape[${kinds}]; // size, variation, sway, mode
            uniform vec2 uFlowerUV;
            uniform vec3 uFlowerColor[${FLOWER_COLORS.length}];
            ${BILLBOARD_GLSL}

            float hash(float n) {
                return fract(sin(n) * 43758.5453);
            }

            void main() {
                int kind = int(info.x + 0.5);
                vec4 shape = uDetailShape[kind];
                bool water = abs(shape.w - 2.0) < 0.5;

                float seed = dot(tile.xy, vec2(12.9898, 78.233)) + blade * 7.31;
                float spreadX = hash(seed);
                float spreadY = hash(seed + 1.7);
                float lift = hash(seed + 3.1);
                float pick = hash(seed + 4.9);
                float tint = hash(seed + 6.3);

                // Scatter across the tile with a little height variation
                vec3 world = vec3(
                    tile.xy + (vec2(spreadX, spreadY) - 0.5) * 0.95,
                    tile.z + (water ? 0.0 : (lift - 0.5) * 0.4)
                );
                // Plants sway in the wind; wavelets bob and drift
                world.xy += sin(uTime * 1.3 + tile.x * 0.21 + tile.y * 0.17)
                    * vec2(0.06, 0.03) * lift * shape.z;
                if (water) {
                    world.z += sin(uTime * 1.8 + tile.x * 0.7 + tile.y * 0.5 + blade * 1.9) * 0.12;
                    world.x += sin(uTime * 0.6 + blade * 2.3 + tile.y * 0.3) * 0.15;
                }

                int glyph = int(pick * ${DETAIL_CHARS}.0);
                vec4 pair = uDetailUV[kind * ${DETAIL_CHARS / 2} + glyph / 2];
                vec2 uv = glyph - (glyph / 2) * 2 == 0 ? pair.xy : pair.zw;
                vec3 color = uDetailColor[kind * ${DETAIL_COLORS} + int(tint * ${DETAIL_COLORS}.0)];
                // Fewer, slightly larger blades in the coarser levels keep the coverage
                float size = (shape.x + lift * shape.y) * pow(${BLADES}.0 / uLod, 0.3);
                // Ground detail sits back a little so trees and walls stand out from it
                float shade = tile.w * (0.65 + tint * 0.3);

                if (abs(shape.w - 1.0) < 0.5 && pick > 0.975) {
                    uv = uFlowerUV;
                    color = uFlowerColor[int(tint * ${FLOWER_COLORS.length}.0)];
                    size = 0.55;
                    shade = tile.w;
                }
                if (abs(shape.w - 3.0) < 0.5) {
                    shade *= 0.85 + 1.2 * pow(max(0.0, sin(uTime * 2.5 + seed)), 12.0);
                }
                billboard(world, corner, size, uv, color, shade, 0.0);

                // Only as many blades as the tile's density allows at this level
                if (blade >= ceil(info.y * uLod / ${BLADES}.0)) {
                    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
                }
            }
            `,
            frag: GLYPH_FRAG,
            attributes: {
                corner: CORNERS,
                tile: record(0),
                info: record(16),
                blade: (_: createREGL.DefaultContext, p: DetailProps) => ({
                    buffer: this.bladeBuffers.get(p.lod)!,
                    divisor: 1,
                }),
            },
            elements: QUAD,
            instances: (_: createREGL.DefaultContext, p: DetailProps) =>
                p.count * p.lod,
            uniforms,
            depth: { enable: true, func: 'less' },
            blend: { enable: false },
            sample: { alpha: true },
        })
    }

    // Printable ASCII for sprites, every detail glyph, plus whatever the map uses
    private collectChars(): string[] {
        const chars = new Set<string>([FLOWER_CHAR, ...MOTE_CHARS])
        for (let code = 33; code < 127; code++) {
            chars.add(String.fromCharCode(code))
        }
        for (const look of DETAIL_LOOKS) {
            for (const char of look.chars) chars.add(char)
        }
        for (const row of this.map.map) {
            for (const tile of row) {
                chars.add(tile.char)
                for (const glyph of tile.side) chars.add(glyph.char)
                for (const glyph of tile.stack) chars.add(glyph.char)
                for (const prop of tile.props) chars.add(prop.char)
            }
        }
        for (const char of FLORA_CHARS) chars.add(char)
        return [...chars]
    }

    // Glyphs are drawn white and tinted in the shader, so one atlas cell covers every color
    private buildAtlas(chars: string[]): createREGL.Texture2D {
        const cell = ATLAS_CELL
        const columns = 16
        const rows = Math.ceil(chars.length / columns)
        const atlas = document.createElement('canvas')
        atlas.width = columns * cell
        atlas.height = 2 ** Math.ceil(Math.log2(rows * cell))
        const ctx = atlas.getContext('2d')!

        ctx.font = `${cell}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#fff'

        chars.forEach((char, i) => {
            const x = (i % columns) * cell
            const y = Math.floor(i / columns) * cell
            ctx.save()
            ctx.beginPath()
            ctx.rect(x, y, cell, cell)
            ctx.clip() // keep tall glyphs from bleeding into their neighbours
            ctx.fillText(char, x + cell / 2, y + cell / 2)
            ctx.restore()
            this.atlasUV.set(char, [x / atlas.width, y / atlas.height])
        })
        this.cellUV = [cell / atlas.width, cell / atlas.height]

        return this.regl.texture({
            data: atlas,
            mag: 'linear',
            min: 'linear mipmap linear',
            mipmap: true,
        })
    }

    private buildMap() {
        const { map, mapWidth, mapHeight } = this.map
        // Size the buffer up front (cliff faces are a guess) so it rarely has to grow:
        // at millions of glyphs, each doubling copies hundreds of megabytes
        let estimate = mapWidth * mapHeight * 0.3
        let detailTiles = 0
        let detailGlyphs = 0
        for (const row of map) {
            for (const tile of row) {
                estimate += 1 + tile.stack.length + tile.props.length
                if (tile.plant !== Plant.None) estimate += 16
                if (tile.detail === Detail.None || tile.density <= 0) continue
                detailTiles++
                detailGlyphs += tile.density
            }
        }
        const glyphs = new GlyphBuffer(estimate)
        const details = new Float32Array(detailTiles * DETAIL_FLOATS)
        let detailIndex = 0

        for (let cy = 0; cy < this.chunksY; cy++) {
            for (let cx = 0; cx < this.chunksX; cx++) {
                const chunk = cy * this.chunksX + cx
                this.chunkFirst[chunk] = glyphs.count
                this.detailFirst[chunk] = detailIndex
                let minZ = Infinity
                let maxZ = -Infinity

                const endY = Math.min((cy + 1) * CHUNK, mapHeight)
                const endX = Math.min((cx + 1) * CHUNK, mapWidth)
                for (let y = cy * CHUNK; y < endY; y++) {
                    for (let x = cx * CHUNK; x < endX; x++) {
                        const tile = map[y][x]
                        const tallest = Math.max(
                            tile.stack.length,
                            tile.plant === Plant.None ? 0 : 6, // the tallest trees
                            ...tile.props.map((p) => p.lift + (p.size ?? 1))
                        )
                        minZ = Math.min(minZ, tile.elevation)
                        maxZ = Math.max(maxZ, tile.elevation + tallest)
                        this.pushTile(glyphs, x, y)
                        if (tile.detail !== Detail.None && tile.density > 0) {
                            details.set(
                                [
                                    x,
                                    y,
                                    tile.elevation,
                                    this.tileLight(tile) * tile.shadow,
                                    tile.detail,
                                    Math.min(tile.density, BLADES),
                                ],
                                detailIndex++ * DETAIL_FLOATS
                            )
                        }
                    }
                }

                this.chunkCount[chunk] = glyphs.count - this.chunkFirst[chunk]
                this.detailCount[chunk] = detailIndex - this.detailFirst[chunk]
                this.chunkCenterZ[chunk] = (minZ + maxZ) / 2
                // Tree crowns spread a couple of tiles past their own tile
                this.chunkRadius[chunk] =
                    Math.hypot(CHUNK / 2, CHUNK / 2, (maxZ - minZ) / 2) + 3
            }
        }
        return { glyphs, details, detailTiles, detailGlyphs }
    }

    private pushTile(out: GlyphBuffer, x: number, y: number) {
        const map = this.map.map
        const tile = map[y][x]

        // Nudge each tile's glyphs off the grid a little so the land doesn't read as a lattice
        const jx = x + (hash2(x, y, 1) - 0.5) * 0.5
        const jy = y + (hash2(x, y, 2) - 0.5) * 0.5
        const lift = tile.liquid ? 0 : (hash2(x, y, 3) - 0.5) * 0.3
        this.pushGlyph(
            out,
            jx,
            jy,
            tile.elevation + lift,
            tile,
            this.tileLight(tile) * tile.shadow,
            tile.liquid ? RIPPLE : 0
        )

        // Where the ground drops away by more than a level, stack the rock face
        const neighbour = (nx: number, ny: number) =>
            map[ny]?.[nx]?.elevation ?? tile.elevation
        const lowest = Math.min(
            neighbour(x - 1, y),
            neighbour(x + 1, y),
            neighbour(x, y - 1),
            neighbour(x, y + 1)
        )
        // A different face glyph each level, nudged a little, so cliffs read as
        // broken rock rather than ruled columns
        for (let level = 1; tile.elevation - level > lowest + 0.25; level++) {
            const z = tile.elevation - level
            const shade =
                this.tileLight(tile) * Math.max(0.45, 0.8 - level * 0.035)
            const side =
                tile.side[
                    Math.floor(hash2(x, y, 10 + level) * tile.side.length)
                ]
            const fx = x + (hash2(x, y, 40 + level) - 0.5) * 0.3
            const fy = y + (hash2(x, y, 70 + level) - 0.5) * 0.3
            this.pushGlyph(out, fx, fy, z, side, shade)
        }

        // Walls stay on the grid so their courses line up; trees are planted off it
        tile.stack.forEach((glyph, i) => {
            this.pushGlyph(
                out,
                x,
                y,
                tile.elevation + 1 + i,
                glyph,
                this.tileLight(tile)
            )
        })
        // Plants are grown from their seed right here and thrown away once drawn
        const props =
            tile.plant === Plant.None
                ? tile.props
                : [...grow(tile.plant, tile.plantSeed), ...tile.props]
        for (const prop of props) {
            this.pushGlyph(
                out,
                jx + (prop.dx ?? 0),
                jy + (prop.dy ?? 0),
                tile.elevation + prop.lift,
                prop,
                this.tileLight(tile) * (prop.shade ?? 1)
            )
        }
    }

    private pushGlyph(
        out: GlyphBuffer,
        x: number,
        y: number,
        z: number,
        glyph: Glyph,
        shade: number,
        effect = 0
    ) {
        const uv = this.atlasUV.get(glyph.char)
        if (!uv) return
        const rgb = this.rgb(glyph.color)
        // Glowing glyphs aren't shaded by the terrain; their shade is their brightness
        const lit = glyph.glow || glyph.blink
        const fx = glyph.blink ? BLINK : glyph.glow ? GLOW : effect
        const light = lit && effect !== GLOW ? 1 : shade
        out.push(x, y, z, uv, rgb, light, fx, glyph.size ?? 1)
    }

    // The tile's ambient light times Lambert shading of its slope by the sun, so
    // hills read as hills
    private tileLight(tile: Tile): number {
        const length = Math.hypot(tile.gx, tile.gy, 1)
        const facing = (-tile.gx * SUN.x - tile.gy * SUN.y + SUN.z) / length
        return tile.light * (0.45 + 0.65 * Math.max(0, facing))
    }

    private rgb(hex: string): [number, number, number] {
        let color = this.colors.get(hex)
        if (!color) {
            const n = parseInt(hex.slice(1), 16)
            color = [
                ((n >> 16) & 255) / 255,
                ((n >> 8) & 255) / 255,
                (n & 255) / 255,
            ]
            this.colors.set(hex, color)
        }
        return color
    }

    // Orbit rig: the eye sits `distance` back from the focus, looking down at `pitch`
    private updateFrame() {
        const { position, rotation, pitch } = this.Camera.transform.data
        const distance = this.Camera.distance.data
        const cosYaw = Math.cos(rotation)
        const sinYaw = Math.sin(rotation)
        const cosPitch = Math.cos(pitch)
        const sinPitch = Math.sin(pitch)

        const f = [-sinYaw * cosPitch, -cosYaw * cosPitch, -sinPitch]
        const r = [cosYaw, -sinYaw, 0]

        this.frame.forward = f
        this.frame.right = r
        this.frame.up = [
            f[1] * r[2] - f[2] * r[1],
            f[2] * r[0] - f[0] * r[2],
            f[0] * r[1] - f[1] * r[0],
        ]
        this.frame.eye = [
            position.x - f[0] * distance,
            position.y - f[1] * distance,
            position.z - f[2] * distance,
        ]
        this.frame.focal = 1 / Math.tan((this.Camera.fov.data * Math.PI) / 360)
        this.frame.aspect = this.canvas.width / this.canvas.height
        this.frame.fogStart = distance * 0.8
        this.frame.fogRange = 90 + distance * 0.9
        this.frame.time = performance.now() / 1000
    }

    // Distance from the eye to the chunk's centre, or -1 if it's outside the view
    // (sphere-vs-frustum against the four side planes, plus a fog cutoff)
    private chunkDistance(chunk: number, maxDistance: number): number {
        const { eye, right, up, forward, focal, aspect } = this.frame
        const cx = ((chunk % this.chunksX) + 0.5) * CHUNK - eye[0]
        const cy = (Math.floor(chunk / this.chunksX) + 0.5) * CHUNK - eye[1]
        const cz = this.chunkCenterZ[chunk] - eye[2]
        const radius = this.chunkRadius[chunk]

        const z = cx * forward[0] + cy * forward[1] + cz * forward[2]
        if (z < -radius || z > maxDistance + radius) return -1

        const x = cx * right[0] + cy * right[1] + cz * right[2]
        const y = cx * up[0] + cy * up[1] + cz * up[2]
        const slackX = radius * Math.hypot(1, aspect / focal)
        const slackY = radius * Math.hypot(1, 1 / focal)
        const inside =
            Math.abs(x) <= (z * aspect) / focal + slackX &&
            Math.abs(y) <= z / focal + slackY
        return inside ? Math.hypot(cx, cy, cz) : -1
    }

    private detailLod(distance: number): number {
        return DETAIL_LODS.find((lod) => distance < lod.within)!.blades
    }

    // Visible chunks grouped into runs of neighbours in each row. Glyph runs only
    // break at gaps; detail runs also break where the detail level changes, so the
    // level split doesn't cost extra glyph draws. (Drawing nearest-first was measured
    // and bought nothing: glyphs discard their empty pixels, which rules out the
    // early depth rejection it would have enabled.)
    private collectRuns() {
        const maxDistance =
            this.frame.fogStart +
            this.frame.fogRange * 2.2 +
            this.Camera.distance.data
        const glyphRuns = this.glyphRuns
        const detailRuns = this.detailRuns
        glyphRuns.length = 0
        detailRuns.length = 0

        for (let cy = 0; cy < this.chunksY; cy++) {
            let glyphRun: Run | null = null
            let detailRun: Run | null = null
            for (let cx = 0; cx < this.chunksX; cx++) {
                const chunk = cy * this.chunksX + cx
                const distance = this.chunkDistance(chunk, maxDistance)
                if (distance < 0) {
                    if (glyphRun) glyphRuns.push(glyphRun)
                    if (detailRun) detailRuns.push(detailRun)
                    glyphRun = detailRun = null
                    continue
                }
                const lod = this.detailLod(distance)
                if (detailRun && detailRun.lod !== lod) {
                    detailRuns.push(detailRun)
                    detailRun = null
                }
                if (glyphRun) glyphRun.last = chunk
                else glyphRun = { first: chunk, last: chunk, lod }
                if (detailRun) detailRun.last = chunk
                else detailRun = { first: chunk, last: chunk, lod }
            }
            if (glyphRun) glyphRuns.push(glyphRun)
            if (detailRun) detailRuns.push(detailRun)
        }
    }

    private drawGlyphRun(run: Run): number {
        const first = this.chunkFirst[run.first]
        const count =
            this.chunkFirst[run.last] + this.chunkCount[run.last] - first
        this.drawGlyphs({ buffer: this.mapBuffer, first, count })
        return count
    }

    private drawDetailRun(run: Run): number {
        const first = this.detailFirst[run.first]
        const count =
            this.detailFirst[run.last] + this.detailCount[run.last] - first
        if (count > 0) this.drawDetails({ first, count, lod: run.lod })
        return count * run.lod
    }

    private writeSprites(): number {
        const out = this.spriteGlyphs
        out.count = 0
        for (const sprite of this.sprites) {
            if (out.count === MAX_SPRITES) break
            const { x, y, z } = sprite.position
            const glyph = { ...sprite, size: sprite.size ?? SPRITE_SIZE }
            this.pushGlyph(out, x, y, z, glyph, 1.1)
        }
        // Fireflies, wisps and fairies glow as bright as they're shining
        for (const mote of this.lighting.motes) {
            if (out.count === MAX_SPRITES) break
            const { x, y, z } = mote.position
            const { char, color, size } = mote
            this.pushGlyph(
                out,
                x,
                y,
                z,
                { char, color, size },
                mote.brightness,
                GLOW
            )
        }
        if (out.count > 0) {
            this.spriteBuffer.subdata(
                out.data.subarray(0, out.count * FLOATS_PER_GLYPH)
            )
        }
        return out.count
    }

    public Draw() {
        if (!this.canvas || !this.regl) return

        this.regl.poll() // pick up canvas resizes
        this.updateFrame()
        this.lighting.Update(
            this.frame.time,
            this.Camera.transform.data.position
        )
        this.regl.clear({ color: [...BACKDROP, 1], depth: 1 })
        this.drawSky()

        this.collectRuns()
        let calls = 1 + this.glyphRuns.length + this.detailRuns.length
        let drawn = 0
        for (const run of this.glyphRuns) drawn += this.drawGlyphRun(run)
        for (const run of this.detailRuns) drawn += this.drawDetailRun(run)

        // Sprites twice: a dim x-ray pass so they show through hills and walls,
        // then the real pass on top wherever they're actually visible
        const spriteCount = this.writeSprites()
        if (spriteCount > 0) {
            const sprites = {
                buffer: this.spriteBuffer,
                first: 0,
                count: spriteCount,
            }
            this.drawXray(sprites)
            this.drawGlyphs(sprites)
            calls += 2
        }

        // The HUD only needs a few updates a second; React re-rendering every frame
        // costs more than the whole draw
        if (this.frame.time - this.statsTime > STATS_INTERVAL) {
            this.statsTime = this.frame.time
            this.draws.data = calls
            this.drawn.data = drawn
            this.lights.data = this.lighting.count
        }
    }
}

export const renderer = new Renderer()
