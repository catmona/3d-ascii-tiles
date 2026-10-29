import { clamp, seededRandom } from '../utils/Math'
import { Plant, Prop } from './Tile'

// Light comes from the north-west, 40° above the horizon
export const SUN = { x: -0.54, y: -0.54, z: 0.64 }

type Random = () => number

const pick = <T>(random: Random, options: T[]): T =>
    options[Math.floor(random() * options.length)]

// One hue from deep shadow to highlight. Leaves take their colour from it by how
// lit they are, so a crown is shaded even before any light falls on it.
type Ramp = string[]

const LEAVES: Ramp[] = [
    ['#0f4a30', '#17694a', '#1f8a5a', '#36b07a', '#5cd296'], // emerald
    ['#0f4446', '#166262', '#1f8080', '#33a39c', '#5cc4b8'], // teal
    ['#2a4a1a', '#3a6a24', '#4f8a2e', '#6aa63a', '#8cc45a'], // spring
]
const NEEDLES: Ramp = ['#0a3328', '#104536', '#1a6050', '#247a66', '#389680']
const GLOOM: Ramp = ['#0c0610', '#170c20', '#24122e', '#3a1638', '#5a1c3c']
const PASTELS: Ramp[] = [
    ['#7a3a6a', '#b0559a', '#e07ac4', '#ff9ee0', '#ffd0f0'], // pink
    ['#4a3a8a', '#6a55b8', '#8f7ae0', '#b6a2ff', '#ddd0ff'], // lavender
    ['#2a6a5a', '#3a9a80', '#5ac8a8', '#8af0d0', '#c8fff0'], // mint
]
const BARK = '#5e4128'
const DEAD_BARK = ['#3a3440', '#2c2832', '#4a4250']
const BIRCH = '#e4dccb'

// Leaves scattered through a rounded crown. Each is shaded by where it sits: the
// top and the sunward side are lit, the underside falls into shadow, so the crown
// reads as a volume instead of a flat blot, and every leaf is lit and fogged on
// its own as the camera moves around it.
function crown(
    random: Random,
    lift: number,
    radius: number,
    count: number,
    chars: string[],
    ramp: Ramp,
    size: number,
    glow = 0
): Prop[] {
    const leaves: Prop[] = []
    for (let i = 0; i < count; i++) {
        const angle = random() * Math.PI * 2
        const u = random() * 2 - 1 // height through the crown, bottom to top
        const r = radius * (0.45 + 0.55 * Math.sqrt(random()))
        const ring = Math.sqrt(1 - u * u) * r
        const dx = Math.cos(angle) * ring
        const dy = Math.sin(angle) * ring
        const dz = u * r * 0.8
        const facing =
            (dx * SUN.x + dy * SUN.y + dz * SUN.z) /
            (Math.hypot(dx, dy, dz) || 1)
        const lit = clamp(0.5 + 0.3 * facing + 0.25 * u, 0, 0.999)
        leaves.push({
            char: pick(random, chars),
            color: ramp[Math.floor(lit * ramp.length)],
            lift: lift + dz,
            dx,
            dy,
            size: size * (0.75 + random() * 0.5),
            shade: 0.65 + 0.5 * lit,
            glow: random() < glow,
        })
    }
    return leaves
}

// Pieces of trunk stacked up to `height`, leaning a little
function trunk(
    random: Random,
    height: number,
    color: string,
    char = '|'
): Prop[] {
    const lean = (random() - 0.5) * 0.25
    const pieces: Prop[] = []
    for (let z = 0.5; z < height; z += 0.75) {
        pieces.push({
            char,
            color,
            lift: z,
            dx: lean * z,
            size: 0.95,
            shade: 0.8,
        })
    }
    return pieces
}

export function broadleaf(random: Random): Prop[] {
    const s = 0.85 + random() * 0.4
    return [
        ...trunk(random, 1.8 * s, BARK),
        ...crown(
            random,
            2.7 * s,
            1.25 * s,
            11,
            ['♣', '♣', '♠'],
            pick(random, LEAVES),
            1.05 * s
        ),
    ]
}

