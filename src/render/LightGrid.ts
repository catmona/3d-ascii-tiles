import { Light } from '../map/Lighting'

// Every fixed light in the map, sorted into a grid so each glyph only looks at the
// few lights that can reach it, at any camera distance. Both tables are plain RGBA8
// textures (WebGL1 has no integer textures, and bytes need no float extension):
//
// cells:   one texel per LIGHT_CELL × LIGHT_CELL tiles: first record (2 bytes), count
// records: RECORD_TEXELS texels per light, copied into every cell it reaches
//   0: x (2 bytes, 1/32 tile), y (2 bytes)
//   1: z (2 bytes, 1/64 tile, offset by Z_OFFSET), radius (1/4 tile), flicker
//   2: rgb × intensity / 2, pulse (1/32 radian per second)
//
// Flicker and pulse are animated in the shader from the time and the light's
// position, so the tables are built once and nothing is sent per frame.
export const LIGHT_CELL = 8
export const LIGHTS_PER_CELL = 24 // the shader's loop bound; the brightest win
export const RECORD_TEXELS = 4 // one spare
export const RECORDS_PER_ROW = 256
export const Z_OFFSET = 64

export type LightGrid = {
    cells: Uint8Array
    cellsX: number
    cellsY: number
    records: Uint8Array
    recordWidth: number // texels
    recordHeight: number
    count: number // records
}

export function buildLightGrid(
    lights: Light[],
    width: number,
    height: number
): LightGrid {
    const cellsX = Math.ceil(width / LIGHT_CELL)
    const cellsY = Math.ceil(height / LIGHT_CELL)
    const lists: Light[][] = Array.from({ length: cellsX * cellsY }, () => [])

    for (const light of lights) {
        const { x, y } = light.position
        const r = light.radius
        const x0 = Math.max(0, Math.floor((x - r) / LIGHT_CELL))
        const x1 = Math.min(cellsX - 1, Math.floor((x + r) / LIGHT_CELL))
        const y0 = Math.max(0, Math.floor((y - r) / LIGHT_CELL))
        const y1 = Math.min(cellsY - 1, Math.floor((y + r) / LIGHT_CELL))
        for (let cy = y0; cy <= y1; cy++) {
            for (let cx = x0; cx <= x1; cx++) {
                // Only cells the light's circle actually overlaps. Glyphs look up the
                // cell under their centre, so a cell has to list every light that
                // reaches any point inside it.
                const nx = Math.max(
                    cx * LIGHT_CELL,
                    Math.min(x, (cx + 1) * LIGHT_CELL)
                )
                const ny = Math.max(
                    cy * LIGHT_CELL,
                    Math.min(y, (cy + 1) * LIGHT_CELL)
                )
                if (Math.hypot(nx - x, ny - y) < r) {
                    lists[cy * cellsX + cx].push(light)
                }
            }
        }
    }

    let count = 0
    for (const list of lists) {
        if (list.length > LIGHTS_PER_CELL) {
            list.sort((a, b) => b.intensity * b.radius - a.intensity * a.radius)
            list.length = LIGHTS_PER_CELL
        }
        count += list.length
    }

    const recordWidth = RECORDS_PER_ROW * RECORD_TEXELS
    const recordHeight = Math.max(1, Math.ceil(count / RECORDS_PER_ROW))
    const records = new Uint8Array(recordWidth * recordHeight * 4)
    const cells = new Uint8Array(cellsX * cellsY * 4)
    const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
    const word = (v: number) => Math.max(0, Math.min(65535, Math.round(v)))

    let next = 0
    lists.forEach((list, cell) => {
        cells.set([next >> 8, next & 255, list.length, 0], cell * 4)
        for (const light of list) {
            const { x, y, z } = light.position
            const n = parseInt(light.color.slice(1), 16)
            const scale = (light.intensity / 2) * 255
            const px = word(x * 32)
            const py = word(y * 32)
            const pz = word((z + Z_OFFSET) * 64)
            records.set(
                [
                    px >> 8,
                    px & 255,
                    py >> 8,
                    py & 255,
                    pz >> 8,
                    pz & 255,
                    byte(light.radius * 4),
                    byte((light.flicker ?? 0) * 255),
                    byte((((n >> 16) & 255) / 255) * scale),
                    byte((((n >> 8) & 255) / 255) * scale),
                    byte(((n & 255) / 255) * scale),
                    byte((light.pulse ?? 0) * 32),
                ],
                next * RECORD_TEXELS * 4
            )
            next++
        }
    })

    return { cells, cellsX, cellsY, records, recordWidth, recordHeight, count }
}
