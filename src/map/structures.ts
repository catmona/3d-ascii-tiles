import { Vector3 } from '../core/Types'
import { Light } from './Lighting'
import { Stone } from './stones'
import { Detail, Glyph, Plant, Prop, Tile } from './Tile'
import { FAIRY_FLOWERS, TOADSTOOLS, tinyToadstool } from './undergrowth'

// What the builders need from the map
export interface World {
    map: Tile[][]
    lights: Light[]
    random: () => number
    pick<T>(options: T[]): T
}

const STONE = ['#d8d0c0', '#c4bba8', '#e6dfd0']
const GRAVESTONE = ['#8a8494', '#767080', '#9a94a4']
const WINDOW = '#ffc864'
// Roof tiles from shadow to sunlit
const ROOFS = [
    ['#5a1a26', '#8a2436', '#b83248'],
    ['#1a2a5a', '#25408a', '#3a5ab8'],
    ['#2a2a3a', '#3e3e56', '#5a5a78'],
]
const BANNERS = ['#e03a4a', '#3a6ae0', '#e0b83a', '#9a3ae0']
const BEACONS = ['#8f7bff', '#3ad6ff']
const IVY = ['#1e4a24', '#2a6230', '#3a7a3a', '#4e9448']
const MOSSY_GRAVESTONE = ['#7a8a72', '#6a7a64']

// Oversized so the courses of a wall overlap into solid masonry
function stone(world: World): Glyph {
    return { char: '#', color: world.pick(STONE), size: 1.3 }
}

function candlelitWindow(): Glyph {
    return { char: '▪', color: WINDOW, glow: true, size: 1.1 }
}

// Remove whatever stands on a tile: props and plants
export function clear(tile: Tile) {
    tile.props = []
    tile.plant = Plant.None
}

// Grow something on a tile (see TileMap.sow: the seed's low bits are the variant)
function plant(world: World, tile: Tile, kind: Plant, variant = 0) {
    tile.plant = kind
    tile.plantSeed = Math.floor(world.random() * 2 ** 28) * 8 + variant
}

// Moss creeps out over the ground at the foot of old walls
function moss(tile: Tile | undefined, density = 5) {
    if (!tile || tile.liquid || tile.stack.length > 0) return
    tile.detail = Detail.Moss
    tile.density = density
}

// Ivy climbing the outer face of a wall: a few leaves held just off the stones,
// on the side facing (nx, ny)
function ivy(world: World, tile: Tile, nx: number, ny: number) {
    const reach = Math.min(tile.stack.length, 4)
    const leaves: Prop[] = []
    for (let i = 0; i < 2 + reach; i++) {
        leaves.push({
            char: world.pick(['♣', '♠', '♣']),
            color: world.pick(IVY),
            lift: 0.6 + world.random() * reach,
            dx: nx * 0.6 + (world.random() - 0.5) * 0.8 * Math.abs(ny),
            dy: ny * 0.6 + (world.random() - 0.5) * 0.8 * Math.abs(nx),
            size: 0.45 + world.random() * 0.25,
            shade: 0.85,
        })
    }
    tile.props = [...tile.props, ...leaves]
}

// Which way a wall tile on the edge of a square faces outward
function outward(dx: number, dy: number): [number, number] {
    return Math.abs(dx) >= Math.abs(dy)
        ? [Math.sign(dx), 0]
        : [0, Math.sign(dy)]
}

// Flatten a square around a point to one height and clear whatever stood there
function clearSite(
    world: World,
    cx: number,
    cy: number,
    reach: number,
    each?: (tile: Tile, dx: number, dy: number) => void
) {
    const { height, elevation } = world.map[cy][cx]
    for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
            const tile = world.map[cy + dy]?.[cx + dx]
            if (!tile) continue
            tile.height = height
            tile.elevation = elevation
            tile.stack = []
            clear(tile)
            each?.(tile, dx, dy)
        }
    }
}

// A torch on a pole or a wall top, and the light it throws
function torch(world: World, x: number, y: number, tile: Tile, lift: number) {
    tile.props = [{ char: '!', color: '#ffc36b', glow: true, lift, size: 1.1 }]
    world.lights.push({
        position: new Vector3(x, y, tile.elevation + lift + 0.5),
        color: '#ff9a3c',
        radius: 10,
        intensity: 1.2,
        flicker: 0.7,
    })
}

