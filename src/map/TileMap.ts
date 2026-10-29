import { Vector3 } from '../core/Types'
import { clamp, fbm, seededRandom, smoothstep } from '../utils/Math'
import { mushroomCap } from './flora'
import { Light } from './Lighting'
import {
    World,
    castle,
    clear,
    fairyRing,
    graveyard,
    ruin,
    watchtower,
} from './structures'
import { Detail, Glyph, Plant, Prop, Region, Tile } from './Tile'

const SEA_LEVEL = 5
const BLADES_PER_TILE = 8 // the most detail glyphs a tile can have
const CASTLE_SIZE = 15 // half the width of a castle's curtain wall

type Biome = { chars: string[]; colors: string[]; side: Glyph[] }

const face = (chars: string[], color: string): Glyph[] =>
    chars.map((char) => ({ char, color, size: 1.1 }))

export const GRASS_COLORS = [
    '#228B22',
    '#2E8B57',
    '#6B8E23',
    '#556B2F',
    '#7CFC00',
]

const BIOMES = {
    deepWater: {
        chars: ['≈', '~'],
        colors: ['#1a4a80', '#163f6e', '#1d528c'],
        side: face([':'], '#14365e'),
    },
    water: {
        chars: ['~', '≈', '~'],
        colors: ['#2f7cc4', '#3a89d1', '#4a97dc'],
        side: face([':'], '#1a4a80'),
    },
    sand: {
        chars: ['.', ':', '·'],
        colors: ['#d9c48f', '#c9b37b', '#e3d3a3'],
        side: face([':', '.'], '#a8935e'),
    },
    grass: {
        chars: ['.', ',', '`', '·', '"', "'"],
        colors: GRASS_COLORS,
        side: face([':', ';', '.'], '#7a5634'),
    },
    rock: {
        chars: ['.', ':', '^', ','],
        colors: ['#a89f90', '#8a8174', '#b5ac9c', '#7a7266'],
        side: face(['%', ':', ';', '%'], '#8a8276'),
    },
    snow: {
        chars: ['.', '·', '~', "'"],
        colors: ['#f4f8fb', '#e2eaf0', '#d0dce6'],
        side: face([':', '%', ';'], '#b6c2cc'),
    },
} satisfies Record<string, Biome>

const BOULDER = ['#7d766b', '#6c665c', '#8a8378']
const ICE = ['#c6d8e8', '#b4c8da']
const CRYSTAL = ['#45f0d8', '#c36bff']

// A haunted or fairy wood, centred somewhere near the start
type Realm = { x: number; y: number; radius: number; kind: Region }

export class TileMap implements World {
    public tileSize: number
    public mapWidth: number
    public mapHeight: number
    public map: Tile[][]
    public spawn: Vector3
    public lights: Light[] = [] // torches, fires, candles, beacons, crystals...
    public random: () => number

    private seed: number
    private realms: Realm[]

    public constructor(
        tileSize: number,
        mapWidth: number,
        mapHeight: number,
        seed = 1337
    ) {
        this.tileSize = tileSize
        this.mapWidth = mapWidth
        this.mapHeight = mapHeight
        this.seed = seed
        this.random = seededRandom(seed)
        this.map = []

        // Two of each, around the middle so they're close to where you start
        const cx = mapWidth / 2
        const cy = mapHeight / 2
        const k = mapWidth / 1024
        this.realms = [
            {
                x: cx - 150 * k,
                y: cy + 40 * k,
                radius: 95 * k,
                kind: Region.Haunted,
            },
            {
                x: cx + 260 * k,
                y: cy - 210 * k,
                radius: 110 * k,
                kind: Region.Haunted,
            },
            {
                x: cx + 150 * k,
                y: cy - 40 * k,
                radius: 85 * k,
                kind: Region.Fairy,
            },
            {
                x: cx - 240 * k,
                y: cy - 250 * k,
                radius: 95 * k,
                kind: Region.Fairy,
            },
        ]

        const field = this.elevationField()

        for (let y = 0; y < this.mapHeight; y++) {
            const row: Tile[] = []
            for (let x = 0; x < this.mapWidth; x++) {
                row.push(this.createTile(field, x, y))
            }
            this.map.push(row)
        }

        this.markShorelines()
        this.spawn = this.buildStructures()
        this.castShadows()
    }

    public HeightAt(x: number, y: number): number {
        return this.TileAt(x, y).elevation
    }

    public RegionAt(x: number, y: number): Region {
        return this.TileAt(x, y).region
    }

