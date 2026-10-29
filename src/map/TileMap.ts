// Planting walks cumulative odds, `roll < (odds += p)`: the same condition text, but
// a different threshold every time, which this rule can't tell apart
/* eslint-disable no-dupe-else-if */
import { Vector3 } from '../core/Types'
import { clamp, fbm, seededRandom, smoothstep, valueNoise } from '../utils/Math'
import { canopy, mushroomCap } from './flora'
import { Light } from './Lighting'
import { Stone } from './stones'
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
import {
    BushKind,
    FAIRY_FLOWERS,
    FungusKind,
    TOADSTOOLS,
    WILD_FLOWERS,
} from './undergrowth'

const SEA_LEVEL = 5
const BLADES_PER_TILE = 8 // the most detail glyphs a tile can have
const CASTLE_SIZE = 15 // half the width of a castle's curtain wall
const SHORE_REACH = 2 // how far from the water reeds, willows and lilies grow

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

const CRYSTAL = ['#45f0d8', '#c36bff']

// What the land is like where something might grow
type Site = {
    x: number
    y: number
    moisture: number
    steep: number // 0 flat to 1 a cliff
    shore: number // tiles to the water's edge, 0 if it's further than SHORE_REACH
}

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
        // How close the water is (1 = next to it), for reeds, willows and lilies
        const shore =
            height <= SEA_LEVEL + 2 && biome !== BIOMES.deepWater
                ? this.shoreDistance(field, x, y)
                : 0

        if (height < SEA_LEVEL) {
            tile.liquid = true
            tile.detail = Detail.Water
            tile.density = biome === BIOMES.deepWater ? 2 : 3
            if (biome === BIOMES.water && shore > 0) {
                this.plantShallows(tile, x, y, shore)
            }
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
            const site = { x, y, moisture, steep, shore }
            if (tile.region === Region.Haunted) this.plantHaunted(tile, site)
            else if (tile.region === Region.Fairy) this.plantFairy(tile, site)
            else this.plantWild(tile, site)
        } else if (biome === BIOMES.sand) {
            this.plantBeach(tile, x, y, moisture, shore)
        } else if (biome === BIOMES.rock) {
            this.plantMountain(tile, x, y, moisture, steep)
        } else {
            tile.detail = Detail.Snow
            tile.density = BLADES_PER_TILE
            const roll = this.random()
            if (roll < 0.012) this.sow(tile, Plant.Boulder, Stone.Ice)
            else if (roll < 0.02 + 0.03 * steep) {
                this.sow(tile, Plant.Outcrop, Stone.Ice)
            }
        }
        return tile
    }

    // Lily pads on the still water just off the bank, reeds right against it
    private plantShallows(tile: Tile, x: number, y: number, shore: number) {
        const roll = this.random()
        if (shore === 1 && roll < 0.08) {
            this.sow(tile, Plant.Reeds)
        } else if (
            roll < 0.35 &&
            valueNoise(x / 9, y / 9, this.seed + 800) > 0.6
        ) {
            this.sow(tile, Plant.LilyPads)
        }
    }

    // Sand, or shingle in places, with reeds in the damp spots and driftwood
    private plantBeach(
        tile: Tile,
        x: number,
        y: number,
        moisture: number,
        shore: number
    ) {
        tile.detail = Detail.Sand
        tile.density = 3
        if (valueNoise(x / 30, y / 30, this.seed + 700) > 0.62) {
            tile.detail = Detail.Pebbles
            tile.density = 5
        }
        const roll = this.random()
        if (shore > 0 && moisture > 0.5 && roll < 0.2) {
            this.sow(tile, Plant.Reeds)
        } else if (roll < 0.004) {
            this.sow(tile, Plant.Log, 1) // bleached driftwood
        } else if (roll < 0.012) {
            this.sow(tile, Plant.Rocks, Stone.Grey)
        }
    }

    // Mountainsides are rock faces: the steeper, the more broken stone. Pines
    // climb the wetter slopes, snow on their shoulders up high.
    private plantMountain(
        tile: Tile,
        x: number,
        y: number,
        moisture: number,
        steep: number
    ) {
        tile.detail = steep > 0.7 ? Detail.Scree : Detail.Rock
        tile.density = 7 + Math.round(steep)
        const roll = this.random()
        let odds = 0
        if (
            tile.height <= SEA_LEVEL + 28 &&
            roll < (odds += smoothstep(0.45, 0.6, moisture) * 0.25)
        ) {
            this.sow(tile, Plant.Pine, tile.height > SEA_LEVEL + 23 ? 1 : 0)
        } else if (roll < (odds += 0.0025)) {
            tile.props = this.crystal(x, y, tile.elevation)
        } else if (roll < (odds += 0.012)) {
            this.sow(tile, Plant.Boulder, Stone.Grey)
        } else if (roll < (odds += 0.006 + 0.03 * steep)) {
            this.sow(tile, Plant.Outcrop, Stone.Grey)
        } else if (roll < (odds += 0.015)) {
            this.sow(tile, Plant.Rocks, Stone.Grey)
        }
    }

    // Woods of several kinds of tree with ferns, moss and fallen logs beneath;
    // meadows with drifts of flowers and long grass, thickets at the wood's edge,
    // reeds and willows by the water, crags breaking out of steep hillsides
    private plantWild(tile: Tile, site: Site) {
        const { x, y, moisture, steep, shore } = site
        const lush = smoothstep(0.35, 0.7, moisture)
        const woods = smoothstep(0.5, 0.66, moisture)
        // Drifts and clearings, smaller than the woods themselves
        const patch = fbm(x / 26, y / 26, this.seed + 500, 2)
        tile.detail = Detail.Grass
        tile.density = Math.round(4 + 4 * lush - 3 * steep)
        if (steep > 0.5 && patch < 0.45) {
            tile.detail = Detail.Scree
            tile.density = 5
        }

        const roll = this.random()
        if (roll < woods * 0.45 * (1 - 0.5 * steep)) {
            this.sow(tile, this.treeFor(tile, x, y, shore))
            tile.detail =
                moisture > 0.6 && patch > 0.45 ? Detail.Moss : Detail.Forest
            tile.density = 6
            return
        }

        let odds = 0
        if (woods > 0.45) {
            // The forest floor between the trees
            tile.detail =
                moisture > 0.6 && patch > 0.45 ? Detail.Moss : Detail.Forest
            tile.density = 6
            const under = this.random()
            if (under < (odds += 0.08 * lush)) this.sow(tile, Plant.Fern)
            else if (under < (odds += 0.03)) {
                this.sow(tile, Plant.Bush, this.random() < 0.3 ? 1 : 0)
            } else if (under < (odds += 0.015)) {
                this.sow(tile, Plant.Fungus, FungusKind.Forest)
            } else if (under < (odds += 0.015)) this.sow(tile, Plant.Sapling)
            else if (under < (odds += 0.007)) this.sow(tile, Plant.Stump)
            else if (under < (odds += 0.006)) this.sow(tile, Plant.Log)
            else if (under < (odds += 0.006)) {
                this.sow(tile, Plant.Boulder, Stone.Mossy)
            }
            return
        }

        // Thickets and saplings where the meadow meets the wood
        const edge = smoothstep(0.08, 0.25, woods)
        if (shore === 1 && roll < (odds += 0.3)) {
            this.sow(tile, Plant.Reeds)
        } else if (shore > 0 && roll < (odds += 0.025)) {
            this.sow(tile, Plant.Willow)
        } else if (patch > 0.6 && roll < (odds += 0.3)) {
            // Each drift is all one kind of flower
            const kind = Math.floor(
                valueNoise(x / 14, y / 14, this.seed + 600) * WILD_FLOWERS
            )
            this.sow(tile, Plant.Flowers, kind)
        } else if (
            roll < (odds += 0.012 + 0.06 * lush * smoothstep(0.45, 0.6, patch))
        ) {
            this.sow(tile, Plant.TallGrass)
        } else if (roll < (odds += 0.006 + 0.05 * edge)) {
            this.sow(tile, Plant.Bush, this.bushFor(lush))
        } else if (roll < (odds += 0.002 + 0.03 * edge)) {
            this.sow(tile, Plant.Sapling)
        } else if (roll < (odds += 0.003)) {
            // A lone tree out in the open
            const lone = this.random()
            this.sow(
                tile,
                lone < 0.4
                    ? Plant.Broadleaf
                    : lone < 0.7
                      ? Plant.Oak
                      : Plant.Poplar
            )
        } else if (roll < (odds += 0.004)) {
            this.sow(tile, Plant.Rocks, lush > 0.5 ? Stone.Mossy : Stone.Grey)
        } else if (roll < (odds += 0.0015)) {
            this.sow(tile, Plant.Boulder, lush > 0.5 ? Stone.Mossy : Stone.Grey)
        } else if (roll < (odds += 0.06 * steep)) {
            this.sow(tile, Plant.Outcrop, Stone.Grey)
        }
    }

    // Which tree grows in a wood: pines toward the tree line, willows by the
    // water, and woods that are mostly birch, mostly oak, or mixed
    private treeFor(tile: Tile, x: number, y: number, shore: number): Plant {
        const kind = valueNoise(x / 70, y / 70, this.seed + 400)
        const high = smoothstep(SEA_LEVEL + 11, SEA_LEVEL + 18, tile.height)
        const roll = this.random()
        if (roll < high * 0.8) return Plant.Pine
        if (shore > 0 && roll < 0.3) return Plant.Willow
        if (kind < 0.32) return roll < 0.75 ? Plant.Birch : Plant.Broadleaf
        if (kind > 0.68) return roll < 0.25 ? Plant.Oak : Plant.Broadleaf
        if (roll < 0.05) return Plant.Oak
        if (roll < 0.12) return Plant.Birch
        if (roll < 0.15) return Plant.Poplar
        return Plant.Broadleaf
    }

    private bushFor(lush: number): BushKind {
        const roll = this.random()
        if (roll < 0.25) return BushKind.Berries
        if (roll < 0.45) return BushKind.Blossom
        if (lush < 0.4 && roll < 0.75) return BushKind.Gorse
        return BushKind.Green
    }

    // Dense, dark, and watching you: gloom trees and dead ones, brambles, pale
    // toadstools, the odd skull
    private plantHaunted(tile: Tile, site: Site) {
        tile.detail = Detail.Haunted
        tile.density = 6
        tile.light *= 0.6
        const roll = this.random()
        let odds = 0
        if (roll < (odds += 0.45)) {
            this.sow(tile, this.random() < 0.3 ? Plant.Dead : Plant.Gloom)
        } else if (roll < (odds += 0.06)) {
            this.sow(tile, Plant.Bramble)
        } else if (roll < (odds += 0.015)) {
            tile.props = [
                {
                    char: '¨',
                    color: '#ff2a2a',
                    blink: true,
                    lift: 1 + this.random(),
                    size: 1,
                },
            ]
        } else if (roll < (odds += 0.01)) {
            this.sow(tile, Plant.Fungus, FungusKind.Haunted)
        } else if (roll < (odds += 0.004)) {
            this.sow(tile, Plant.Poplar, 1) // a black cypress
        } else if (roll < (odds += 0.004)) {
            this.sow(tile, this.random() < 0.5 ? Plant.Stump : Plant.Log, 1)
        } else if (roll < (odds += 0.004)) {
            this.sow(tile, Plant.Boulder, Stone.Haunted)
        } else if (roll < (odds += 0.0025 * (1 + site.steep))) {
            this.sow(tile, Plant.Bones)
        }
    }

    // Groves of pastel trees around flower meadows, giant toadstools, and a few
    // things that shine: lanterns in the trees, crystal flowers, spotted caps
    private plantFairy(tile: Tile, site: Site) {
        const { x, y } = site
        tile.detail = Detail.Fairy
        tile.density = 7
        const grove = fbm(x / 26, y / 26, this.seed + 500, 2) > 0.52
        const roll = this.random()
        let odds = 0
        if (roll < (odds += grove ? 0.2 : 0.02)) {
            // Each grove mostly one colour, so the realm reads as patches of
            // pink, lilac, mint and peach rather than confetti
            const colour = Math.floor(
                valueNoise(x / 40, y / 40, this.seed + 900) * 4
            )
            if (this.random() < 0.92) this.sow(tile, Plant.Fairy, colour)
            else this.sow(tile, Plant.Willow, 1 + colour)
        } else if (roll < (odds += 0.01)) {
            this.sow(
                tile,
                Plant.Toadstool,
                Math.floor(this.random() * TOADSTOOLS.length)
            )
            if (this.random() < 0.25) {
                this.lights.push({
                    position: new Vector3(x, y, tile.elevation + 1.5),
                    color: mushroomCap(tile.plantSeed),
                    radius: 7,
                    intensity: 1,
                    pulse: 1.3,
                })
            }
        } else if (roll < (odds += 0.015)) {
            this.sow(tile, Plant.Fungus, FungusKind.Fairy)
        } else if (roll < (odds += grove ? 0.03 : 0.22)) {
            const drift = valueNoise(x / 12, y / 12, this.seed + 600)
            const kind = FAIRY_FLOWERS[Math.floor(drift * FAIRY_FLOWERS.length)]
            this.sow(tile, Plant.Flowers, kind)
        } else if (roll < (odds += 0.004)) {
            this.sow(tile, Plant.CrystalFlowers)
            if (this.random() < 0.3) {
                this.lights.push({
                    position: new Vector3(x, y, tile.elevation + 0.8),
                    color: '#a8e8ff',
                    radius: 5,
                    intensity: 0.8,
                    pulse: 2,
                })
            }
        } else if (roll < (odds += 0.015)) {
            this.sow(tile, Plant.Bush, BushKind.Fairy)
        } else if (roll < (odds += 0.012)) {
            this.sow(tile, Plant.Fern)
        }
    }

    // Plants are stored as a kind and a seed and only grown into glyphs when the
    // renderer builds the map: a forest of leaf objects would take hundreds of
    // megabytes, and the same seed always grows the same tree. The seed's low
    // three bits carry the variant (a palette, a mossy stone...).
    private sow(tile: Tile, plant: Plant, variant = 0) {
        tile.plant = plant
        tile.plantSeed = Math.floor(this.random() * 2 ** 28) * 8 + variant
    }

    // Distance to the nearest water, up to SHORE_REACH; 0 if there's none that close
    private shoreDistance(field: Float32Array, x: number, y: number): number {
        const wet = field[y * this.mapWidth + x] < SEA_LEVEL
        let nearest = 0
        for (let dy = -SHORE_REACH; dy <= SHORE_REACH; dy++) {
            const sy = y + dy
            if (sy < 0 || sy >= this.mapHeight) continue
            for (let dx = -SHORE_REACH; dx <= SHORE_REACH; dx++) {
                const sx = x + dx
                if (sx < 0 || sx >= this.mapWidth) continue
                // Land looks for water; water looks for land
                if (field[sy * this.mapWidth + sx] < SEA_LEVEL === wet) continue
                const d = Math.max(Math.abs(dx), Math.abs(dy))
                if (nearest === 0 || d < nearest) nearest = d
            }
        }
        return nearest
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
    // float over it. Dense forest floors end up much darker than open meadow;
    // flowers and grass cast nothing.
    private castShadows() {
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const tile = this.map[y][x]
                const shade =
                    tile.stack.length + tile.props.length > 0
                        ? 0.8
                        : canopy(tile.plant)
                if (shade === 1) continue
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const near = this.map[y + dy]?.[x + dx]
                        if (near)
                            near.shadow = Math.max(0.3, near.shadow * shade)
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
