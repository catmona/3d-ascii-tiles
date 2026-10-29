import { Vector3 } from '../core/Types'
import { MUSHROOM_CAPS } from './flora'
import { Light } from './Lighting'
import { Detail, Glyph, Plant, Prop, Tile } from './Tile'

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
// north-east corner, torches by the door and a campfire in the yard
export function ruin(world: World, cx: number, cy: number, radius: number) {
    clearSite(world, cx, cy, radius + 2, (tile, dx, dy) => {
        const edge = Math.max(Math.abs(dx), Math.abs(dy))
        if (edge > radius) {
            tile.density = Math.min(tile.density, 2)
        } else if (edge < radius) {
            tile.char = world.pick(['.', ',', '·'])
            tile.color = world.pick(['#7d776c', '#6f695f'])
            tile.detail = Detail.Floor
            tile.density = 5
        } else if (!(dy === radius && Math.abs(dx) <= 1)) {
            const wall =
                world.random() < 0.15 ? 0 : 1 + Math.floor(world.random() * 3)
            tile.stack = Array.from({ length: wall }, () => stone(world))
        }
    })
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

// Rows of headstones and crosses in a clearing, a few guttering candles among them
export function graveyard(world: World, cx: number, cy: number) {
    for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -6; dx <= 6; dx++) {
            const tile = world.map[cy + dy]?.[cx + dx]
            if (!tile || tile.liquid) continue
            clear(tile)
            if (dy % 2 !== 0 || dx % 2 !== 0 || Math.abs(dy) > 3) continue
            if (world.random() < 0.15) continue
            tile.props = [
                {
                    char: world.random() < 0.6 ? '∩' : '†',
                    color: world.pick(GRAVESTONE),
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

// A ring of small glowing toadstools with a soft light hanging over the middle
export function fairyRing(world: World, cx: number, cy: number) {
    const cap = world.pick(MUSHROOM_CAPS)
    for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
            const tile = world.map[cy + dy]?.[cx + dx]
            if (tile) clear(tile)
        }
    }
    for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2
        const x = cx + Math.cos(angle) * 3.5
        const y = cy + Math.sin(angle) * 3.5
        const tile = world.map[Math.round(y)][Math.round(x)]
        tile.props = [
            ...tile.props,
            {
                char: '◓',
                color: cap,
                glow: true,
                lift: 0.35,
                dx: x - Math.round(x),
                dy: y - Math.round(y),
                size: 0.7,
            },
        ]
    }
    const centre = world.map[cy][cx]
    centre.props = [
        { char: '*', color: '#ffffff', glow: true, lift: 1.6, size: 0.8 },
    ]
    world.lights.push({
        position: new Vector3(cx, cy, centre.elevation + 1.6),
        color: cap,
        radius: 10,
        intensity: 1.1,
        pulse: 1,
    })
}
