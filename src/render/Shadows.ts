import createREGL from 'regl'

type Vec3 = [number, number, number]

export const SHADOW_SIZE = 2048
// Half the depth range of the light's view, in tiles: enough for a low sun looking
// across the whole map
const DEPTH_RANGE = 1500

// A depth map of the world as seen from the sun (or moon), covering a square around
// the camera's focus. Depth is packed into the RGBA8 colour so it needs no depth
// texture extension; a depth renderbuffer keeps the nearest caster.
export class ShadowMap {
    public framebuffer: createREGL.Framebuffer2D
    public texture: createREGL.Texture2D
    // Light-space axes (xyz) and offsets (w): x and y across the map, z away from
    // the light. Uniforms for both the casters and the receivers.
    public axisX = new Float32Array(4)
    public axisY = new Float32Array(4)
    public axisZ = new Float32Array(4)
    // 1 / half-width across, 1 / half-height, 1 / half-depth, one texel in uv
    public scale = new Float32Array(4)
    private halfX = 1
    private halfY = 1

    public constructor(regl: createREGL.Regl) {
        this.texture = regl.texture({
            width: SHADOW_SIZE,
            height: SHADOW_SIZE,
            min: 'nearest',
            mag: 'nearest',
            wrap: 'clamp',
        })
        this.framebuffer = regl.framebuffer({
            color: this.texture,
            depth: true,
            stencil: false,
        })
    }

    // Look along `key` (toward the light) at the ground within `radius` of `center`.
    // A low sun sees that ground foreshortened, so the view is only as tall as the
    // ground (and the hills on it) appear from there: the texels go where they're
    // needed. It's snapped to whole texels so walking doesn't make the edges crawl.
    public Aim(key: Vec3, center: Vec3, radius: number, relief: number) {
        const into: Vec3 = [-key[0], -key[1], -key[2]]
        // Across: horizontal, square to the light. Up: the rest, pointing skyward so
        // glyph cards stand upright in the light's view as they do in ours.
        let x = cross(into, [0, 0, 1])
        x = normalize(x)
        let y = cross(x, into)
        if (y[2] < 0) {
            y = [-y[0], -y[1], -y[2]]
            x = [-x[0], -x[1], -x[2]]
        }
        // The ground's tilt as seen from the light is the sun's height
        const halfX = radius
        const halfY =
            radius * Math.max(0.2, key[2]) + relief * Math.hypot(key[0], key[1])
        const snap = (v: number, half: number) => {
            const texel = (half * 2) / SHADOW_SIZE
            return Math.round(v / texel) * texel
        }
        this.axisX.set([...x, snap(dot(x, center), halfX)])
        this.axisY.set([...y, snap(dot(y, center), halfY)])
        this.axisZ.set([...into, dot(into, center)])
        this.scale.set([1 / halfX, 1 / halfY, 1 / DEPTH_RANGE, 1 / SHADOW_SIZE])
        this.halfX = halfX
        this.halfY = halfY
    }

    // Whether a sphere throws any shadow into the square (it's inside the light's
    // view, however far toward or away from the light it is)
    public Covers(x: number, y: number, z: number, r: number): boolean {
        const sx = this.axisX
        const sy = this.axisY
        const lx = x * sx[0] + y * sx[1] + z * sx[2] - sx[3]
        const ly = x * sy[0] + y * sy[1] + z * sy[2] - sy[3]
        return Math.abs(lx) < this.halfX + r && Math.abs(ly) < this.halfY + r
    }
}

function cross(a: Vec3, b: Vec3): Vec3 {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

function dot(a: Vec3 | Float32Array, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function normalize(v: Vec3): Vec3 {
    const l = Math.hypot(v[0], v[1], v[2]) || 1
    return [v[0] / l, v[1] / l, v[2] / l]
}
