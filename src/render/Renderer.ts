import { Camera } from './Camera'
import { Vector3 } from '../core/Types'

export class Renderer {
    private tileSize: number
    private mapWidth: number
    private mapHeight: number
    private map = [] as { char: string; color: string; height: number }[][]
    public Camera: Camera
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private charAtlas: HTMLCanvasElement
    private charAtlasCtx: CanvasRenderingContext2D
    private charAtlasMap: Map<string, { x: number; y: number }> = new Map()

    public constructor() {
        this.tileSize = 20
        this.mapWidth = 400
        this.mapHeight = 400
        this.Camera = new Camera()
        this.canvas = document.getElementById('layer-game') as HTMLCanvasElement
        this.ctx = this.canvas.getContext('2d')!

        this.ctx.font = `${this.tileSize}px monospace`
        this.ctx.textAlign = 'center'
        this.ctx.textBaseline = 'middle'
        this.ctx.imageSmoothingEnabled = false

        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight

        this.canvas.addEventListener('click', () => {
            void this.canvas.requestPointerLock()
        })

        // Generate field of grass with visual variation
        const grassChars = ['.', ',', '`', '·']
        const grassColors = [
            '#228B22',
            '#2E8B57',
            '#6B8E23',
            '#556B2F',
            '#7CFC00',
        ]

        this.buildCharAtlas(grassChars, grassColors)

        // default map
        this.map = []
        for (let y = 0; y < this.mapHeight; y++) {
            const row = []
            for (let x = 0; x < this.mapWidth; x++) {
                row.push({
                    char: grassChars[
                        Math.floor(Math.random() * grassChars.length)
                    ],
                    color: grassColors[
                        Math.floor(Math.random() * grassColors.length)
                    ],
                    height: Math.floor(Math.random() * 2), // small variation
                })
            }
            this.map.push(row)
        }
    }

    private buildCharAtlas(chars: string[], colors: string[]) {
        const size = this.tileSize
        const atlasCols = chars.length
        const atlasRows = colors.length
        this.charAtlas = document.createElement('canvas')
        this.charAtlas.width = atlasCols * size
        this.charAtlas.height = atlasRows * size
        this.charAtlasCtx = this.charAtlas.getContext('2d')!

        this.charAtlasCtx.font = `${size}px monospace`
        this.charAtlasCtx.textAlign = 'center'
        this.charAtlasCtx.textBaseline = 'middle'

        for (let c = 0; c < chars.length; c++) {
            for (let r = 0; r < colors.length; r++) {
                const char = chars[c]
                const color = colors[r]
                const x = c * size + size / 2
                const y = r * size + size / 2
                this.charAtlasCtx.fillStyle = color
                this.charAtlasCtx.fillText(char, x, y)
                this.charAtlasMap.set(`${char}_${color}`, {
                    x: c * size,
                    y: r * size,
                })
            }
        }
    }

    private toScreen(pos: Vector3) {
        const cosRot = Math.cos(this.Camera.rotation.data)
        const sinRot = Math.sin(this.Camera.rotation.data)

        const worldX = pos.x - this.Camera.position.data.x
        const worldY = pos.y - this.Camera.position.data.y

        const rotatedX = worldX * cosRot - worldY * sinRot
        const rotatedY = worldX * sinRot + worldY * cosRot

        const isoX = rotatedX * this.tileSize
        const isoY =
            rotatedY * this.tileSize * Math.sin(this.Camera.pitch.data) -
            pos.z * (this.tileSize / 2)

        return [isoX, isoY]
    }

    private isVisible(
        screenX: number,
        screenY: number,
        canvasWidth: number,
        canvasHeight: number
    ): boolean {
        return (
            screenX >= -this.tileSize &&
            screenY >= -this.tileSize &&
            screenX <= canvasWidth + this.tileSize &&
            screenY <= canvasHeight + this.tileSize
        )
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
                    (this.canvas.width / this.tileSize) ** 2 +
                        (this.canvas.height / this.tileSize) ** 2
                ) / 2
            ) + 2

        const camX = this.Camera.position.data.x
        const camY = this.Camera.position.data.y

        const minX = Math.max(0, Math.floor(camX - searchRadius))
        const maxX = Math.min(this.mapWidth, Math.ceil(camX + searchRadius))
        const minY = Math.max(0, Math.floor(camY - searchRadius))
        const maxY = Math.min(this.mapHeight, Math.ceil(camY + searchRadius))

        const tempVec = new Vector3(0, 0, 0)
        for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
                const tile = this.map[y][x]
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
                            this.tileSize,
                            this.tileSize,
                            Math.round(sx - this.tileSize / 2),
                            Math.round(sy - this.tileSize / 2),
                            this.tileSize,
                            this.tileSize
                        )
                    }
                }
            }
        }
    }
}

export const renderer = new Renderer()
