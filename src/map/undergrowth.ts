import {
    Random,
    Ramp,
    between,
    blob,
    facing,
    pick,
    scatter,
    tint,
} from './shapes'
import { MOSS } from './stones'
import { Prop } from './Tile'

// Everything that grows below the trees: bushes, ferns, flowers, reeds, toadstools,
// and what lies on the forest floor. Small and numerous, so each is only a handful
// of glyphs.

const BARK = '#5e4128'
const DEAD_BARK = '#3c3640'
const STEM = '#4a7a2a'
// A nudge toward the sun, for highlights on top of things
const SUNWARD = { x: -0.04, y: -0.04 }

const BUSHES: Ramp[] = [
    ['#123c28', '#1b5636', '#267046', '#388c5a', '#54a874'], // emerald
    ['#223c18', '#30561f', '#43702a', '#5a8c38', '#78a84e'], // olive
    ['#103a3a', '#185252', '#226c68', '#348880', '#4ea49a'], // teal
]

export enum BushKind {
    Green,
    Berries,
    Blossom,
    Gorse,
    Fairy,
}

// What a bush is dotted with, if anything
const BUSH_DOTS: Record<BushKind, { chars: string[]; colors: string[] }> = {
    [BushKind.Green]: { chars: [], colors: [] },
    [BushKind.Berries]: { chars: ['•'], colors: ['#d8344a', '#b8243a'] },
    [BushKind.Blossom]: { chars: ['✿'], colors: ['#f6f0e6', '#ffe4ec'] },
    [BushKind.Gorse]: { chars: ['•', '✿'], colors: ['#ffd23a', '#ffe070'] },
    [BushKind.Fairy]: { chars: ['✿', '❀'], colors: ['#ffb4e0', '#d4c0ff'] },
}

// A low rounded shrub, sometimes in berry or flower
export function bush(random: Random, kind: BushKind): Prop[] {
    const s = between(random, 0.65, 1.05)
    // Rounded and wider than tall, so it reads as a shrub rather than a little tree
    const leaves = blob(random, {
        lift: 0.4 * s,
        radius: 0.7 * s,
        count: 10,
        chars: ['♣', '●', '♣'],
        ramp: pick(random, BUSHES),
        size: 0.55 * s,
        squash: 0.55,
    })
    const dots = BUSH_DOTS[kind]
    if (dots.chars.length === 0) return leaves
    // Dotted over the sunward top, where they'd catch the eye
    return [
        ...leaves,
        ...scatter(random, 4, 0.4 * s, {
            chars: dots.chars,
            colors: dots.colors,
            lift: 0.62 * s,
            dx: -0.08,
            dy: -0.08,
            size: 0.3,
        }),
    ]
}

const FERN: Ramp = ['#1c542a', '#287234', '#3a923e', '#56b04c', '#7ec86a']

// Fronds springing from one root
export function fern(random: Random): Prop[] {
    const s = between(random, 0.7, 1.05)
    const fronds = 4 + Math.floor(random() * 3)
    const glyphs: Prop[] = []
    for (let i = 0; i < fronds; i++) {
        const angle = (i / fronds) * Math.PI * 2 + random()
        const dx = Math.cos(angle) * 0.24 * s
        const dy = Math.sin(angle) * 0.24 * s
        const size = between(random, 0.55, 0.8) * s
        glyphs.push({
            char: '⸙',
            color: tint(
                FERN,
                0.55 + 0.4 * facing(dx, dy, 0.3) + random() * 0.2
            ),
            lift: size * 0.45,
            dx,
            dy,
            size,
            shade: 0.9,
        })
    }
    return glyphs
}

// Drifts of one kind of flower: chars and two shades for each
const FLOWERS: { chars: string[]; colors: string[] }[] = [
    { chars: ['✿', '•'], colors: ['#ffd23a', '#ffe680'] }, // buttercups
    { chars: ['✿', '❀'], colors: ['#f6f2ea', '#ffffff'] }, // daisies
    { chars: ['✾', '*'], colors: ['#5a7cf0', '#86a4ff'] }, // cornflowers
    { chars: ['●', '✿'], colors: ['#e83a2a', '#ff5a3a'] }, // poppies
    { chars: ['✿', '•'], colors: ['#9a68d8', '#c09cf0'] }, // violets
    // In the fairy woods
    { chars: ['✿', '❀'], colors: ['#ff9ad6', '#ffc4e8'] },
    { chars: ['❀', '✾'], colors: ['#b8a4ff', '#9cd4ff'] },
    { chars: ['✿', '❁'], colors: ['#ffc49a', '#ffe39a'] },
]
export const WILD_FLOWERS = 5
export const FAIRY_FLOWERS = [5, 6, 7]

