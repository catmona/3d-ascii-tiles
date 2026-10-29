// A glowing glyph is lit from within: it ignores the darkness and cuts through fog.
// A blinking one glows too, but keeps closing (eyes in the dark). Size is in tiles.
export type Glyph = {
    char: string
    color: string
    glow?: boolean
    blink?: boolean
    size?: number
}

// Something standing on a tile but not part of it (a tree's leaves, a torch): offset
// from the tile's surface by `dx`, `dy` and `lift` tiles, drawn at its own size, and
// shaded by `shade` on top of the tile's light
export type Prop = Glyph & {
    lift: number
    dx?: number
    dy?: number
    shade?: number
}

// What grows or lies loose on a tile, drawn as a scatter of small glyphs on the GPU
export enum Detail {
    None,
    Grass,
    Forest,
    Sand,
    Rock,
    Snow,
    Water,
    Shore,
    Floor,
    Haunted,
    Fairy,
    Moss, // damp forest floors and the feet of old walls
    Pebbles, // shingle beaches
    Scree, // broken stone on steep slopes
}

// Trees, undergrowth and stones, grown from a seed when the map is drawn (see
// flora.ts). The seed's low bits pick a variant (a palette, mossy or not...).
export enum Plant {
    None,
    Broadleaf,
    Pine,
    Dead,
    Gloom,
    Fairy,
    Toadstool,
    Oak,
    Birch,
    Willow,
    Poplar,
    Sapling,
    Bush,
    Fern,
    Flowers,
    TallGrass,
    Reeds,
    LilyPads,
    Fungus,
    CrystalFlowers,
    Bramble,
    Bones,
    Stump,
    Log,
    Boulder,
    Rocks,
    Outcrop,
}

// Parts of the world with their own character
export enum Region {
    Wild,
    Haunted,
    Fairy,
}

const NONE: never[] = []

export class Tile {
    public char: string // Character representation of the tile
    public color: string // Color of the tile
    public height: number // Whole levels, for terraces, cliffs and building sites
    public elevation: number // Smooth surface the glyphs actually sit on
    public light: number = 1 // Ambient light level: dimmer in the haunted woods (default to 1)
    public gx = 0 // Terrain gradient, rise per tile eastward and southward; the
    public gy = 0 // renderer lights slopes from it
    public shadow = 1 // Darkening of the ground only, under trees and beside walls
    public side: Glyph[] // Drawn down exposed cliff faces below the surface, one picked per level
    // Most tiles have neither, so they share one empty array (replace it, never push to it)
    public stack: Glyph[] = NONE // Solid levels built on the surface (walls), one per level
    public props: Prop[] = NONE // Torches, graves and other things standing on the tile
    public plant = Plant.None // A tree, bush, rock..., grown from plantSeed when drawn
    public plantSeed = 0
    public liquid = false // Surface ripples (water)
    public detail = Detail.None
    public density = 0 // How many of the 8 detail glyphs this tile gets
    public region = Region.Wild

    public constructor(
        char: string,
        color: string,
        height: number,
        side: Glyph[]
    ) {
        this.char = char
        this.color = color
        this.height = height
        this.elevation = height
        this.side = side
        this.light = 1 // Default light level
    }
}
