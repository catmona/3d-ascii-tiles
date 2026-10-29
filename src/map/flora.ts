import { seededRandom } from '../utils/Math'
import {
    Random,
    Ramp,
    SUN,
    between,
    blob,
    facing,
    pick,
    scatter,
    tint,
    trunk,
} from './shapes'
import { Stone, MOSS, boulder, outcrop, rocks } from './stones'
import { Plant, Prop } from './Tile'
import {
    TOADSTOOLS,
    bones,
    bramble,
    bush,
    crystalFlowers,
    fern,
    flowers,
    fungus,
    lilyPads,
    log,
    reeds,
    stump,
    tallGrass,
    toadstool,
} from './undergrowth'

export { SUN } from './shapes'

const LEAVES: Ramp[] = [
    ['#0f4a30', '#17694a', '#1f8a5a', '#36b07a', '#5cd296'], // emerald
    ['#0f4446', '#166262', '#1f8080', '#33a39c', '#5cc4b8'], // teal
    ['#2a4a1a', '#3a6a24', '#4f8a2e', '#6aa63a', '#8cc45a'], // spring
]
const OAK: Ramp = ['#1c3a16', '#28521e', '#386e28', '#4e8c36', '#6cac4c']
const BIRCH_LEAVES: Ramp[] = [
    ['#24481a', '#34621e', '#4a7c26', '#62962e', '#7cae3c'], // fresh
    ['#6a4a10', '#926a16', '#bc9022', '#e2b63a', '#f6d466'], // turning gold
]
const WILLOW: Ramp = ['#26482e', '#3a663e', '#548650', '#76a66a', '#9cc488']
const CYPRESS: Ramp = ['#06150f', '#0a2018', '#102c22', '#173a2c', '#204a38']
const NEEDLES: Ramp = ['#0a3328', '#104536', '#1a6050', '#247a66', '#389680']
const SNOWY: Ramp = ['#7a8e96', '#9eb0b8', '#c4d2d8', '#e2eaee', '#f8fcff']
const GLOOM: Ramp = ['#0c0610', '#170c20', '#24122e', '#3a1638', '#5a1c3c']
// Soft but not washed out: even the sunlit leaves keep their colour
const PASTELS: Ramp[] = [
    ['#5a2a52', '#8a3c7a', '#b8569e', '#d874b8', '#e890cc'], // pink
    ['#3a2e6e', '#5644a0', '#7a64cc', '#9682e0', '#ae9cf0'], // lavender
    ['#1e5248', '#2c7a66', '#40a088', '#5cbc9e', '#76ccb0'], // mint
    ['#6e3a2c', '#9e5a3e', '#c87a54', '#de966c', '#eaaa84'], // peach
]
const BARK = '#5e4128'
const OAK_BARK = '#4e3822'
const DEAD_BARK = ['#3a3440', '#2c2832', '#4a4250']
const BIRCH_BARK = '#ebe5d8'
const SILVER_BARK = '#d8d0e0'
const HANGING_MOSS = ['#6e7862', '#7c8670', '#5e6852']
const LANTERNS = ['#fff0b8', '#ffe0f4', '#d8f4ff']

// Shift a group of glyphs sideways, to hang a lobe off a crown
const offset = (glyphs: Prop[], dx: number, dy: number) =>
    glyphs.map((g) => ({ ...g, dx: (g.dx ?? 0) + dx, dy: (g.dy ?? 0) + dy }))

// The common round-crowned tree; some have a second lobe so not every crown is a ball
export function broadleaf(random: Random): Prop[] {
    const s = 0.85 + random() * 0.4
    const ramp = pick(random, LEAVES)
    const tree = [
        ...trunk(random, 1.8 * s, BARK),
        ...blob(random, {
            lift: 2.7 * s,
            radius: 1.25 * s,
            count: 11,
            chars: ['♣', '♣', '♠'],
            ramp,
            size: 1.05 * s,
        }),
    ]
    if (random() < 0.35) {
        const angle = random() * Math.PI * 2
        const lobe = blob(random, {
            lift: 2.3 * s,
            radius: 0.7 * s,
            count: 4,
            chars: ['♣'],
            ramp,
            size: 0.9 * s,
        })
        tree.push(
            ...offset(
                lobe,
                Math.cos(angle) * 0.9 * s,
                Math.sin(angle) * 0.9 * s
            )
        )
    }
    return tree
}