function fire(world: World, x: number, y: number, size = 1.4) {
    const tile = world.map[y][x]
    tile.props = [{ char: '^', color: '#ff7b2e', glow: true, lift: 0.6, size }]
    world.lights.push({
        position: new Vector3(x, y, tile.elevation + 1.2),
        color: '#ff6a1f',
        radius: 12 + size * 3,
        intensity: 1.6,
        flicker: 1,
    })
}

// A round tower: a ring of wall with candlelit windows, under a pointed roof of
// shrinking tiers topped by a pennant
export function roundTower(
    world: World,
    cx: number,
    cy: number,
    radius: number,
    levels: number,
    roof: string[]
) {
    const reach = Math.ceil(radius)
    for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
            const distance = Math.hypot(dx, dy)
            if (distance > radius + 0.5) continue
            const tile = world.map[cy + dy][cx + dx]
            tile.height = world.map[cy][cx].height
            tile.elevation = world.map[cy][cx].elevation
            tile.detail = Detail.None
            clear(tile)
            tile.stack = []
            if (distance < radius - 0.5) continue // hollow inside
            tile.stack = Array.from({ length: levels }, (_, level) =>
                level % 4 === 2 && world.random() < 0.6
                    ? candlelitWindow()
                    : stone(world)
            )
        }
    }

    const top = levels + 0.4
    const step = radius * 0.6
    const spire: Prop[] = [0, 1, 2, 3].map((tier) => ({
        char: '▲',
        color: roof[Math.min(roof.length - 1, tier)],
        lift: top + tier * step,
        size: (2 * radius + 1.8) * (1 - tier * 0.24),
        shade: 0.85 + tier * 0.08,
    }))
    const peak = top + 4 * step
    spire.push(
        { char: '|', color: '#8a8070', lift: peak, size: 0.9 },
        {
            char: '►',
            color: world.pick(BANNERS),
            lift: peak + 0.5,
            dx: 0.35,
            size: 0.9,
        }
    )
    world.map[cy][cx].props = spire
}

// A fairy-tale castle: a moat with a bridge, a crenellated curtain wall lined with
// torches, roofed towers at the corners and either side of the gate, a tall keep
// in the middle and braziers burning in the courtyard. The gate faces south.
export function castle(world: World, cx: number, cy: number, size: number) {
    const moat = size + 4
    const { elevation, height } = world.map[cy][cx]

    clearSite(world, cx, cy, moat + 2, (tile, dx, dy) => {
        const edge = Math.max(Math.abs(dx), Math.abs(dy))
        const onBridge = dy > 0 && Math.abs(dx) <= 1
        if (edge >= moat - 1 && edge <= moat && !onBridge) {
            tile.liquid = true
            tile.char = '~'
            tile.color = '#2f7cc4'
            tile.height = height - 1
            tile.elevation = elevation - 0.9
            tile.detail = Detail.Water
            tile.density = 3
            if (world.random() < 0.08) plant(world, tile, Plant.LilyPads)
        } else if (edge >= moat - 1 && edge <= moat) {
            tile.char = '='
            tile.color = '#8a6440'
            tile.detail = Detail.None
        } else if (edge < size) {
            tile.char = world.pick(['.', ',', '·'])
            tile.color = '#8d877b'
            tile.detail = Detail.Floor
            tile.density = 4
        } else if (edge === size && !(dy === size && Math.abs(dx) <= 1)) {
            // Merlons on every other stone along the top
            const merlon = (dx + dy) % 2 === 0 ? 1 : 0
            tile.stack = Array.from({ length: 5 + merlon }, () => stone(world))
        } else {
            tile.density = Math.min(tile.density, 2) // trampled
        }
    })

    // Moss along the foot of the curtain wall, inside and out, but not on the
    // way through the gate
    for (let t = -size - 1; t <= size + 1; t++) {
        for (const [x, y] of [
            [cx + t, cy - size - 1],
            [cx + t, cy - size + 1],
            [cx - size - 1, cy + t],
            [cx - size + 1, cy + t],
            [cx + size + 1, cy + t],
            [cx + size - 1, cy + t],
            [cx + t, cy + size + 1],
            [cx + t, cy + size - 1],
        ]) {
            if (Math.abs(x - cx) > 2 || y < cy + size - 1) {
                moss(world.map[y]?.[x], 4)
            }
        }
    }

    // Torches along the wall top, every six stones
    for (let t = -size + 3; t <= size - 3; t += 6) {
        const spots = [
            [cx + t, cy - size],
            [cx - size, cy + t],
            [cx + size, cy + t],
        ]
        if (Math.abs(t) > 3) spots.push([cx + t, cy + size])
        for (const [x, y] of spots) {
            const tile = world.map[y][x]
            torch(world, x, y, tile, tile.stack.length + 0.9)
        }
    }

    const roof = world.pick(ROOFS)
    for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
            roundTower(world, cx + sx * size, cy + sy * size, 2.5, 14, roof)
        }
        roundTower(world, cx + sx * 3, cy + size, 1.8, 9, roof)
        const x = cx + sx * 2
        torch(world, x, cy + size + 2, world.map[cy + size + 2][x], 1.4)
    }
    roundTower(world, cx, cy - 2, 4, 22, roof)

    // A little ivy on the outside of the curtain wall
    for (let t = -size + 3; t <= size - 3; t++) {
        for (const [dx, dy] of [
            [t, -size],
            [-size, t],
            [size, t],
            [t, size],
        ]) {
            const tile = world.map[cy + dy][cx + dx]
            if (tile.stack.length < 5 || world.random() > 0.12) continue
            ivy(world, tile, ...outward(dx, dy))
        }
    }

    for (const [bx, by] of [
        [cx - 6, cy + 6],
        [cx + 6, cy + 6],
        [cx - 7, cy - 7],
        [cx + 7, cy - 7],
    ]) {
        fire(world, bx, by, 1.1)
    }
}