    public pick<T>(options: T[]): T {
        return options[Math.floor(this.random() * options.length)]
    }

    private TileAt(x: number, y: number): Tile {
        const tx = clamp(Math.round(x), 0, this.mapWidth - 1)
        const ty = clamp(Math.round(y), 0, this.mapHeight - 1)
        return this.map[ty][tx]
    }

    // Rolling land with ridged mountains rising out of the highest ground.
    // Value noise bunches up around 0.5, so sea level comes from the noise's own
    // distribution: the lowest 22% of the map is water, whatever the seed.
    private elevationField(): Float32Array {
        const { mapWidth, mapHeight } = this
        const noise = new Float32Array(mapWidth * mapHeight)
        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                noise[y * mapWidth + x] = fbm(x / 260, y / 260, this.seed, 6)
            }
        }

        const sorted = noise.slice().sort()
        const shore = sorted[Math.floor(sorted.length * 0.22)]
        const peak = sorted[Math.floor(sorted.length * 0.995)]

        const field = new Float32Array(mapWidth * mapHeight)
        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                const i = y * mapWidth + x
                const land = (noise[i] - shore) / (peak - shore)
                // Ridges only rise from high ground, so skip the noise everywhere else
                const highland = smoothstep(0.45, 0.95, land)
                const ridge =
                    highland > 0
                        ? 1 -
                          Math.abs(
                              fbm(x / 90, y / 90, this.seed + 50, 5) * 2 - 1
                          )
                        : 0
                field[i] = SEA_LEVEL + land * 24 + highland * ridge * ridge * 45
            }
        }
        return field
    }

    private createTile(field: Float32Array, x: number, y: number): Tile {
        const height = Math.floor(field[y * this.mapWidth + x])
        // Ragged biome edges: the tree line and snowline wander instead of following
        // a contour exactly
        const wander = (fbm(x / 24, y / 24, this.seed + 200, 2) - 0.5) * 8
        const biome =
            height < SEA_LEVEL + 2
                ? this.biomeFor(height)
                : this.biomeFor(Math.max(SEA_LEVEL + 1, height + wander))
        const tile = new Tile(
            this.pick(biome.chars),
            this.pick(biome.colors),
            Math.max(height, SEA_LEVEL),
            biome.side
        )

        if (height < SEA_LEVEL) {
            tile.liquid = true
            tile.detail = Detail.Water
            tile.density = biome === BIOMES.deepWater ? 2 : 3
            return tile
        }

        tile.elevation = field[y * this.mapWidth + x]
        const { gx, gy } = this.gradient(field, x, y)
        tile.gx = gx
        tile.gy = gy
        tile.light = 0.92 + this.random() * 0.12

        // Detail density follows the land: lush where it's wet, sparse where it's steep
        const steep = smoothstep(0.6, 2.0, this.slope(field, x, y))
        const moisture = fbm(x / 150, y / 150, this.seed + 100, 3)
        if (biome === BIOMES.grass) {
            tile.region = this.realmAt(x, y)
            this.plantGrassland(tile, x, y, moisture, steep)
        } else if (biome === BIOMES.sand) {
            tile.detail = Detail.Sand
            tile.density = 3
        } else if (biome === BIOMES.rock) {
            // Mountainsides are rock faces: the steeper, the more broken stone
            tile.detail = Detail.Rock
            tile.density = 7 + Math.round(steep)
            if (
                height <= SEA_LEVEL + 28 &&
                this.random() < smoothstep(0.45, 0.6, moisture) * 0.25
            ) {
                this.sow(tile, Plant.Pine)
            } else if (this.random() < 0.0025) {
                tile.props = this.crystal(x, y, tile.elevation)
            } else if (this.random() < 0.03) {
                tile.props = this.boulder(BOULDER)
            }
        } else {
            tile.detail = Detail.Snow
            tile.density = BLADES_PER_TILE
            if (this.random() < 0.025) tile.props = this.boulder(ICE)
        }
        return tile
    }

    // Meadows and woods, in the manner of whichever realm they're in
    private plantGrassland(
        tile: Tile,
        x: number,
        y: number,
        moisture: number,
        steep: number
    ) {
        const roll = this.random()

        // Dense, dark, and watching you
        if (tile.region === Region.Haunted) {
            tile.detail = Detail.Haunted
            tile.density = 6
            tile.light *= 0.6
            if (roll < 0.5) {
                this.sow(tile, this.random() < 0.3 ? Plant.Dead : Plant.Gloom)
            } else if (roll < 0.515) {
                tile.props = [
                    {
                        char: '¨',
                        color: '#ff2a2a',
                        blink: true,
                        lift: 1 + this.random(),
                        size: 1,
                    },
                ]
            }
            return
        }

        // Pastel trees, glowing toadstools, glittering grass
        if (tile.region === Region.Fairy) {
            tile.detail = Detail.Fairy
            tile.density = 7
            if (roll < 0.2) {
                this.sow(tile, Plant.Fairy)
            } else if (roll < 0.24) {
                this.sow(tile, Plant.Mushroom)
                if (this.random() < 0.25) {
                    this.lights.push({
                        position: new Vector3(x, y, tile.elevation + 1.5),
                        color: mushroomCap(tile.plantSeed),
                        radius: 7,
                        intensity: 1,
                        pulse: 1.3,
                    })
                }
            }
            return
        }

        const lush = smoothstep(0.35, 0.7, moisture)
        tile.detail = Detail.Grass
        tile.density = Math.round(4 + 4 * lush - 3 * steep)
        if (roll < smoothstep(0.5, 0.66, moisture) * 0.45) {
            this.sow(tile, Plant.Broadleaf)
            tile.detail = Detail.Forest
            tile.density = 6
        }
    }

    // Plants are stored as a kind and a seed and only grown into glyphs when the
    // renderer builds the map: a forest of leaf objects would take hundreds of
    // megabytes, and the same seed always grows the same tree
    private sow(tile: Tile, plant: Plant) {
        tile.plant = plant
        tile.plantSeed = Math.floor(this.random() * 2 ** 31)
    }

    // Which realm a spot is in, with wobbly edges
    private realmAt(x: number, y: number): Region {
        const wobble = (fbm(x / 40, y / 40, this.seed + 300, 3) - 0.5) * 60
        for (const realm of this.realms) {
            const distance = Math.hypot(x - realm.x, y - realm.y)
            if (distance + wobble < realm.radius) return realm.kind
        }
        return Region.Wild
    }

    // Water that touches land foams; sand that touches water gets washed-up debris
    private markShorelines() {
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const tile = this.map[y][x]
                const neighbours = [
                    this.map[y - 1]?.[x],
                    this.map[y + 1]?.[x],
                    this.map[y]?.[x - 1],
                    this.map[y]?.[x + 1],
                ]
                const touches = (liquid: boolean) =>
                    neighbours.some((n) => n && n.liquid === liquid)
                if (tile.liquid && touches(false)) {
                    tile.detail = Detail.Shore
                    tile.density = 5
                } else if (tile.detail === Detail.Sand && touches(true)) {
                    tile.density = 6
                }
            }
        }
    }

    private biomeFor(height: number): Biome {
        if (height < SEA_LEVEL - 2) return BIOMES.deepWater
        if (height < SEA_LEVEL) return BIOMES.water
        if (height <= SEA_LEVEL) return BIOMES.sand
        if (height <= SEA_LEVEL + 20) return BIOMES.grass
        if (height <= SEA_LEVEL + 36) return BIOMES.rock
        return BIOMES.snow
    }

    private gradient(field: Float32Array, x: number, y: number) {
        const at = (sx: number, sy: number) =>
            field[
                clamp(sy, 0, this.mapHeight - 1) * this.mapWidth +
                    clamp(sx, 0, this.mapWidth - 1)
            ]
        return {
            gx: (at(x + 1, y) - at(x - 1, y)) / 2,
            gy: (at(x, y + 1) - at(x, y - 1)) / 2,
        }
    }

    // Rise per tile
    private slope(field: Float32Array, x: number, y: number): number {
        const { gx, gy } = this.gradient(field, x, y)
        return Math.hypot(gx, gy)
    }

    // A lone crag of rock or ice
    private boulder(colors: string[]): Prop[] {
        const s = 0.7 + this.random() * 0.45
        return [
            {
                char: '▲',
                color: this.pick(colors),
                lift: 0.35 * s,
                size: 1.2 * s,
            },
        ]
    }

    // A glowing crystal outcrop that lights the rock around it
    private crystal(x: number, y: number, elevation: number): Prop[] {
        const color = this.pick(CRYSTAL)
        this.lights.push({
            position: new Vector3(x, y, elevation + 1),
            color,
            radius: 9,
            intensity: 1,
            pulse: 1.5 + this.random(),
        })
        return [{ char: '◆', color, glow: true, lift: 0.6, size: 0.9 }]
    }

    // Darken the ground around trees and walls so they stand on it rather than
    // float over it. Dense forest floors end up much darker than open meadow.
    private castShadows() {
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const tile = this.map[y][x]
                const standing =
                    tile.stack.length + tile.props.length + tile.plant
                if (standing === 0) continue
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const near = this.map[y + dy]?.[x + dx]
                        if (near) near.shadow = Math.max(0.3, near.shadow * 0.8)
                    }
                }
            }
        }
    }

    // The home castle near the middle (you start at its gate), more castles across
    // the lowlands, ruined keeps, watchtowers on the heights, graveyards in the
    // haunted woods and fairy rings in the fairy ones. Returns the spawn point.
    private buildStructures(): Vector3 {
        const home = this.findSite(CASTLE_SIZE + 7, 5)
        castle(this, home.x, home.y, CASTLE_SIZE)

        const sites = [{ ...home, radius: CASTLE_SIZE + 8 }]
        const place = (
            count: number,
            radius: number,
            fits: (x: number, y: number) => boolean,
            build: (x: number, y: number) => void
        ) => {
            for (
                let built = 0, tries = 0;
                built < count && tries < 6000;
                tries++
            ) {
                const margin = radius + 8
                const x =
                    margin +
                    Math.floor(this.random() * (this.mapWidth - 2 * margin))
                const y =
                    margin +
                    Math.floor(this.random() * (this.mapHeight - 2 * margin))
                const clear = sites.every(
                    (s) => Math.hypot(s.x - x, s.y - y) > s.radius + radius + 12
                )
                if (!clear || !fits(x, y)) continue
                build(x, y)
                sites.push({ x, y, radius })
                built++
            }
        }

        place(
            2,
            CASTLE_SIZE + 7,
            (x, y) => this.isBuildable(x, y, CASTLE_SIZE + 7, 5),
            (x, y) => castle(this, x, y, CASTLE_SIZE)
        )
        place(
            8,
            7,
            (x, y) => this.isBuildable(x, y, 7, 3),
            (x, y) => ruin(this, x, y, 3 + Math.floor(this.random() * 3))
        )
        place(
            20,
            2,
            (x, y) =>
                !this.map[y][x].liquid &&
                this.map[y][x].height >= SEA_LEVEL + 14,
            (x, y) => watchtower(this, x, y, 12 + Math.floor(this.random() * 8))
        )
        place(
            6,
            7,
            (x, y) =>
                this.map[y][x].region === Region.Haunted &&
                this.isBuildable(x, y, 6, 3),
            (x, y) => graveyard(this, x, y)
        )
        place(
            8,
            6,
            (x, y) =>
                this.map[y][x].region === Region.Fairy &&
                this.isBuildable(x, y, 5, 3),
            (x, y) => fairyRing(this, x, y)
        )

        // Just beyond the bridge, facing the gate
        const spawn = { x: home.x, y: home.y + CASTLE_SIZE + 9 }
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                clear(this.map[spawn.y + dy][spawn.x + dx])
            }
        }
        return new Vector3(
            spawn.x,
            spawn.y,
            this.map[spawn.y][spawn.x].elevation
        )
    }

    // Spiral out from the centre until a site fits
    private findSite(
        radius: number,
        tolerance: number
    ): { x: number; y: number } {
        const cx = Math.floor(this.mapWidth / 2)
        const cy = Math.floor(this.mapHeight / 2)
        for (let ring = 0; ring < this.mapWidth / 2 - radius; ring += 3) {
            for (let dy = -ring; dy <= ring; dy += 3) {
                for (let dx = -ring; dx <= ring; dx += 3) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue
                    if (this.isBuildable(cx + dx, cy + dy, radius, tolerance)) {
                        return { x: cx + dx, y: cy + dy }
                    }
                }
            }
        }
        return { x: cx, y: cy }
    }

    // Dry, above the beach, and close enough to level (sampled, not every tile)
    private isBuildable(
        x: number,
        y: number,
        radius: number,
        tolerance: number
    ): boolean {
        let min = Infinity
        let max = -Infinity
        for (let dy = -radius; dy <= radius; dy += 3) {
            for (let dx = -radius; dx <= radius; dx += 3) {
                const tile = this.map[y + dy]?.[x + dx]
                if (!tile || tile.liquid) return false
                min = Math.min(min, tile.height)
                max = Math.max(max, tile.height)
            }
        }
        return min >= SEA_LEVEL + 2 && max - min <= tolerance
    }
}
