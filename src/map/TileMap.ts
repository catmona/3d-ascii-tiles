import { Tile } from './Tile'

export class TileMap {
    public tileSize: number
    public mapWidth: number
    public mapHeight: number
    public map: Tile[][]
    public chars = ['.', ',', '`', '·']
    public colors = ['#228B22', '#2E8B57', '#6B8E23', '#556B2F', '#7CFC00']

    public constructor(tileSize: number, mapWidth: number, mapHeight: number) {
        this.tileSize = tileSize
        this.mapWidth = mapWidth
        this.mapHeight = mapHeight
        this.map = []

        for (let y = 0; y < this.mapHeight; y++) {
            const row: Tile[] = []
            for (let x = 0; x < this.mapWidth; x++) {
                row.push(
                    new Tile(
                        this.chars[
                            Math.floor(Math.random() * this.chars.length)
                        ],
                        this.colors[
                            Math.floor(Math.random() * this.colors.length)
                        ],
                        Math.floor(Math.random() * 2) // small variation
                    )
                )
            }
            this.map.push(row)
        }
    }
}