// Tiers of needles narrowing toward a single tip, darker toward the bottom
export function pine(random: Random): Prop[] {
    const s = 0.85 + random() * 0.4
    const needles: Prop[] = [...trunk(random, 1.2 * s, BARK)]
    for (let tier = 0; tier < 4; tier++) {
        const lift = (1.1 + tier * 0.75) * s
        const radius = (0.95 - tier * 0.22) * s
        const count = 5 - tier
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + random()
            const dx = Math.cos(angle) * radius * 0.6
            const dy = Math.sin(angle) * radius * 0.6
            const facing = dx * SUN.x + dy * SUN.y
            const lit = clamp(0.2 + tier * 0.18 + 0.25 * facing, 0, 0.999)
            needles.push({
                char: '▲',
                color: NEEDLES[Math.floor(lit * NEEDLES.length)],
                lift,
                dx,
                dy,
                size: (1.15 - tier * 0.18) * s,
                shade: 0.7 + 0.45 * lit,
            })
        }
    }
    needles.push({ char: '▲', color: NEEDLES[4], lift: 4.1 * s, size: 0.6 * s })
    return needles
}

// Bare, forked branches; the haunted woods are full of them
export function deadTree(random: Random): Prop[] {
    const s = 0.9 + random() * 0.5
    const bark = pick(random, DEAD_BARK)
    const branches: Prop[] = [...trunk(random, 2.4 * s, bark)]
    for (let i = 0; i < 5; i++) {
        const angle = random() * Math.PI * 2
        branches.push({
            char: pick(random, ['Y', 'ψ', 'y', 'v']),
            color: bark,
            lift: (2.2 + random() * 1.1) * s,
            dx: Math.cos(angle) * 0.6 * s,
            dy: Math.sin(angle) * 0.6 * s,
            size: (0.8 + random() * 0.5) * s,
            shade: 0.8,
        })
    }
    return branches
}

// Black-purple crowns with a bruised crimson sheen; the odd one is hung with webs
export function gloomTree(random: Random): Prop[] {
    const s = 1 + random() * 0.5
    const tree = [
        ...trunk(random, 2.2 * s, pick(random, DEAD_BARK)),
        ...crown(
            random,
            3.1 * s,
            1.55 * s,
            13,
            ['♠', '♠', '♣'],
            GLOOM,
            1.2 * s
        ),
    ]
    if (random() < 0.2) {
        tree.push({
            char: '※',
            color: '#b8b0c4',
            lift: 1.8 * s,
            dx: 0.5,
            size: 0.9,
            shade: 0.7,
        })
    }
    return tree
}

// Pale trunks under pastel crowns, some leaves glowing, a few sparks among them
export function fairyTree(random: Random): Prop[] {
    const s = 0.85 + random() * 0.45
    return [
        ...trunk(random, 1.9 * s, BIRCH),
        ...crown(
            random,
            2.8 * s,
            1.3 * s,
            12,
            ['♣', '♣', '*'],
            pick(random, PASTELS),
            1.0 * s,
            0.35
        ),
        ...crown(random, 2.8 * s, 1.6 * s, 3, ['·', '*'], ['#ffffff'], 0.5, 1),
    ]
}

export const MUSHROOM_CAPS = ['#ff6ad5', '#9d7bff', '#5ef0ff', '#ffb86a']

// A toadstool's colour follows from its seed, so the map can light it to match
export const mushroomCap = (seed: number) =>
    MUSHROOM_CAPS[seed % MUSHROOM_CAPS.length]

// Grow a plant's glyphs from its seed; the same seed always grows the same plant
export function grow(plant: Plant, seed: number): Prop[] {
    const random = seededRandom(seed)
    switch (plant) {
        case Plant.Broadleaf:
            return broadleaf(random)
        case Plant.Pine:
            return pine(random)
        case Plant.Dead:
            return deadTree(random)
        case Plant.Gloom:
            return gloomTree(random)
        case Plant.Fairy:
            return fairyTree(random)
        case Plant.Mushroom:
            return mushroom(random, mushroomCap(seed))
        default:
            return []
    }
}

// Every character a plant can be drawn with, for the glyph atlas
export const FLORA_CHARS = [
    '|',
    '♣',
    '♠',
    '*',
    '·',
    '▲',
    'Y',
    'ψ',
    'y',
    'v',
    '※',
    '◓',
]

// A giant glowing toadstool
export function mushroom(random: Random, cap: string): Prop[] {
    const s = 0.8 + random() * 0.7
    return [
        { char: '|', color: BIRCH, lift: 0.4 * s, size: 0.9 * s },
        { char: '|', color: BIRCH, lift: 0.9 * s, size: 0.9 * s },
        { char: '◓', color: cap, glow: true, lift: 1.5 * s, size: 1.6 * s },
        {
            char: '·',
            color: '#ffffff',
            glow: true,
            lift: 1.75 * s,
            dx: 0.25,
            size: 0.5,
        },
    ]
}
