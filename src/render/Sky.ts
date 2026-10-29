import { Signal } from '../utils/Signal'
import { clamp, lerp, smoothstep } from '../utils/Math'

type RGB = [number, number, number]
type Vec3 = [number, number, number]

// A day takes this long at normal speed, and holding T runs it this much faster
const DAY_SECONDS = 240
const FAST_FORWARD = 30
// Late afternoon, the sun low in the west: long shadows, a warm sky, and the
// torches already lit
export const START_TIME = 0.72
const CLOCK_INTERVAL = 250 // ms between HUD clock updates

// The sun rises in the east, crosses the northern sky (the side the camera looks
// toward by default, so shadows fall toward the viewer) and sets in the west
const SUN_TILT = 1.0 // radians: how high it climbs at noon (57°)
// The moon follows the same arc a little under half a day behind, so it's already
// up in the east when the sun goes down, and sets a few hours before dawn
const MOON_LAG = Math.PI - 0.7

// Everything that changes with the hour. Night is the original dusk palette.
type Palette = {
    zenith: RGB
    horizon: RGB
    glow: RGB // warm band right on the horizon
    backdrop: RGB // behind the ground when looking down
    ambient: RGB // light from the whole sky
    sun: RGB // direct sunlight on a surface facing it
    glowFocus: number // how much the horizon glow gathers on the sun's side
    stars: number
    lights: number // torches and lanterns: brightest at night, washed out by day
    glyphGlow: number // windows, embers and crystals, likewise
}

const NIGHT: Palette = {
    zenith: [0.07, 0.1, 0.21],
    horizon: [0.32, 0.36, 0.5],
    glow: [0.24, 0.15, 0.11],
    backdrop: [0.085, 0.12, 0.13],
    ambient: [0.48, 0.53, 0.68],
    sun: [0, 0, 0],
    glowFocus: 0,
    stars: 1,
    lights: 1.15,
    glyphGlow: 1.6,
}

const DUSK: Palette = {
    zenith: [0.13, 0.15, 0.32],
    horizon: [0.58, 0.42, 0.42],
    glow: [0.62, 0.28, 0.1],
    backdrop: [0.11, 0.1, 0.12],
    ambient: [0.56, 0.5, 0.58],
    sun: [1.2, 0.7, 0.4],
    glowFocus: 1,
    stars: 0.25,
    lights: 1,
    glyphGlow: 1.5,
}

const DAWN: Palette = {
    ...DUSK,
    zenith: [0.16, 0.22, 0.42],
    horizon: [0.62, 0.52, 0.56],
    glow: [0.55, 0.3, 0.2],
    backdrop: [0.1, 0.11, 0.13],
    ambient: [0.54, 0.52, 0.6],
    sun: [1.2, 0.85, 0.65],
}

const DAY: Palette = {
    zenith: [0.2, 0.38, 0.72],
    horizon: [0.6, 0.7, 0.84],
    glow: [0.1, 0.08, 0.05],
    backdrop: [0.11, 0.15, 0.16],
    ambient: [0.42, 0.46, 0.56],
    sun: [1.1, 1.02, 0.88],
    glowFocus: 0.5,
    stars: 0,
    lights: 0.15,
    glyphGlow: 1.15,
}

const MOONLIGHT: RGB = [0.32, 0.38, 0.55]