// A ruined keep: crumbling walls with a door on the south side, a tower on the
// north-east corner, torches by the door and a campfire in the yard. Moss has
// crept over the ground along the walls, ivy up them, and fallen stones lie about.
export function ruin(world: World, cx: number, cy: number, radius: number) {
    clearSite(world, cx, cy, radius + 2, (tile, dx, dy) => {
        const edge = Math.max(Math.abs(dx), Math.abs(dy))
        if (edge > radius) {
            tile.density = Math.min(tile.density, 2)
            if (world.random() < 0.12) {
                plant(
                    world,
                    tile,
                    Plant.Rocks,
                    world.pick([Stone.Grey, Stone.Mossy])
                )
            }
        } else if (edge < radius) {
            tile.char = world.pick(['.', ',', '·'])
            tile.color = world.pick(['#7d776c', '#6f695f'])
            tile.detail = Detail.Floor
            tile.density = 5
            if (world.random() < 0.06)
                plant(world, tile, Plant.Rocks, Stone.Mossy)
        } else if (!(dy === radius && Math.abs(dx) <= 1)) {
            const wall =
                world.random() < 0.15 ? 0 : 1 + Math.floor(world.random() * 3)
            tile.stack = Array.from({ length: wall }, () => stone(world))
            if (wall === 0) plant(world, tile, Plant.Rocks, Stone.Mossy)
        }
    })
    for (let dy = -radius - 1; dy <= radius + 1; dy++) {
        for (let dx = -radius - 1; dx <= radius + 1; dx++) {
            const edge = Math.max(Math.abs(dx), Math.abs(dy))
            const tile = world.map[cy + dy]?.[cx + dx]
            if (!tile) continue
            if (edge === radius && tile.stack.length > 0) {
                if (world.random() < 0.4) ivy(world, tile, ...outward(dx, dy))
            } else if (edge >= radius - 1 && tile.plant === Plant.None) {
                moss(tile, edge < radius ? 6 : 5)
            }
        }
    }
    watchtower(world, cx + radius, cy - radius, 10)
    for (const dx of [-2, 2]) {
        const tile = world.map[cy + radius][cx + dx]
        torch(world, cx + dx, cy + radius, tile, tile.stack.length + 0.9)
    }
    fire(world, cx, cy)
}