// A big old oak: a thick mossy trunk under a broad crown of several lobes
export function oak(random: Random): Prop[] {
    const s = between(random, 1, 1.25)
    const tree = [
        ...trunk(random, 2 * s, OAK_BARK, '|', 1.05),
        ...offset(trunk(random, 1.7 * s, OAK_BARK, '|', 1.05), 0.2, 0.05),
        ...scatter(random, 3, 0.12, {
            chars: ['"', ','],
            colors: MOSS.slice(1, 4),
            lift: 0.6,
            dx: 0.1,
            dy: 0.1,
            size: 0.35,
        }).map((m, i) => ({ ...m, lift: 0.3 + i * 0.4 })),
        ...blob(random, {
            lift: 2.85 * s,
            radius: 1.25 * s,
            count: 12,
            chars: ['♣', '♣', '♠'],
            ramp: OAK,
            size: 1.1 * s,
            squash: 0.65,
        }),
    ]
    const first = random() * Math.PI * 2
    for (const turn of [0, 2.3]) {
        const angle = first + turn + random() * 0.6
        const lobe = blob(random, {
            lift: 2.45 * s,
            radius: 0.85 * s,
            count: 6,
            chars: ['♣', '♣', '♠'],
            ramp: OAK,
            size: 1 * s,
        })
        tree.push(
            ...offset(
                lobe,
                Math.cos(angle) * 1.05 * s,
                Math.sin(angle) * 1.05 * s
            )
        )
    }
    return tree
}

// Slender white trunks barred with black, a small airy crown held up high
export function birch(random: Random): Prop[] {
    const s = between(random, 0.85, 1.15)
    const bark = trunk(random, 2.6 * s, BIRCH_BARK, '|', 0.8)
    const marks = bark
        .filter(() => random() < 0.7)
        .map((piece) => ({
            ...piece,
            char: '-',
            color: '#2e2a2c',
            lift: piece.lift + (random() - 0.5) * 0.4,
            size: 0.28,
            shade: 0.9,
        }))
    return [
        ...bark,
        ...marks,
        ...blob(random, {
            lift: 2.95 * s,
            radius: 0.8 * s,
            count: 13,
            chars: ['♣', '♣', '♠'],
            ramp: BIRCH_LEAVES[random() < 0.15 ? 1 : 0],
            size: 0.8 * s,
            squash: 0.9,
        }),
    ]
}

// Long strands trailing from a low dome nearly to the ground. Willows lean over
// the water; in the fairy woods (variant 1 on, one per pastel) they come in
// pastels with a few glowing beads.
export function willow(random: Random, variant: number): Prop[] {
    const s = between(random, 0.95, 1.2)
    const fairy = variant > 0
    const ramp = fairy ? PASTELS[(variant - 1) % PASTELS.length] : WILLOW
    const top = 2.7 * s
    const tree = [
        ...trunk(random, 1.9 * s, fairy ? SILVER_BARK : BARK),
        ...blob(random, {
            lift: top,
            radius: 1.2 * s,
            count: 9,
            chars: ['♣', '♣', '♠'],
            ramp,
            size: 0.95 * s,
            squash: 0.55,
        }),
    ]
    const strands = 7
    for (let i = 0; i < strands; i++) {
        const angle = ((i + random() * 0.6) / strands) * Math.PI * 2
        const r = between(random, 0.95, 1.3) * s
        const dx = Math.cos(angle) * r
        const dy = Math.sin(angle) * r
        const face = facing(dx, dy, 0)
        // Fairy willows trail shorter strands: long ones read as falling rain
        let z = top - 0.25 * s
        for (; z > (fairy ? 1.4 : 0.8); z -= 0.5) {
            const lit = 0.3 + 0.3 * face + 0.3 * (z / top)
            tree.push({
                char: '⁞',
                color: tint(ramp, lit),
                lift: z,
                dx,
                dy,
                size: 0.65,
                shade: 0.7 + 0.35 * lit,
            })
        }
        if (fairy && random() < 0.3) {
            tree.push({
                char: '•',
                color: pick(random, LANTERNS),
                lift: z + 0.25,
                dx,
                dy,
                size: 0.28,
                glow: true,
            })
        }
    }
    return tree
}

// A tall narrow column of leaves: a bright poplar, or a dark cypress for
// graveyards and old ruins
export function poplar(random: Random, cypress: boolean): Prop[] {
    const s = between(random, 0.9, 1.2)
    const ramp = cypress ? CYPRESS : LEAVES[2]
    const tree = trunk(random, 1 * s, BARK)
    const base = 1.1 * s
    const top = 4.5 * s
    for (let z = base; z < top; z += 0.42 * s) {
        const t = (z - base) / (top - base)
        const r = 0.36 * s * (1 - t * t * 0.75)
        for (let k = 0; k < 2; k++) {
            const angle = random() * Math.PI * 2
            const dx = Math.cos(angle) * r
            const dy = Math.sin(angle) * r
            const lit = 0.3 + 0.3 * facing(dx, dy, 0.2) + 0.4 * t
            tree.push({
                char: cypress ? '♠' : pick(random, ['♣', '♠']),
                color: tint(ramp, lit),
                lift: z,
                dx,
                dy,
                size: (0.8 - 0.3 * t) * s,
                shade: 0.7 + 0.4 * Math.min(lit, 1),
            })
        }
    }
    tree.push({ char: '♠', color: ramp[4], lift: top + 0.1, size: 0.45 * s })
    return tree
}

