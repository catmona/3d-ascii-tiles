import { TileMap } from '../map/TileMap'

// How far the occluding surface sits below the lowest tile at each corner. Ground
// glyphs (lifted ±0.15, card bottom up to half a tile below their centre) and grass
// blades (±0.2, half a tile at most) always stay in front of it, so it only ever
// hides what's genuinely behind a hill.
const SINK = 0.75

// A heightfield of the whole map, drawn into the depth buffer only. Glyphs are ink on
// empty cards, so without it you'd see the far slopes of a mountain straight through
// the near ones. Triangles are stored chunk by chunk in the same order as the glyph
// buffers, so a run of neighbouring visible chunks is one contiguous range of indices.
export type TerrainMesh = {
    positions: Float32Array // xyz per corner
    elements: Uint32Array
    chunkFirst: Uint32Array // first index of each chunk
    chunkCount: Uint32Array
}

// One mesh per stride (tiles per cell). Distant chunks use the coarse ones: a tile
// there is a pixel or two, and a full-resolution mesh of the whole map is two million
// sliver triangles. Each coarse corner takes the lowest of the fine corners in every
// cell it touches, so a coarse surface always lies under the fine one and can only
// hide less, never more.
export function buildTerrain(
    map: TileMap,
    chunk: number,
    strides: number[]
): TerrainMesh[] {
    const { mapWidth: width, mapHeight: height } = map
    const tiles = map.map
    const columns = width + 1

    // Tiles are centred on whole coordinates, so corner (i, j) sits at (i - 0.5, j - 0.5)
    // and touches tiles (i - 1, j - 1) to (i, j). It takes the lowest of them.
    const corners = new Float32Array(columns * (height + 1))
    for (let j = 0; j <= height; j++) {
        for (let i = 0; i <= width; i++) {
            let lowest = Infinity
            for (let ty = j - 1; ty <= j; ty++) {
                for (let tx = i - 1; tx <= i; tx++) {
                    const tile = tiles[ty]?.[tx]
                    if (tile) lowest = Math.min(lowest, tile.elevation)
                }
            }
            corners[j * columns + i] = lowest - SINK
        }
    }

    return strides.map((stride) => {
        const cellsX = Math.ceil(width / stride)
        const cellsY = Math.ceil(height / stride)
        const across = cellsX + 1
        const positions = new Float32Array(across * (cellsY + 1) * 3)
        for (let J = 0; J <= cellsY; J++) {
            for (let I = 0; I <= cellsX; I++) {
                let lowest = Infinity
                const i0 = Math.max(0, (I - 1) * stride)
                const i1 = Math.min(width, (I + 1) * stride)
                const j0 = Math.max(0, (J - 1) * stride)
                const j1 = Math.min(height, (J + 1) * stride)
                for (let j = j0; j <= j1; j++) {
                    for (let i = i0; i <= i1; i++) {
                        lowest = Math.min(lowest, corners[j * columns + i])
                    }
                }
                const v = (J * across + I) * 3
                positions[v] = Math.min(I * stride, width) - 0.5
                positions[v + 1] = Math.min(J * stride, height) - 0.5
                positions[v + 2] = lowest
            }
        }

        const chunksX = Math.ceil(width / chunk)
        const chunksY = Math.ceil(height / chunk)
        const cellsPerChunk = chunk / stride
        const elements = new Uint32Array(cellsX * cellsY * 6)
        const chunkFirst = new Uint32Array(chunksX * chunksY)
        const chunkCount = new Uint32Array(chunksX * chunksY)
        let next = 0
        for (let cy = 0; cy < chunksY; cy++) {
            for (let cx = 0; cx < chunksX; cx++) {
                const c = cy * chunksX + cx
                chunkFirst[c] = next
                const endY = Math.min((cy + 1) * cellsPerChunk, cellsY)
                const endX = Math.min((cx + 1) * cellsPerChunk, cellsX)
                for (let y = cy * cellsPerChunk; y < endY; y++) {
                    for (let x = cx * cellsPerChunk; x < endX; x++) {
                        const a = y * across + x
                        elements[next++] = a
                        elements[next++] = a + 1
                        elements[next++] = a + across + 1
                        elements[next++] = a
                        elements[next++] = a + across + 1
                        elements[next++] = a + across
                    }
                }
                chunkCount[c] = next - chunkFirst[c]
            }
        }
        return { positions, elements, chunkFirst, chunkCount }
    })
}