// A few flowers on stems, all of one kind
export function flowers(random: Random, kind: number): Prop[] {
    const { chars, colors } = FLOWERS[kind % FLOWERS.length]
    const glyphs: Prop[] = []
    const count = 4 + Math.floor(random() * 4)
    for (let i = 0; i < count; i++) {
        const dx = (random() - 0.5) * 0.85
        const dy = (random() - 0.5) * 0.85
        const tall = between(random, 0.35, 0.55)
        glyphs.push(
            {
                char: '|',
                color: STEM,
                lift: tall * 0.45,
                dx,
                dy,
                size: tall * 0.8,
                shade: 0.8,
            },
            {
                char: pick(random, chars),
                color: pick(random, colors),
                lift: tall,
                dx,
                dy,
                size: between(random, 0.28, 0.4),
            }
        )
    }
    return glyphs
}

const STRAW: Ramp = ['#45661a', '#5e821f', '#7c9e2a', '#9cb43e', '#bcc25e']

// A tussock of long grass, taller and paler than the turf around it, its
// blades arching out both ways
export function tallGrass(random: Random): Prop[] {
    const count = 5 + Math.floor(random() * 3)
    const glyphs: Prop[] = []
    for (let i = 0; i < count; i++) {
        const size = between(random, 0.6, 1)
        glyphs.push({
            char: pick(random, ['⺌', '⎛', '⎞', '|']),
            color: tint(STRAW, random()),
            lift: size * 0.45,
            dx: (random() - 0.5) * 0.7,
            dy: (random() - 0.5) * 0.7,
            size,
            shade: 0.9,
        })
    }
    return glyphs
}

const REED = ['#2e5a26', '#3e7030', '#548a3a']
const CATTAIL = ['#5a3418', '#6e4220']

// Reeds and cattails at the water's edge
export function reeds(random: Random): Prop[] {
    const glyphs: Prop[] = []
    const stems = 5 + Math.floor(random() * 4)
    for (let i = 0; i < stems; i++) {
        const dx = (random() - 0.5) * 0.85
        const dy = (random() - 0.5) * 0.85
        const height = between(random, 0.8, 1.5)
        const color = pick(random, REED)
        for (let z = 0.3; z < height - 0.2; z += 0.5) {
            glyphs.push({
                char: '|',
                color,
                lift: z,
                dx,
                dy,
                size: 0.6,
                shade: 0.85,
            })
        }
        glyphs.push(
            random() < 0.45
                ? {
                      char: '❚',
                      color: pick(random, CATTAIL),
                      lift: height,
                      dx,
                      dy,
                      size: 0.4,
                  }
                : {
                      char: pick(random, ['/', '\\', '|']),
                      color: REED[2],
                      lift: height - 0.1,
                      dx,
                      dy,
                      size: 0.5,
                  }
        )
    }
    return glyphs
}

const LILY = ['#24582e', '#2e6e38', '#3e8a44', '#56a456']

// Pads floating on still shallow water, now and then a flower among them
export function lilyPads(random: Random): Prop[] {
    const count = 2 + Math.floor(random() * 3)
    const glyphs: Prop[] = []
    for (let i = 0; i < count; i++) {
        glyphs.push({
            char: '⬬',
            color: pick(random, LILY),
            lift: 0.08,
            dx: (random() - 0.5) * 0.8,
            dy: (random() - 0.5) * 0.8,
            size: between(random, 0.4, 0.7),
            shade: 0.9,
        })
    }
    if (random() < 0.3) {
        glyphs.push({
            char: '✿',
            color: pick(random, ['#fff4f8', '#ffb0d0']),
            lift: 0.2,
            dx: glyphs[0].dx,
            dy: glyphs[0].dy,
            size: 0.32,
        })
    }
    return glyphs
}

export enum FungusKind {
    Forest,
    Haunted,
    Fairy,
}

const FUNGUS_CAPS: Record<FungusKind, string[]> = {
    [FungusKind.Forest]: ['#8a5a2a', '#a8763a', '#c89a5a', '#b8402a'],
    [FungusKind.Haunted]: ['#b8cc94', '#9cc4ac', '#c4c8b0'],
    [FungusKind.Fairy]: ['#ff8ad0', '#b49aff', '#7ee4f0', '#ffc070'],
}

// A small toadstool: a stem under a flat cap
export function tinyToadstool(
    cap: string,
    size: number,
    dx: number,
    dy: number,
    glow = false
): Prop[] {
    return [
        {
            char: '|',
            color: '#e8dcc0',
            lift: size * 0.4,
            dx,
            dy,
            size: size * 0.8,
            shade: 0.85,
        },
        {
            char: '⬬',
            color: cap,
            lift: size * 0.85,
            dx,
            dy,
            size: size * 1.1,
            glow,
        },
    ]
}