// A young tree: a whip of a trunk and a few leaves
export function sapling(random: Random): Prop[] {
    const s = between(random, 0.55, 0.85)
    return [
        { char: '|', color: BARK, lift: 0.4 * s, size: 0.75 * s, shade: 0.8 },
        ...blob(random, {
            lift: 1.05 * s,
            radius: 0.42 * s,
            count: 5,
            chars: ['♣'],
            ramp: pick(random, LEAVES),
            size: 0.55 * s,
        }),
    ]
}

// Tiers of needles narrowing toward a single tip, darker toward the bottom; high
// up the mountains the tops of the tiers carry snow
export function pine(random: Random, snowy: boolean): Prop[] {
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
            const side = dx * SUN.x + dy * SUN.y
            const lit = 0.2 + tier * 0.18 + 0.25 * side
            needles.push({
                char: '▲',
                color:
                    snowy && lit > 0.4 && random() < 0.6
                        ? tint(SNOWY, lit)
                        : tint(NEEDLES, lit),
                lift,
                dx,
                dy,
                size: (1.15 - tier * 0.18) * s,
                shade: 0.7 + 0.45 * Math.min(lit, 1),
            })
        }
    }
    needles.push({
        char: '▲',
        color: snowy ? SNOWY[4] : NEEDLES[4],
        lift: 4.1 * s,
        size: 0.6 * s,
    })
    return needles
}

// Gnarled roots twisting out of the ground around a haunted trunk
function roots(random: Random, color: string): Prop[] {
    const count = 2 + Math.floor(random() * 2)
    return Array.from({ length: count }, (_, i) => {
        const angle = ((i + random() * 0.5) / count) * Math.PI * 2
        return {
            char: pick(random, ['ᔓ', 'ᔕ', '∽']),
            color,
            lift: 0.12,
            dx: Math.cos(angle) * 0.42,
            dy: Math.sin(angle) * 0.42,
            size: between(random, 0.45, 0.6),
            shade: 0.75,
        }
    })
}

// Grey-green strands of moss hanging off a haunted crown
function hangingMoss(random: Random, from: number, reach: number): Prop[] {
    const glyphs: Prop[] = []
    const strands = 2 + Math.floor(random() * 3)
    for (let i = 0; i < strands; i++) {
        const angle = random() * Math.PI * 2
        const dx = Math.cos(angle) * reach
        const dy = Math.sin(angle) * reach
        const color = pick(random, HANGING_MOSS)
        const length = 2 + Math.floor(random() * 2)
        for (let k = 0; k < length; k++) {
            glyphs.push({
                char: '⌇',
                color,
                lift: from - k * 0.5,
                dx,
                dy,
                size: 0.6,
                shade: 0.75,
            })
        }
    }
    return glyphs
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
    if (random() < 0.6) branches.push(...roots(random, bark))
    if (random() < 0.25) branches.push(...hangingMoss(random, 2.3 * s, 0.6 * s))
    return branches
}

