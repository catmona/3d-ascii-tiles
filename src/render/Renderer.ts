import { Camera } from './Camera'
import { Vector3 } from '../core/Types'
import { TileMap } from '../map/TileMap'
import { Signal } from '../utils/Signal'
import reglConstructor from 'regl'
import regl from 'regl'

export class Renderer {
    public Camera: Camera
    public map: TileMap

    private canvas: HTMLCanvasElement
    private regl: reglConstructor.Regl
    private charAtlas: HTMLCanvasElement
    private charAtlasTexture: regl.Texture2D

    private drawTiles!: regl.DrawCommand
    private charAtlasMap: Map<string, { x: number; y: number }> = new Map()

    // debug info
    public draws: Signal<number> = new Signal(0)

    public constructor() {
        this.Camera = new Camera()
        this.map = new TileMap(20, 400, 400)
        this.canvas = document.getElementById('layer-game') as HTMLCanvasElement
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight

        this.regl = reglConstructor({
            canvas: this.canvas,
            attributes: { alpha: true },
        })

        this.canvas.addEventListener('click', () => {
            void this.canvas.requestPointerLock()
        })

        this.buildCharAtlas(this.map.chars, this.map.colors)
        this.charAtlasTexture = this.regl.texture({
            data: this.charAtlas,
            mag: 'nearest',
            min: 'nearest',
        })

        this.registerDrawCommand()
    }

    private registerDrawCommand() {
        const w = this.canvas.width
        const h = this.canvas.height

        this.drawTiles = this.regl({
            vert: `
            precision mediump float;
            attribute vec2 position;
            attribute vec2 uv;
            uniform vec2 uResolution;
            varying vec2 vUv;
            void main() {
                vec2 center = 0.5 * uResolution;
                vec2 clip   = (position - center) / center;
                gl_Position = vec4(clip * vec2(1, -1), 0, 1);
                vUv = uv;
            }
            `,
            frag: `
            precision mediump float;
            uniform sampler2D atlas;
            varying vec2 vUv;
            void main() {
                vec4 tex = texture2D(atlas, vUv);
                // If you want a constant 50% alpha on everything, you could do:
                //    tex.a *= 0.5;
                gl_FragColor = tex;
            }
            `,
            attributes: {
                position: (_, p) => p.positions,
                uv: (_, p) => p.uvs,
            },
            elements: (_, p) => p.elements,
            uniforms: {
                uResolution: () => [w, h],
                atlas: this.regl.prop('atlas'),
            },

            blend: {
                enable: true,
                func: {
                    src: 'src alpha',
                    dst: 'one minus src alpha',
                },
            },
            depth: { enable: false },
        })
    }

    private toScreen(pos: Vector3) {
        const cosRot = Math.cos(this.Camera.rotation.data)
        const sinRot = Math.sin(this.Camera.rotation.data)

        const worldX = pos.x - this.Camera.position.data.x
        const worldY = pos.y - this.Camera.position.data.y

        const rotatedX = worldX * cosRot - worldY * sinRot
        const rotatedY = worldX * sinRot + worldY * cosRot

        const isoX = rotatedX * this.map.tileSize
        const isoY =
            rotatedY * this.map.tileSize * Math.sin(this.Camera.pitch.data) -
            pos.z * (this.map.tileSize / 2)

        // Center the world in the canvas
        return [isoX + this.canvas.width / 2, isoY + this.canvas.height / 2]
    }