// A cluster of little mushrooms; in the haunted woods one of them glows sickly
export function fungus(random: Random, kind: FungusKind): Prop[] {
    const caps = FUNGUS_CAPS[kind]
    const cap = pick(random, caps)
    const glyphs: Prop[] = []
    const count = 2 + Math.floor(random() * 4)
    for (let i = 0; i < count; i++) {
        glyphs.push(
            ...tinyToadstool(
                random() < 0.7 ? cap : pick(random, caps),
                between(random, 0.25, 0.42),
                (random() - 0.5) * 0.7,
                (random() - 0.5) * 0.7,
                kind !== FungusKind.Forest && i === 0
            )
        )
    }
    return glyphs
}

// Caps from shadowed rim to sunlit crown; the third shade colours their light
export const TOADSTOOLS: Ramp[] = [
    ['#6a1420', '#9a1e2e', '#c8283a', '#e8504e', '#ff7a6a'], // red
    ['#6e2452', '#a03a76', '#d062a6', '#f08cc8', '#ffb8e0'], // pink
    ['#36287a', '#5240ac', '#7c64d6', '#a48cf8', '#cabaff'], // violet
    ['#12545a', '#1c8080', '#30aaa4', '#5cd0c4', '#98ece0'], // teal
]

// A giant toadstool: a stout pale stem with a skirt, under a domed cap built of
// stacked discs that grow lighter toward the crown, dotted with glowing spots
export function toadstool(random: Random, ramp: Ramp): Prop[] {
    const s = between(random, 0.85, 1.35)
    const top = 1.25 * s
    const glyphs: Prop[] = [
        {
            char: '❚',
            color: '#ece2cc',
            lift: 0.35 * s,
            size: 0.75 * s,
            shade: 0.85,
        },
        {
            char: '❚',
            color: '#f4ecda',
            lift: 0.8 * s,
            size: 0.75 * s,
            shade: 0.9,
        },
        {
            char: '⬬',
            color: '#d8ccb4',
            lift: 0.95 * s,
            size: 0.55 * s,
            shade: 0.8,
        },
        // The gills under the rim, then the dome narrowing upward
        {
            char: '⬬',
            color: '#a89480',
            lift: top - 0.08 * s,
            size: 1.5 * s,
            shade: 0.7,
        },
    ]
    const tiers = [
        { lift: 0, size: 1.6 },
        { lift: 0.16, size: 1.35 },
        { lift: 0.3, size: 1.0 },
        { lift: 0.4, size: 0.6 },
    ]
    tiers.forEach((tier, i) => {
        glyphs.push({
            char: '⬬',
            color: ramp[i + 1],
            lift: top + tier.lift * s,
            size: tier.size * s,
            shade: 0.8 + i * 0.1,
        })
    })
    // Spots on the dome, out in front of the discs so they show from every side
    const spots = 4 + Math.floor(random() * 3)
    for (let i = 0; i < spots; i++) {
        const angle = (i / spots) * Math.PI * 2 + random()
        const up = random()
        const r = (0.62 - up * 0.35) * s
        glyphs.push({
            char: '•',
            color: '#fff8ec',
            lift: top + (0.08 + up * 0.3) * s,
            dx: Math.cos(angle) * r,
            dy: Math.sin(angle) * r,
            size: between(random, 0.22, 0.32) * s,
            glow: true,
        })
    }
    return glyphs
}

const CRYSTAL_FLOWERS = ['#3ad8ff', '#a070ff', '#ff6ac8']

// Glassy flowers that shine on their own
export function crystalFlowers(random: Random): Prop[] {
    const color = pick(random, CRYSTAL_FLOWERS)
    const glyphs: Prop[] = []
    const count = 2 + Math.floor(random() * 3)
    for (let i = 0; i < count; i++) {
        const dx = (random() - 0.5) * 0.6
        const dy = (random() - 0.5) * 0.6
        const tall = between(random, 0.5, 0.85)
        glyphs.push(
            {
                char: '|',
                color: '#b8d8e0',
                lift: tall * 0.45,
                dx,
                dy,
                size: tall * 0.8,
                shade: 0.75,
            },
            {
                char: pick(random, ['◆', '⬥', '✧']),
                color,
                lift: tall,
                dx,
                dy,
                size: between(random, 0.3, 0.42),
                glow: true,
            }
        )
    }
    return glyphs
}

