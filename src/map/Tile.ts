export class Tile {
    public char: string // Character representation of the tile
    public color: string // Color of the tile
    public height: number // Height of the tile (for elevation)
    public light: number = 1 // Light level (default to 1)

    public constructor(char: string, color: string, height: number) {
        this.char = char
        this.color = color
        this.height = height
        this.light = 1 // Default light level
    }
}
