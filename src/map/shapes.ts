import { clamp } from '../utils/Math'
import { Prop } from './Tile'

// Building blocks for things grown out of glyphs: trees, bushes, rocks. Every glyph
// is placed in 3D around its tile and shaded by which way it faces, so a heap of
// flat billboards reads as a lit volume from any side.

// Light comes from the north-west, 40° above the horizon
export const SUN = { x: -0.54, y: -0.54, z: 0.64 }

export type Random = () => number

export const pick = <T>(random: Random, options: T[]): T =>
    options[Math.floor(random() * options.length)]

export const between = (random: Random, min: number, max: number) =>
    min + random() * (max - min)

// One hue from deep shadow to highlight. Glyphs take their colour from it by how
// lit they are, so a shape is shaded even before any light falls on it.
export type Ramp = string[]

export const tint = (ramp: Ramp, lit: number) =>
    ramp[Math.floor(clamp(lit, 0, 0.999) * ramp.length)]

// How squarely a point on a rounded shape, offset from its centre, faces the sun
export function facing(dx: number, dy: number, dz: number): number {
    return (
        (dx * SUN.x + dy * SUN.y + dz * SUN.z) / (Math.hypot(dx, dy, dz) || 1)
    )
}

type Blob = {
    lift: number // centre height above the ground
    radius: number
    count: number
    chars: string[]
    ramp: Ramp
    size: number
    squash?: number // flatten vertically (bushes, rocks)
    glow?: number // chance a glyph glows
    dome?: boolean // top half only, for things sitting on the ground
}

// Glyphs scattered through a rounded volume. Each is shaded by where it sits: the
// top and the sunward side are lit, the underside falls into shadow, so the shape
// reads as a volume instead of a flat blot, and every glyph is lit and fogged on
// its own as the camera moves around it.
export function blob(random: Random, shape: Blob): Prop[] {
    const { lift, radius, ramp, size } = shape
    const squash = shape.squash ?? 0.8
    const glyphs: Prop[] = []
    for (let i = 0; i < shape.count; i++) {
        const angle = random() * Math.PI * 2
        // Height through the volume, bottom to top
        const u = shape.dome ? Math.sqrt(random()) : random() * 2 - 1
        const r = radius * (0.45 + 0.55 * Math.sqrt(random()))
        const ring = Math.sqrt(1 - u * u) * r
        const dx = Math.cos(angle) * ring
        const dy = Math.sin(angle) * ring
        const dz = u * r * squash
        const lit = 0.5 + 0.3 * facing(dx, dy, dz) + 0.25 * u
        glyphs.push({
            char: pick(random, shape.chars),
            color: tint(ramp, lit),
            lift: lift + dz,
            dx,
            dy,
            size: size * (0.75 + random() * 0.5),
            shade: 0.65 + 0.5 * clamp(lit, 0, 1),
            glow: shape.glow !== undefined && random() < shape.glow,
        })
    }
    return glyphs
}

// Pieces of trunk stacked up to `height`, leaning a little
export function trunk(
    random: Random,
    height: number,
    color: string,
    char = '|',
    size = 0.95
): Prop[] {
    const lean = (random() - 0.5) * 0.25
    const pieces: Prop[] = []
    for (let z = 0.5; z < height; z += 0.75) {
        pieces.push({ char, color, lift: z, dx: lean * z, size, shade: 0.8 })
    }
    return pieces
}

// A small scatter of the same kind of glyph close to the ground: tufts, specks
export function scatter(
    random: Random,
    count: number,
    reach: number,
    glyph: Omit<Prop, 'char' | 'color'> & { chars: string[]; colors: string[] }
): Prop[] {
    const { chars, colors, ...rest } = glyph
    return Array.from({ length: count }, () => ({
        ...rest,
        char: pick(random, chars),
        color: pick(random, colors),
        dx: (rest.dx ?? 0) + (random() - 0.5) * 2 * reach,
        dy: (rest.dy ?? 0) + (random() - 0.5) * 2 * reach,
        size: (rest.size ?? 1) * (0.8 + random() * 0.4),
    }))
}