const BRAMBLE: Ramp = ['#1c0e18', '#2a1426', '#3a1c32', '#4c243e', '#5e2c4a']

// A thorny tangle, dark as a bruise, bristling with thorns and a few black berries
export function bramble(random: Random): Prop[] {
    const s = between(random, 0.7, 1.05)
    return [
        ...blob(random, {
            lift: 0.4 * s,
            radius: 0.6 * s,
            count: 11,
            chars: ['∫', 'ʃ', '≀', 'ᔕ', 'ᔓ'],
            ramp: BRAMBLE,
            size: 0.62 * s,
            squash: 0.6,
        }),
        ...scatter(random, 3, 0.45 * s, {
            chars: ['✷'],
            colors: ['#6a2234', '#7a2a3a'],
            lift: 0.55 * s,
            size: 0.28,
        }),
        ...scatter(random, 2, 0.35 * s, {
            chars: ['•'],
            colors: ['#3a0e2a', '#5a1640'],
            lift: 0.5 * s,
            size: 0.25,
        }),
    ]
}

const BONE = ['#d8d0bc', '#c4bca4', '#e6e0d0']

// A skull and a few scattered bones
export function bones(random: Random): Prop[] {
    return [
        {
            char: '☠',
            color: pick(random, BONE),
            lift: 0.2,
            dx: (random() - 0.5) * 0.4,
            dy: (random() - 0.5) * 0.4,
            size: 0.42,
            shade: 0.9,
        },
        ...scatter(random, 2 + Math.floor(random() * 2), 0.4, {
            chars: ['=', '-', '⌐'],
            colors: BONE,
            lift: 0.08,
            size: 0.3,
            shade: 0.8,
        }),
    ]
}

// What's left of a felled tree: its cut face catching the light, moss at its foot
export function stump(random: Random, dead: boolean): Prop[] {
    const s = between(random, 0.75, 1.05)
    const bark = dead ? DEAD_BARK : BARK
    const glyphs: Prop[] = [
        {
            char: '●',
            color: bark,
            lift: 0.2 * s,
            dx: -0.1 * s,
            size: 0.5 * s,
            shade: 0.75,
        },
        {
            char: '●',
            color: bark,
            lift: 0.2 * s,
            dx: 0.1 * s,
            size: 0.5 * s,
            shade: 0.65,
        },
        {
            char: '⬬',
            color: dead ? '#6a6070' : '#b89060',
            lift: 0.42 * s,
            size: 0.55 * s,
        },
    ]
    if (!dead && random() < 0.6) {
        glyphs.push(
            ...scatter(random, 3, 0.3, {
                chars: ['"', ',', '⺌'],
                colors: MOSS.slice(2),
                lift: 0.12,
                size: 0.35,
            })
        )
    }
    return glyphs
}

// A fallen trunk lying in the leaves, mossy along its back, sometimes sprouting
// a few mushrooms
export function log(random: Random, dead: boolean): Prop[] {
    const angle = random() * Math.PI
    const length = between(random, 1.3, 2)
    const along = { x: Math.cos(angle), y: Math.sin(angle) }
    const bark = dead ? ['#2c2832', '#3a3440'] : ['#4a321e', '#5e4128']
    const light = dead ? '#5a5262' : '#86603e'
    const glyphs: Prop[] = []
    const pieces = 7
    for (let i = 0; i < pieces; i++) {
        const t = (i / (pieces - 1) - 0.5) * length
        glyphs.push({
            char: '●',
            color: bark[i % 2],
            lift: 0.2,
            dx: along.x * t,
            dy: along.y * t,
            size: 0.42,
            shade: 0.75,
        })
        // The back of the log catches the light
        if (i % 2 === 0) {
            glyphs.push({
                char: '●',
                color: !dead && random() < 0.5 ? MOSS[3] : light,
                lift: 0.32,
                dx: along.x * t + SUNWARD.x,
                dy: along.y * t + SUNWARD.y,
                size: 0.24,
            })
        }
    }
    // The sawn end shows its rings
    const end = length / 2
    glyphs.push({
        char: '◉',
        color: dead ? '#6a6070' : '#b89060',
        lift: 0.2,
        dx: along.x * end,
        dy: along.y * end,
        size: 0.38,
    })
    if (random() < 0.35) {
        const t = (random() - 0.5) * length * 0.6
        glyphs.push(
            ...tinyToadstool(
                dead ? '#b8cc94' : '#c89a5a',
                0.3,
                along.x * t - along.y * 0.2,
                along.y * t + along.x * 0.2,
                dead
            ).map((p) => ({ ...p, lift: p.lift + 0.1 }))
        )
    }
    return glyphs
}
