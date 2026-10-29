export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
}

// mulberry32: same seed, same world every reload
export function seededRandom(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// Hash a lattice point to [0, 1)
export function hash2(x: number, y: number, seed: number): number {
    let h =
        Math.imul(x, 374761393) +
        Math.imul(y, 668265263) +
        Math.imul(seed, 1442695041)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function valueNoise(x: number, y: number, seed: number): number {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)

    const top = lerp(hash2(x0, y0, seed), hash2(x0 + 1, y0, seed), sx)
    const bottom = lerp(
        hash2(x0, y0 + 1, seed),
        hash2(x0 + 1, y0 + 1, seed),
        sx
    )
    return lerp(top, bottom, sy)
}

// Fractal noise: octaves of value noise, each twice the frequency and half the weight
export function fbm(x: number, y: number, seed: number, octaves = 5): number {
    let sum = 0
    let amplitude = 0.5
    let frequency = 1
    let total = 0
    for (let i = 0; i < octaves; i++) {
        sum += amplitude * valueNoise(x * frequency, y * frequency, seed + i)
        total += amplitude
        amplitude *= 0.5
        frequency *= 2
    }
    return sum / total
}
