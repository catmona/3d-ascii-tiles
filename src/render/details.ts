import { Detail } from '../map/Tile'
import { GRASS_COLORS } from '../map/TileMap'

export enum DetailMode {
    Plain,
    Flowers, // the odd blade is a flower instead
    Water, // flat, bobbing and drifting
    Sparkle, // the odd glyph glints
}

// How one kind of detail looks. Every kind has the same number of glyphs and
// colours so the shader can index them as flat tables.
export type DetailLook = {
    chars: string[] // DETAIL_CHARS of them
    colors: string[] // DETAIL_COLORS of them
    size: number // smallest glyph, in tiles
    variation: number // added to size at most
    sway: number // how much the wind moves it
    mode: DetailMode
}

export const DETAIL_CHARS = 6
export const DETAIL_COLORS = 5
export const FLOWER_CHAR = '*'
export const FLOWER_COLORS = ['#ffd54a', '#ff9ec4', '#f4f1ff']

const GRASS: DetailLook = {
    chars: [',', "'", '`', '.', '"', ';'],
    colors: GRASS_COLORS,
    size: 0.5,
    variation: 0.4,
    sway: 1,
    mode: DetailMode.Flowers,
}

const LOOKS: Record<Detail, DetailLook> = {
    [Detail.None]: GRASS,
    [Detail.Grass]: GRASS,
    // Leaf litter under the trees
    [Detail.Forest]: {
        chars: ['.', ',', '`', "'", '·', ','],
        colors: ['#6b5435', '#3f5a2a', '#7a6040', '#2f4a24', '#5a4630'],
        size: 0.45,
        variation: 0.3,
        sway: 0.3,
        mode: DetailMode.Plain,
    },
    [Detail.Sand]: {
        chars: ['.', '·', ',', '`', '.', '°'],
        colors: ['#e6d3a0', '#cdb880', '#f0e2bc', '#b9a26c', '#d9c48f'],
        size: 0.4,
        variation: 0.25,
        sway: 0,
        mode: DetailMode.Plain,
    },
    // Crags, scree and gravel
    [Detail.Rock]: {
        chars: ['^', '.', ':', ',', '`', "'"],
        colors: ['#a89f90', '#8a8174', '#c2b9aa', '#6e675d', '#9d9585'],
        size: 0.55,
        variation: 0.45,
        sway: 0,
        mode: DetailMode.Plain,
    },
    // Wind-blown drifts, the odd grain glinting
    [Detail.Snow]: {
        chars: ['~', '-', '.', '~', "'", '·'],
        colors: ['#ffffff', '#e8f0f8', '#d2e2f0', '#f6faff', '#c4d6e8'],
        size: 0.6,
        variation: 0.4,
        sway: 0,
        mode: DetailMode.Sparkle,
    },
    // Wavelets
    [Detail.Water]: {
        chars: ['~', '-', '~', '≈', '`', '-'],
        colors: ['#5ea3e6', '#7fb8f0', '#3f86d1', '#a8d4ff', '#4a97dc'],
        size: 0.5,
        variation: 0.3,
        sway: 0,
        mode: DetailMode.Water,
    },
    // Foam where water meets land
    [Detail.Shore]: {
        chars: ['~', '°', '-', '~', '.', '`'],
        colors: ['#e8f4ff', '#cfe8ff', '#a8d4ff', '#ffffff', '#9ccaf5'],
        size: 0.45,
        variation: 0.3,
        sway: 0,
        mode: DetailMode.Water,
    },
    // Dead leaves and grave dirt
    [Detail.Haunted]: {
        chars: [',', '.', '`', ';', ':', '~'],
        colors: ['#3a2e44', '#2e2638', '#4a3a52', '#24202c', '#54405e'],
        size: 0.5,
        variation: 0.35,
        sway: 0.2,
        mode: DetailMode.Plain,
    },
    // Soft minty grass with the odd pastel blade, flowers here and there
    [Detail.Fairy]: {
        chars: [',', "'", '`', '.', '"', ';'],
        colors: ['#4ea882', '#62b890', '#40966f', '#78c69e', '#9a8ad8'],
        size: 0.45,
        variation: 0.35,
        sway: 0.6,
        mode: DetailMode.Flowers,
    },
    // Rubble with weeds pushing through, inside the keeps
    [Detail.Floor]: {
        chars: ['.', ',', '·', '"', '`', ';'],
        colors: ['#8d877b', '#7d776c', '#a39e93', '#5f7a3a', '#6b8e23'],
        size: 0.45,
        variation: 0.3,
        sway: 0.2,
        mode: DetailMode.Plain,
    },
    // A deep green carpet: low, dense, barely stirring
    [Detail.Moss]: {
        chars: ['∴', '"', ',', '·', '.', "'"],
        colors: ['#2e5a26', '#3c7030', '#4e863a', '#2a4e30', '#64983e'],
        size: 0.4,
        variation: 0.3,
        sway: 0.1,
        mode: DetailMode.Plain,
    },
    // Rounded pebbles, wet and grey-brown
    [Detail.Pebbles]: {
        chars: ['•', '•', '·', '.', '•', '°'],
        colors: ['#857f75', '#6b665e', '#9a9282', '#57534c', '#8c8270'],
        size: 0.28,
        variation: 0.25,
        sway: 0,
        mode: DetailMode.Plain,
    },
    // Broken stone sliding down a slope
    [Detail.Scree]: {
        chars: ['▴', '•', '∴', '.', '◆', ','],
        colors: ['#8e877a', '#a49c8c', '#77716a', '#bab2a2', '#857a68'],
        size: 0.32,
        variation: 0.3,
        sway: 0,
        mode: DetailMode.Plain,
    },
}

export const DETAIL_LOOKS: DetailLook[] = Object.values(Detail)
    .filter((kind): kind is Detail => typeof kind === 'number')
    .map((kind) => LOOKS[kind])