// Black-purple crowns with a bruised crimson sheen, roots knotted at their feet;
// some are hung with grey moss and the odd one with webs
export function gloomTree(random: Random): Prop[] {
    const s = 1 + random() * 0.5
    const bark = pick(random, DEAD_BARK)
    const tree = [
        ...trunk(random, 2.2 * s, bark),
        ...blob(random, {
            lift: 3.1 * s,
            radius: 1.55 * s,
            count: 12,
            chars: ['♠', '♠', '♣'],
            ramp: GLOOM,
            size: 1.2 * s,
        }),
    ]
    if (random() < 0.5) tree.push(...roots(random, bark))
    if (random() < 0.45) tree.push(...hangingMoss(random, 2.1 * s, 1.0 * s))
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

// Pale trunks under pastel crowns; some are hung with a few glowing lanterns.
// The variant is the grove's colour, which most of its trees share.
export function fairyTree(random: Random, palette: number): Prop[] {
    const s = 0.85 + random() * 0.45
    const ramp =
        random() < 0.8
            ? PASTELS[palette % PASTELS.length]
            : pick(random, PASTELS)
    const tree = [
        ...trunk(random, 1.9 * s, SILVER_BARK),
        ...blob(random, {
            lift: 2.8 * s,
            radius: 1.3 * s,
            count: 11,
            chars: ['♣', '♣', '♠'],
            ramp,
            size: 1.0 * s,
        }),
    ]
    if (random() < 0.35) {
        const color = pick(random, LANTERNS)
        const count = 2 + Math.floor(random() * 2)
        for (let i = 0; i < count; i++) {
            const angle = random() * Math.PI * 2
            tree.push({
                char: '•',
                color,
                lift: 2.8 * s - 1.0 * s,
                dx: Math.cos(angle) * 0.9 * s,
                dy: Math.sin(angle) * 0.9 * s,
                size: 0.32,
                glow: true,
            })
        }
    }
    return tree
}

// A toadstool's colour follows from its seed, so the map can light it to match
export const toadstoolRamp = (seed: number) =>
    TOADSTOOLS[(seed & 7) % TOADSTOOLS.length]
export const mushroomCap = (seed: number) => toadstoolRamp(seed)[3]

// Grow a plant's glyphs from its seed; the same seed always grows the same plant.
// The seed's low three bits pick the variant.
export function grow(plant: Plant, seed: number): Prop[] {
    const random = seededRandom(seed)
    const variant = seed & 7
    switch (plant) {
        case Plant.Broadleaf:
            return broadleaf(random)
        case Plant.Pine:
            return pine(random, variant === 1)
        case Plant.Dead:
            return deadTree(random)
        case Plant.Gloom:
            return gloomTree(random)
        case Plant.Fairy:
            return fairyTree(random, variant)
        case Plant.Toadstool:
            return toadstool(random, toadstoolRamp(seed))
        case Plant.Oak:
            return oak(random)
        case Plant.Birch:
            return birch(random)
        case Plant.Willow:
            return willow(random, variant)
        case Plant.Poplar:
            return poplar(random, variant === 1)
        case Plant.Sapling:
            return sapling(random)
        case Plant.Bush:
            return bush(random, variant)
        case Plant.Fern:
            return fern(random)
        case Plant.Flowers:
            return flowers(random, variant)
        case Plant.TallGrass:
            return tallGrass(random)
        case Plant.Reeds:
            return reeds(random)
        case Plant.LilyPads:
            return lilyPads(random)
        case Plant.Fungus:
            return fungus(random, variant)
        case Plant.CrystalFlowers:
            return crystalFlowers(random)
        case Plant.Bramble:
            return bramble(random)
        case Plant.Bones:
            return bones(random)
        case Plant.Stump:
            return stump(random, variant === 1)
        case Plant.Log:
            return log(random, variant === 1)
        case Plant.Boulder:
            return boulder(random, variant as Stone)
        case Plant.Rocks:
            return rocks(random, variant as Stone)
        case Plant.Outcrop:
            return outcrop(random, variant as Stone)
        default:
            return []
    }
}

// How much a plant darkens the ground around it: trees a lot, bushes and rocks a
// little, flowers and grass not at all
export function canopy(plant: Plant): number {
    switch (plant) {
        case Plant.None:
        case Plant.Flowers:
        case Plant.TallGrass:
        case Plant.Reeds:
        case Plant.LilyPads:
        case Plant.Fungus:
        case Plant.CrystalFlowers:
        case Plant.Bones:
        case Plant.Fern:
            return 1
        case Plant.Bush:
        case Plant.Bramble:
        case Plant.Stump:
        case Plant.Log:
        case Plant.Rocks:
        case Plant.Sapling:
            return 0.92
        case Plant.Boulder:
        case Plant.Outcrop:
        case Plant.Toadstool:
            return 0.86
        default:
            return 0.8
    }
}

// Every character a plant can be drawn with, for the glyph atlas
export const FLORA_CHARS = [
    // trees
    '|',
    '-',
    '♣',
    '♠',
    '⁞',
    '▲',
    '◢',
    '◣',
    '⎛',
    '⎞',
    'Y',
    'ψ',
    'y',
    'v',
    '※',
    '⌇',
    'ᔓ',
    'ᔕ',
    '∽',
    // undergrowth
    '•',
    '●',
    '⬬',
    '"',
    ',',
    '⸙',
    '✿',
    '❀',
    '✾',
    '❁',
    '*',
    '⺌',
    '❚',
    '/',
    '\\',
    '◉',
    '◆',
    '⬥',
    '✧',
    '§',
    'ʃ',
    '∫',
    '≀',
    '✷',
    '☠',
    '=',
    '⌐',
]