// A hollow 3×3 ring of stone with a crenellated top, lit windows, and a beacon
// burning on top
export function watchtower(
    world: World,
    cx: number,
    cy: number,
    levels: number
) {
    clearSite(world, cx, cy, 1, (tile, dx, dy) => {
        tile.detail = Detail.None
        if (dx === 0 && dy === 0) return
        const wall = (dx + dy) % 2 === 0 ? levels : levels - 1
        const side = dx === 0 || dy === 0
        tile.stack = Array.from({ length: wall }, (_, level) =>
            side && level % 4 === 2 ? candlelitWindow() : stone(world)
        )
    })
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) {
                moss(world.map[cy + dy]?.[cx + dx], 5)
            }
        }
    }
    const color = world.pick(BEACONS)
    const tile = world.map[cy][cx]
    tile.props = [
        { char: '*', color, glow: true, lift: levels + 0.5, size: 1.6 },
    ]
    world.lights.push({
        position: new Vector3(cx, cy, tile.elevation + levels + 1),
        color,
        radius: 26,
        intensity: 1.4,
        pulse: 1.2,
    })
}

// Rows of headstones and crosses in a clearing, some gone green with moss, a few
// guttering candles among them; brambles round the edge, and here and there
// bones that didn't stay buried
export function graveyard(world: World, cx: number, cy: number) {
    for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -6; dx <= 6; dx++) {
            const tile = world.map[cy + dy]?.[cx + dx]
            if (!tile || tile.liquid) continue
            clear(tile)
            if (Math.abs(dx) === 6 || Math.abs(dy) === 4) {
                if (world.random() < 0.3) plant(world, tile, Plant.Bramble)
                continue
            }
            if (dy % 2 !== 0 || dx % 2 !== 0 || Math.abs(dy) > 3) {
                if (world.random() < 0.02) plant(world, tile, Plant.Bones)
                continue
            }
            if (world.random() < 0.15) continue
            const mossy = world.random() < 0.35
            tile.props = [
                {
                    char: world.random() < 0.6 ? '∩' : '†',
                    color: world.pick(mossy ? MOSSY_GRAVESTONE : GRAVESTONE),
                    lift: 0.55,
                    dx: (world.random() - 0.5) * 0.4,
                    size: 1.1,
                },
            ]
            if (world.random() < 0.25) {
                tile.props.push({
                    char: '¡',
                    color: '#ffd27a',
                    glow: true,
                    lift: 0.3,
                    dx: 0.45,
                    size: 0.6,
                })
                world.lights.push({
                    position: new Vector3(
                        cx + dx + 0.45,
                        cy + dy,
                        tile.elevation + 0.8
                    ),
                    color: '#ffb35a',
                    radius: 5,
                    intensity: 0.8,
                    flicker: 0.9,
                })
            }
        }
    }
}

// A ring of small glowing toadstools around a patch of flowers, with a soft
// light hanging over the middle
export function fairyRing(world: World, cx: number, cy: number) {
    const ramp = world.pick(TOADSTOOLS)
    const flowers = world.pick(FAIRY_FLOWERS)
    for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
            const tile = world.map[cy + dy]?.[cx + dx]
            if (!tile) continue
            clear(tile)
            if (Math.hypot(dx, dy) < 2.5 && world.random() < 0.5) {
                plant(world, tile, Plant.Flowers, flowers)
            }
        }
    }
    for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2
        const x = cx + Math.cos(angle) * 3.5
        const y = cy + Math.sin(angle) * 3.5
        const tile = world.map[Math.round(y)][Math.round(x)]
        const size = 0.45 + world.random() * 0.2
        tile.props = [
            ...tile.props,
            ...tinyToadstool(
                ramp[2],
                size,
                x - Math.round(x),
                y - Math.round(y),
                true
            ),
        ]
    }
    const centre = world.map[cy][cx]
    centre.plant = Plant.None
    centre.props = [
        { char: '✦', color: '#fff4fc', glow: true, lift: 1.6, size: 0.7 },
    ]
    world.lights.push({
        position: new Vector3(cx, cy, centre.elevation + 1.6),
        color: ramp[3],
        radius: 10,
        intensity: 1.1,
        pulse: 1,
    })
}