    private buildCharAtlas(chars: string[], colors: string[]) {
        this.charAtlas = document.createElement('canvas')
        this.charAtlas.width = this.map.tileSize * chars.length
        this.charAtlas.height = this.map.tileSize * colors.length
        const ctx = this.charAtlas.getContext('2d')!

        ctx.font = `${this.map.tileSize}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        for (let i = 0; i < chars.length; i++) {
            for (let j = 0; j < colors.length; j++) {
                const char = chars[i]
                const color = colors[j]
                ctx.fillStyle = color
                ctx.fillText(
                    char,
                    i * this.map.tileSize + this.map.tileSize / 2,
                    j * this.map.tileSize + this.map.tileSize / 2
                )
                this.charAtlasMap.set(`${char}_${color}`, {
                    x: i * this.map.tileSize,
                    y: j * this.map.tileSize,
                })
            }
        }
    }

    public Draw() {
        if (!this.canvas || !this.regl) return
        this.draws.data = 0

        // --- Culling: calculate visible tile bounds (same as before) ---
        const searchRadius =
            Math.ceil(
                Math.sqrt(
                    (this.canvas.width / this.map.tileSize) ** 2 +
                        (this.canvas.height / this.map.tileSize) ** 2
                ) / 2
            ) + 2

        const camX = this.Camera.position.data.x
        const camY = this.Camera.position.data.y

        const minX = Math.max(0, Math.floor(camX - searchRadius))
        const maxX = Math.min(this.map.mapWidth, Math.ceil(camX + searchRadius))
        const minY = Math.max(0, Math.floor(camY - searchRadius))
        const maxY = Math.min(
            this.map.mapHeight,
            Math.ceil(camY + searchRadius)
        )

        // ─── 5) Prepare a temporary list of “drawables” so we can sort by screenY ─────────────────────────
        type TileInstance = {
            screenY: number
            positions: [
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
            ]
            uvs: [
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
            ]
            elements: [number, number, number, number, number, number]
        }
        const bucket: TileInstance[] = []
        let vertCount = 0

        const tempVec = new Vector3(0, 0, 0)
        for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
                const tile = this.map.map[y][x]
                tempVec.x = x
                tempVec.y = y
                tempVec.z = tile.height
                const [sx, sy] = this.toScreen(tempVec)
                // ── snap to nearest integer to avoid sub‐pixel jitter:
                const screenX = Math.round(sx)
                const screenY = Math.round(sy)

                // cull if fully off-screen
                if (
                    screenX >= -this.map.tileSize &&
                    screenY >= -this.map.tileSize &&
                    screenX <= this.canvas.width + this.map.tileSize &&
                    screenY <= this.canvas.height + this.map.tileSize
                ) {
                    const atlasPos = this.charAtlasMap.get(
                        `${tile.char}_${tile.color}`
                    )
                    if (!atlasPos) continue

                    const tw = this.map.tileSize
                    const th = this.map.tileSize
                    const u0 = atlasPos.x / this.charAtlas.width
                    const v0 = atlasPos.y / this.charAtlas.height
                    const u1 = (atlasPos.x + tw) / this.charAtlas.width
                    const v1 = (atlasPos.y + th) / this.charAtlas.height
                    const half = this.map.tileSize / 2

                    // Compute the four corners, centered around (screenX, screenY):
                    const quadPositions: [
                        number,
                        number,
                        number,
                        number,
                        number,
                        number,
                        number,
                        number,
                    ] = [
                        screenX - half,
                        screenY - half, // bottom-left
                        screenX + half,
                        screenY - half, // bottom-right
                        screenX + half,
                        screenY + half, // top-right
                        screenX - half,
                        screenY + half, // top-left
                    ]

                    const quadUVs: [
                        number,
                        number,
                        number,
                        number,
                        number,
                        number,
                        number,
                        number,
                    ] = [u0, v0, u1, v0, u1, v1, u0, v1]

                    // Indices for two triangles:
                    const quadElems: [
                        number,
                        number,
                        number,
                        number,
                        number,
                        number,
                    ] = [
                        vertCount + 0,
                        vertCount + 1,
                        vertCount + 2,
                        vertCount + 0,
                        vertCount + 2,
                        vertCount + 3,
                    ]

                    bucket.push({
                        screenY, // use this later for sorting
                        positions: quadPositions,
                        uvs: quadUVs,
                        elements: quadElems,
                    })

                    vertCount += 4
                    this.draws.data++
                }
            }
        }

        // ─── 6) Sort quads *by ascending* screenY so “farther” (higher on screen) get drawn first ────────────
        //     You could also sort by any other depth key (e.g. world x+y+z). The key is that blending
        //     works best if you draw from back→front.
        bucket.sort((a, b) => a.screenY - b.screenY)

        // ─── 7) Flatten the sorted list into flat FloatArrays for Regl ─────────────────────────────────────
        const positions: number[] = []
        const uvs: number[] = []
        const elements: number[] = []
        let flatVert = 0
        for (const tileInst of bucket) {
            positions.push(...tileInst.positions)
            uvs.push(...tileInst.uvs)
            elements.push(...tileInst.elements.map((idx) => idx)) // already has correct indices
            flatVert += 4
        }

        // ─── 8) Clear + draw everything in one Regl call ───────────────────────────────────────────────────
        this.regl.clear({ color: [0, 0, 0, 0], depth: 1 })
        this.drawTiles({
            positions,
            uvs,
            elements,
            atlas: this.charAtlasTexture,
        })
    }
}

export const renderer = new Renderer()
