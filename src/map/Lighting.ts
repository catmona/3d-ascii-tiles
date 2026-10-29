import { Vector3 } from '../core/Types'
import { Region } from './Tile'

// A point light. Intensity scales its colour; it fades to nothing at `radius` tiles.
export type Light = {
    position: Vector3
    color: string
    radius: number
    intensity: number
    flicker?: number // 0 steady, 1 a guttering flame
    pulse?: number // slow breathing, radians per second
}

const MOTES = 12
// The lights that move: the player's lantern and the motes around them. The map's
// fixed lights live in the renderer's light grid instead.
export const DYNAMIC_LIGHTS = 1 + MOTES

// The little lights that drift around the player take after the realm they're in
type MoteStyle = {
    chars: string[]
    colors: string[]
    size: number
    radius: number
    intensity: number
    flutter: number // darting about, in tiles
    blink: boolean
}

const MOTE_STYLES: Record<Region, MoteStyle> = {
    // Fireflies
    [Region.Wild]: {
        chars: ['•'],
        colors: ['#e4ff8a'],
        size: 0.75,
        radius: 4.5,
        intensity: 1.2,
        flutter: 0,
        blink: true,
    },
    // Will-o'-the-wisps
    [Region.Haunted]: {
        chars: ['°', '•'],
        colors: ['#9fffe0', '#b0c8ff'],
        size: 0.9,
        radius: 6,
        intensity: 0.9,
        flutter: 0.15,
        blink: false,
    },
    // Fairies
    [Region.Fairy]: {
        chars: ['✦', '*'],
        colors: ['#ff9ef0', '#8fd8ff', '#ffe28a', '#c9a2ff'],
        size: 0.85,
        radius: 5,
        intensity: 1.4,
        flutter: 0.5,
        blink: false,
    },
}

export const MOTE_CHARS = Object.values(MOTE_STYLES).flatMap((s) => s.chars)

export type Mote = {
    position: Vector3
    brightness: number
    seed: number
    char: string
    color: string
    size: number
}

// Animates the lights that move (the player's lantern and the motes drifting around
// them) and packs them into flat arrays ready for the shader
export class Lighting {
    public lantern: Light
    public motes: Mote[]
    public positions = new Float32Array(DYNAMIC_LIGHTS * 4) // xyz, radius
    public colors = new Float32Array(DYNAMIC_LIGHTS * 4) // rgb scaled by intensity
    public bounds = new Float32Array(4) // a sphere no light reaches outside of
    public count = 0

    private heightAt: (x: number, y: number) => number
    private regionAt: (x: number, y: number) => Region

    public constructor(
        heightAt: (x: number, y: number) => number,
        regionAt: (x: number, y: number) => Region
    ) {
        this.heightAt = heightAt
        this.regionAt = regionAt
        this.lantern = {
            position: Vector3.Zero,
            color: '#ffb870',
            radius: 13,
            intensity: 0.6,
            flicker: 0.15,
        }
        this.motes = Array.from({ length: MOTES }, (_, i) => ({
            position: Vector3.Zero,
            brightness: 0,
            seed: i * 2.39996, // golden angle, so they start spread out
            char: '•',
            color: '#ffffff',
            size: 1,
        }))
    }

    public Update(time: number, focus: Vector3) {
        this.count = 0
        this.bounds.set([focus.x, focus.y, focus.z, 0])

        const { x, y, z } = this.lantern.position
        this.add(this.lantern, x, y, z + 1.5, time)

        // Motes wander loops around the player
        for (const mote of this.motes) {
            const s = mote.seed
            let px =
                focus.x +
                Math.cos(time * 0.23 + s) * (6 + 9 * Math.sin(s * 3.7))
            let py =
                focus.y +
                Math.sin(time * 0.29 + s * 1.3) * (6 + 9 * Math.cos(s * 2.1))
            const style = MOTE_STYLES[this.regionAt(px, py)]
            px += Math.sin(time * 9 + s * 5) * style.flutter
            py += Math.cos(time * 11 + s * 3) * style.flutter
            const pz =
                this.heightAt(px, py) +
                1.4 +
                Math.sin(time * 1.3 + s) * 0.6 +
                Math.sin(time * 13 + s) * style.flutter * 0.5

            mote.position = new Vector3(px, py, pz)
            mote.brightness = style.blink
                ? Math.max(0, Math.sin(time * 0.9 + s * 3)) ** 2
                : 0.75 + 0.25 * Math.sin(time * 3 + s)
            mote.char = style.chars[Math.floor(s * 7) % style.chars.length]
            mote.color = style.colors[Math.floor(s * 13) % style.colors.length]
            mote.size = style.size
            this.add(
                {
                    position: mote.position,
                    color: mote.color,
                    radius: style.radius,
                    intensity: style.intensity * mote.brightness,
                },
                px,
                py,
                pz,
                time
            )
        }

        // Unused slots: no colour, far away
        for (let i = this.count; i < DYNAMIC_LIGHTS; i++) {
            this.positions.set([1e6, 1e6, 1e6, 1], i * 4)
            this.colors.set([0, 0, 0, 0], i * 4)
        }
    }

    private add(light: Light, x: number, y: number, z: number, time: number) {
        const seed = x * 0.37 + y * 0.71
        const flame =
            0.75 +
            0.25 *
                (Math.sin(time * 13 + seed) * 0.5 +
                    Math.sin(time * 7.3 + seed * 1.7) * 0.3 +
                    Math.sin(time * 23 + seed * 3.1) * 0.2)
        const flicker = light.flicker ?? 0
        let strength = light.intensity * (1 - flicker + flicker * flame)
        if (light.pulse) {
            strength *= 0.7 + 0.3 * Math.sin(time * light.pulse + seed)
        }

        const n = parseInt(light.color.slice(1), 16)
        const i = this.count++ * 4
        this.positions.set([x, y, z, light.radius], i)
        this.colors.set(
            [
                (((n >> 16) & 255) / 255) * strength,
                (((n >> 8) & 255) / 255) * strength,
                ((n & 255) / 255) * strength,
                0,
            ],
            i
        )

        const b = this.bounds
        const reach = Math.hypot(x - b[0], y - b[1], z - b[2]) + light.radius
        b[3] = Math.max(b[3], reach)
    }
}
