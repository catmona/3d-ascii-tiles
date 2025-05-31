import * as PIXI from 'pixi.js'
import { CompositeTilemap } from '@pixi/tilemap'
import { Camera } from './Camera'
import { Vector3 } from '../core/Types'
import { TileMap } from '../map/TileMap'
import { Signal } from '../utils/Signal'

export class Renderer {
    public Camera: Camera
    public map: TileMap

    private app: PIXI.Application
    private tileLayer: CompositeTilemap
    private atlasTexture: PIXI.Texture

    // debug metrics
    public tilesDrawn = new Signal<number>(0)

    public constructor() {
        void this.setup()
    }

    private async setup() {
        this.Camera = new Camera()
        this.map = new TileMap(64, 100, 100)

        this.app = new PIXI.Application()

        await this.app.init({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0x222222,
            antialias: false,
            resolution: window.devicePixelRatio || 1,
        })

        const root = document.getElementById('layer-game') as HTMLDivElement
        root.appendChild(this.app.canvas)

        this.app.canvas.style.width = '100vw'
        this.app.canvas.style.height = '100vh'
        this.app.canvas.style.display = 'block'
        this.app.canvas.style.position = 'absolute'
        this.app.canvas.style.top = '0'
        this.app.canvas.style.left = '0'

        const atlasCanvas = this.buildCharAtlas(this.map.chars, this.map.colors)
        this.atlasTexture = PIXI.Texture.from(atlasCanvas)
        this.atlasTexture.source.scaleMode = 'nearest'
        this.atlasTexture.source.update()

        this.tileLayer = new CompositeTilemap([this.atlasTexture.source])
        this.app.stage.addChild(this.tileLayer)

        this.app.canvas.addEventListener('click', () => {
            void this.app.canvas.requestPointerLock()
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

        return [isoX, isoY]
    }

    private buildCharAtlas(
        chars: string[],
        colors: string[]
    ): HTMLCanvasElement {
        const tileSize = this.map.tileSize
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        if (!ctx) {
            throw new Error('Failed to get canvas context')
        }
        canvas.width = tileSize * chars.length
        canvas.height = tileSize * colors.length

        ctx.font = `${tileSize}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        for (let i = 0; i < chars.length; i++) {
            for (let j = 0; j < colors.length; j++) {
                ctx.fillStyle = colors[j]
                ctx.fillText(
                    chars[i],
                    i * tileSize + tileSize / 2,
                    j * tileSize + tileSize / 2
                )
            }
        }
        return canvas
    }

    public Draw() {
        if (!this.tileLayer) return
        this.tileLayer.clear()

        // this.tileLayer.tile(0, 100, 100, {
        //     u: 0,
        //     v: 0,
        //     tileWidth: this.map.tileSize,
        //     tileHeight: this.map.tileSize,
        // })
        // this.app.renderer.render(this.app.stage)
        // return true

        // --- Culling: calculate visible tile bounds (axis-aligned, no rotation/pitch compensation) ---
        const searchRadius =
            Math.ceil(
                Math.sqrt(
                    (this.app.renderer.width / this.map.tileSize) ** 2 +
                        (this.app.renderer.height / this.map.tileSize) ** 2
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

        this.tilesDrawn.data = 0
        // --- Draw visible tiles ---
        const tempVec = new Vector3(0, 0, 0)
        for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
                const tile = this.map.map[y][x]
                tempVec.x = x
                tempVec.y = y
                tempVec.z = tile.height
                const [sx, sy] = this.toScreen(tempVec)

                // Screen culling
                if (
                    sx + this.app.renderer.width / 2 < -this.map.tileSize ||
                    sy + this.app.renderer.height / 2 < -this.map.tileSize ||
                    sx + this.app.renderer.width / 2 >
                        this.app.renderer.width + this.map.tileSize ||
                    sy + this.app.renderer.height / 2 >
                        this.app.renderer.height + this.map.tileSize
                ) {
                    continue
                }

                // Find atlas frame
                const charIndex = this.map.chars.indexOf(tile.char)
                const colorIndex = this.map.colors.indexOf(tile.color)
                if (charIndex === -1 || colorIndex === -1) continue

                // Calculate frame rectangle in atlas
                const frameX = charIndex * this.map.tileSize
                const frameY = colorIndex * this.map.tileSize
                this.tileLayer.tile(
                    0,
                    sx - this.map.tileSize / 2 + this.app.renderer.width / 2,
                    sy - this.map.tileSize / 2 + this.app.renderer.height / 2,
                    {
                        u: frameX,
                        v: frameY,
                        tileWidth: this.map.tileSize,
                        tileHeight: this.map.tileSize,
                    }
                )
                this.tilesDrawn.data++
            }
        }
    }
}

export const renderer = new Renderer()
