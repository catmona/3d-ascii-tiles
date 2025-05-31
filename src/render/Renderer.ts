import { Camera } from './Camera'
import { Vector3 } from '../core/Types'
import { TileMap } from '../map/TileMap'

export class Renderer {
    public Camera: Camera
    public map: TileMap
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private charAtlas: HTMLCanvasElement
    private charAtlasCtx: CanvasRenderingContext2D
    private charAtlasMap: Map<string, { x: number; y: number }> = new Map()

    public constructor() {
        this.Camera = new Camera()
        this.map = new TileMap(20, 400, 400)
        this.canvas = document.getElementById('layer-game') as HTMLCanvasElement
        this.ctx = this.canvas.getContext('2d')!

        this.ctx.font = `${this.map.tileSize}px monospace`
        this.ctx.textAlign = 'center'
        this.ctx.textBaseline = 'middle'
        this.ctx.imageSmoothingEnabled = false

        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight

        this.canvas.addEventListener('click', () => {
            void this.canvas.requestPointerLock()
        })

        this.buildCharAtlas(this.map.chars, this.map.colors)
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

    private isVisible(
        screenX: number,
        screenY: number,
        canvasWidth: number,
        canvasHeight: number
    ): boolean {
        return (
            screenX >= -this.map.tileSize &&
            screenY >= -this.map.tileSize &&
            screenX <= canvasWidth + this.map.tileSize &&
            screenY <= canvasHeight + this.map.tileSize
        )
    }

    private buildCharAtlas(chars: string[], colors: string[]) {
        this.charAtlas = document.createElement('canvas')
        this.charAtlas.width = this.map.tileSize * chars.length
        this.charAtlas.height = this.map.tileSize * colors.length
        this.charAtlasCtx = this.charAtlas.getContext('2d')!

        this.charAtlasCtx.font = `${this.map.tileSize}px monospace`
        this.charAtlasCtx.textAlign = 'center'
        this.charAtlasCtx.textBaseline = 'middle'

        for (let i = 0; i < chars.length; i++) {
            for (let j = 0; j < colors.length; j++) {
                const char = chars[i]
                const color = colors[j]
                this.charAtlasCtx.fillStyle = color
                this.charAtlasCtx.fillText(
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
        if (!this.canvas || !this.ctx) return

        this.ctx.setTransform(1, 0, 0, 1, 0, 0)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2)

        // --- Culling: calculate visible tile bounds (axis-aligned, no rotation/pitch compensation) ---
        const searchRadius =
            Math.ceil(
                Math.sqrt(
                    (this.canvas.width / this.map.tileSize) ** 2 +
                        (this.canvas.height / this.map.tileSize) ** 2
                ) / 2
            ) + 2

        // frustum culling calculations
        const camX = this.Camera.position.data.x
        const camY = this.Camera.position.data.y

        const minX = Math.max(0, Math.floor(camX - searchRadius))
        const maxX = Math.min(this.map.mapWidth, Math.ceil(camX + searchRadius))
        const minY = Math.max(0, Math.floor(camY - searchRadius))
        const maxY = Math.min(
            this.map.mapHeight,
            Math.ceil(camY + searchRadius)
        )

        const tempVec = new Vector3(0, 0, 0)
        for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
                const tile = this.map.map[y][x]
                tempVec.x = x
                tempVec.y = y
                tempVec.z = tile.height
                const [sx, sy] = this.toScreen(tempVec)
                if (
                    this.isVisible(
                        sx + this.canvas.width / 2,
                        sy + this.canvas.height / 2,
                        this.canvas.width,
                        this.canvas.height
                    )
                ) {
                    const atlasPos = this.charAtlasMap.get(
                        `${tile.char}_${tile.color}`
                    )
                    if (atlasPos) {
                        this.ctx.drawImage(
                            this.charAtlas,
                            atlasPos.x,
                            atlasPos.y,
                            this.map.tileSize,
                            this.map.tileSize,
                            sx - this.map.tileSize / 2,
                            sy - this.map.tileSize / 2,
                            this.map.tileSize,
                            this.map.tileSize
                        )
                    }
                }
            }
        }
    }
}

export const renderer = new Renderer()
