import { clamp } from '../utils/Math'
import { Random, Ramp, between, facing, pick, scatter, tint } from './shapes'
import { Prop } from './Tile'

// Rocks are heaps of round glyphs, each lit by the way it faces, so a boulder
// has a sunlit shoulder and a shadowed flank from whichever side you look

export enum Stone {
    Grey,
    Mossy,
    Ice,
    Haunted,
    Sandstone,
}

const STONES: Record<Stone, Ramp> = {
    [Stone.Grey]: ['#363330', '#4a4642', '#5f5a54', '#77716a', '#908981'],
    [Stone.Mossy]: ['#353530', '#48483f', '#5c5c50', '#727163', '#8a8878'],
    [Stone.Ice]: ['#6f8aa6', '#8ca6c0', '#a8c0d6', '#c8dae8', '#eaf4fc'],
    [Stone.Haunted]: ['#26222c', '#34303c', '#454050', '#585264', '#6e687a'],
    [Stone.Sandstone]: ['#4e3d2a', '#665139', '#7e664a', '#977e60', '#ae9676'],
}
// Moss on the tops and shady flanks of stones
export const MOSS: Ramp = [
    '#26421c',
    '#33582a',
    '#467434',
    '#5c8e3e',
    '#7aa850',
]
const TUFTS = ['"', ',', '⺌']

// One stone: a squat heap of overlapping discs on a flat, darker footing
function stone(
    random: Random,
    kind: Stone,
    size: number,
    dx = 0,
    dy = 0,
    count = 7
): Prop[] {
    const ramp = STONES[kind]
    const radius = 0.42 * size
    const glyphs: Prop[] = [
        {
            char: '⬬',
            color: ramp[0],
            lift: 0.12 * size,
            dx,
            dy,
            size: 1.1 * size,
            shade: 0.7,
        },
    ]
    // Stretch each stone along a random axis so they aren't all perfect domes
    const axis = random() * Math.PI
    const stretch = between(random, 1, 1.5)
    for (let i = 0; i < count; i++) {
        const angle = random() * Math.PI * 2
        const u = Math.sqrt(random()) // bias toward the top
        const ring = Math.sqrt(1 - u * u) * radius
        const along = Math.cos(angle - axis) * ring * stretch
        const across = Math.sin(angle - axis) * ring
        const ox = Math.cos(axis) * along - Math.sin(axis) * across
        const oy = Math.sin(axis) * along + Math.cos(axis) * across
        const oz = u * radius * 0.75
        const face = facing(ox, oy, oz + 0.15)
        const lit = 0.42 + 0.4 * face + 0.15 * u
        // Moss takes the top and the side turned away from the sun
        const mossy =
            kind === Stone.Mossy && (u > 0.6 || face < -0.1) && random() < 0.8
        glyphs.push({
            char: '●',
            color: mossy ? tint(MOSS, lit + 0.1) : tint(ramp, lit),
            lift: 0.22 * size + oz,
            dx: dx + ox,
            dy: dy + oy,
            // Big overlapping discs, so it reads as one solid stone
            size: size * between(random, 0.62, 0.85),
            shade: 0.7 + 0.4 * clamp(lit, 0, 1),
        })
    }
    if (kind === Stone.Mossy) {
        glyphs.push(
            ...scatter(random, 2, radius * 0.5, {
                chars: TUFTS,
                colors: MOSS.slice(2),
                lift: 0.3 * size + radius * 0.75,
                dx,
                dy,
                size: 0.35,
            })
        )
    }
    return glyphs
}

// A big lone boulder
export function boulder(random: Random, kind: Stone): Prop[] {
    return stone(random, kind, between(random, 0.8, 1.3), 0, 0, 9)
}

// A few loose stones lying together
export function rocks(random: Random, kind: Stone): Prop[] {
    const glyphs: Prop[] = []
    const count = 2 + Math.floor(random() * 3)
    for (let i = 0; i < count; i++) {
        glyphs.push(
            ...stone(
                random,
                kind,
                between(random, 0.35, 0.6),
                (random() - 0.5) * 0.8,
                (random() - 0.5) * 0.8,
                4
            )
        )
    }
    return glyphs
}

// A jagged crag of upright shards breaking out of a hillside, a couple of
// fallen stones at its foot
export function outcrop(random: Random, kind: Stone): Prop[] {
    const ramp = STONES[kind]
    const glyphs: Prop[] = []
    const shards = 4 + Math.floor(random() * 4)
    for (let i = 0; i < shards; i++) {
        const angle = random() * Math.PI * 2
        const r = random() * 0.45
        const dx = Math.cos(angle) * r
        const dy = Math.sin(angle) * r
        // Tallest in the middle
        const size = (1.5 - r * 1.6) * between(random, 0.75, 1.1)
        const lit = 0.35 + 0.4 * facing(dx, dy, 0.2) + 0.12 * (size - 1)
        const snowy = kind === Stone.Ice && size > 1
        glyphs.push({
            // Lopsided shards make a ragged skyline
            char: pick(random, ['▲', '◢', '◣']),
            color: snowy ? tint(STONES[Stone.Ice], lit + 0.2) : tint(ramp, lit),
            lift: 0.15 + size * 0.42,
            dx,
            dy,
            size,
            shade: 0.7 + 0.35 * clamp(lit, 0, 1),
        })
    }
    glyphs.push(
        ...stone(random, kind, 0.4, 0.45, 0.25, 3),
        ...scatter(random, 2, 0.5, {
            chars: TUFTS,
            colors: kind === Stone.Ice ? ['#c8dae8'] : MOSS.slice(1, 4),
            lift: 0.15,
            size: 0.45,
        })
    )
    return glyphs
}
