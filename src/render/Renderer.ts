const gameLayer = document.getElementById('layer-game') as HTMLCanvasElement
const gameCtx = gameLayer.getContext('2d')

const camera = {
    x: 0,
    y: 0,
    zoom: 1,
    rotation: 0,
    pitch: Math.PI / 6,
}
const tileSize = 20
const mapWidth = 40
const mapHeight = 40
const map = [] as { char: string; color: string; height: number }[][]

export function StartRendering() {
    gameLayer.width = window.innerWidth
    gameLayer.height = window.innerHeight

    // Generate field of grass with visual variation
    const grassChars = ['.', ',', '`', '·', '']
    const grassColors = ['#228B22', '#2E8B57', '#6B8E23', '#556B2F', '#7CFC00']

    for (let y = 0; y < mapHeight; y++) {
        const row = []
        for (let x = 0; x < mapWidth; x++) {
            row.push({
                char: grassChars[Math.floor(Math.random() * grassChars.length)],
                color: grassColors[
                    Math.floor(Math.random() * grassColors.length)
                ],
                height: Math.floor(Math.random() * 2), // small variation
            })
        }
        map.push(row)
    }

    draw(gameCtx!, gameLayer)
}

function toScreen(x: number, y: number, z: number) {
    const cosRot = Math.cos(camera.rotation)
    const sinRot = Math.sin(camera.rotation)

    const worldX = x - mapWidth / 2
    const worldY = y - mapHeight / 2

    const rotatedX = worldX * cosRot - worldY * sinRot
    const rotatedY = worldX * sinRot + worldY * cosRot

    const isoX = rotatedX * tileSize
    const isoY =
        rotatedY * tileSize * Math.sin(camera.pitch) - z * (tileSize / 2)

    return [isoX, isoY]
}

function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    if (!canvas || !ctx) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.scale(camera.zoom, camera.zoom)

    ctx.font = `${tileSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const tile = map[y][x]
            const [sx, sy] = toScreen(x, y, tile.height)
            ctx.fillStyle = tile.color
            ctx.fillText(tile.char, sx, sy)
        }
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') camera.rotation -= 0.1
    if (e.key === 'ArrowRight') camera.rotation += 0.1
    if (e.key === 'ArrowUp') camera.zoom *= 1.1
    if (e.key === 'ArrowDown') camera.zoom /= 1.1
    if (e.key === 'q') camera.pitch = Math.min(Math.PI / 2, camera.pitch + 0.05)
    if (e.key === 'e') camera.pitch = Math.max(0.1, camera.pitch - 0.05)
    draw(gameCtx!, gameLayer)
})