function mixRGB(a: RGB, b: RGB, t: number): RGB {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

function mixPalette(a: Palette, b: Palette, t: number): Palette {
    return {
        zenith: mixRGB(a.zenith, b.zenith, t),
        horizon: mixRGB(a.horizon, b.horizon, t),
        glow: mixRGB(a.glow, b.glow, t),
        backdrop: mixRGB(a.backdrop, b.backdrop, t),
        ambient: mixRGB(a.ambient, b.ambient, t),
        sun: mixRGB(a.sun, b.sun, t),
        glowFocus: lerp(a.glowFocus, b.glowFocus, t),
        stars: lerp(a.stars, b.stars, t),
        lights: lerp(a.lights, b.lights, t),
        glyphGlow: lerp(a.glyphGlow, b.glyphGlow, t),
    }
}

// Where a body on the shared arc is at a given angle (0 rising in the east, π/2
// highest, in the north, π setting in the west)
function arc(angle: number): Vec3 {
    return [
        Math.cos(angle),
        -Math.sin(angle) * Math.cos(SUN_TILT),
        Math.sin(angle) * Math.sin(SUN_TILT),
    ]
}

// The time of day, and the sky and light that go with it
export class DayCycle {
    public time = START_TIME // 0 midnight, 0.5 noon
    public clock = new Signal<number>(0) // minutes since midnight, for the HUD

    public sun: Vec3 = [0, 0, 1] // toward the sun
    public moon: Vec3 = [0, 0, 1]
    // The light that casts shadows: the sun by day, the moon by night. It swaps
    // over while both are too faint to matter.
    public key: Vec3 = [0, 0, 1]
    public keyColor: RGB = [0, 0, 0]
    public palette: Palette = NIGHT
    public moonGlow = 0 // how bright the moon's disc and halo are

    private sinceClock = 0 // ms since the HUD's clock last changed

    public constructor() {
        this.update()
        this.publish()
    }

    public Advance(deltaTime: number, fast: boolean) {
        const days = deltaTime / 1000 / DAY_SECONDS
        this.time = (this.time + days * (fast ? FAST_FORWARD : 1)) % 1
        this.update()
        // A few times a second at most: the HUD re-renders on every change, and
        // fast-forwarding would otherwise change it every frame
        this.sinceClock += deltaTime
        if (this.sinceClock > CLOCK_INTERVAL) this.publish()
    }

    public Set(time: number) {
        this.time = ((time % 1) + 1) % 1
        this.update()
        this.publish()
    }

    private publish() {
        const minutes = Math.floor((this.time * 24 * 60) / 5) * 5
        if (minutes === this.clock.data) return
        this.clock.data = minutes
        this.sinceClock = 0
    }

    private update() {
        const angle = (this.time - 0.25) * Math.PI * 2
        this.sun = arc(angle)
        this.moon = arc(angle - MOON_LAG)
        const height = this.sun[2]

        // Night until the sun is nearly up, a golden hour either side of the horizon,
        // then day. Mornings are cooler and pinker, evenings warmer.
        const golden = this.sun[0] > 0 ? DAWN : DUSK
        const palette =
            height < 0.03
                ? mixPalette(NIGHT, golden, smoothstep(-0.3, 0.03, height))
                : mixPalette(golden, DAY, smoothstep(0.03, 0.45, height))
        this.palette = palette

        // Sunlight fades as the sun sinks into the haze; once it's gone the moon
        // takes over (and casts the shadows), fading in as the sky darkens
        const sunUp = smoothstep(0, 0.12, height)
        const moonUp =
            smoothstep(0, 0.15, this.moon[2]) * smoothstep(0, -0.15, height)
        if (height > 0) {
            this.key = this.sun
            this.keyColor = palette.sun.map((c) => c * sunUp) as RGB
        } else {
            this.key = this.moon[2] > 0 ? this.moon : [0, 0, 1]
            this.keyColor = MOONLIGHT.map((c) => c * moonUp) as RGB
        }
        this.moonGlow = clamp(
            smoothstep(-0.05, 0.1, this.moon[2]) * (1 - sunUp * 0.7),
            0,
            1
        )
    }
}

// "17:25"
export function formatClock(minutes: number): string {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// A word for the hour
export function partOfDay(minutes: number): string {
    const h = minutes / 60
    if (h < 5) return 'night'
    if (h < 7) return 'dawn'
    if (h < 11) return 'morning'
    if (h < 14) return 'midday'
    if (h < 17) return 'afternoon'
    if (h < 19.5) return 'dusk'
    if (h < 22) return 'evening'
    return 'night'
}
