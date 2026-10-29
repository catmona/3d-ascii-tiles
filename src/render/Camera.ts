import { Vector3 } from '../core/Types'
import { Entity } from '../entities/Entity'
import { InputController } from '../utils/Input'
import { clamp } from '../utils/Math'
import { Signal } from '../utils/Signal'

const MIN_PITCH = 0.52 // 30°: below this, floating glyphs stop reading as ground
const MAX_PITCH = Math.PI / 2 - 0.01 // straight down
const MIN_DISTANCE = 8
const MAX_DISTANCE = 700
const MIN_FOV = 15 // degrees, vertical
const MAX_FOV = 100
const DRAG_SENSITIVITY = 0.005 // radians per pixel
const TILT_SPEED = 1.2 // radians per second while R/F is held
const STEP = Math.PI / 4 // Q/E turn in 45° steps

// How quickly each part of the camera closes the gap to its target, per second
const FOLLOW_RATE = 8
const TURN_RATE = 10
const ZOOM_RATE = 12
const DUCK_RATE = 20 // ducking in front of a hill that has come between camera and @
const RISE_RATE = 3 // and easing back out once it's clear

// The line of sight runs from the @ (this far above the ground) to the eye, and has
// to clear the terrain by this much, less right beside the @ where it starts out at
// ground level
const SIGHT_HEIGHT = 1
const SIGHT_CLEARANCE = 1.5
const SIGHT_SAMPLES = 160
const MIN_DUCK = 4 // ducking may bring the camera closer than scrolling can
const RIDE_UP = 0.05 // radians per step when tilting up over a slope

// An orbit camera. The transform holds the focus point and the angles drawn this
// frame; input only moves the targets, and everything eases toward them.
export class Camera extends Entity {
    public distance = new Signal<number>(60)
    public fov = new Signal<number>(40)

    private targetYaw: number
    private targetPitch: number
    private targetDistance = this.distance.data
    private targetFov = this.fov.data
    private ducking = false

    // The distance the player chose, before any hill pulled the camera in
    public get zoom(): number {
        return this.targetDistance
    }

    public constructor(focus: Vector3, yaw: number, pitch: number) {
        super(focus)
        this.targetYaw = yaw
        this.targetPitch = pitch
        this.transform.data.orient(yaw, pitch)
    }

    public Control(input: InputController, deltaTime: number) {
        const dt = deltaTime / 1000

        this.targetYaw -= input.drag.x * DRAG_SENSITIVITY
        this.targetPitch += input.drag.y * DRAG_SENSITIVITY

        if (input.pressed.has('q')) {
            this.targetYaw =
                (Math.floor(this.targetYaw / STEP + 1e-6) + 1) * STEP
        }
        if (input.pressed.has('e')) {
            this.targetYaw =
                (Math.ceil(this.targetYaw / STEP - 1e-6) - 1) * STEP
        }
        if (input.keys.has('r')) this.targetPitch += TILT_SPEED * dt
        if (input.keys.has('f')) this.targetPitch -= TILT_SPEED * dt
        this.targetPitch = clamp(this.targetPitch, MIN_PITCH, MAX_PITCH)

        // Scroll pulls the camera in and out; shift+scroll widens or narrows the lens
        if (input.keys.has('shift')) {
            this.targetFov = clamp(
                this.targetFov + input.wheel * 0.03,
                MIN_FOV,
                MAX_FOV
            )
        } else {
            this.targetDistance = clamp(
                this.targetDistance * Math.exp(input.wheel * 0.0015),
                MIN_DISTANCE,
                MAX_DISTANCE
            )
        }
    }

    // ground(x, y) is the terrain height, so the camera can keep hills out of the way
    public Follow(
        focus: Vector3,
        deltaTime: number,
        ground?: (x: number, y: number) => number
    ) {
        const dt = deltaTime / 1000
        const ease = (rate: number) => 1 - Math.exp(-rate * dt)
        const transform = this.transform.data
        const { position, rotation, pitch } = transform

        const follow = ease(FOLLOW_RATE)
        transform.position = {
            x: position.x + (focus.x - position.x) * follow,
            y: position.y + (focus.y - position.y) * follow,
            z: position.z + (focus.z - position.z) * follow,
        }

        // A third-person camera: if a hill comes between the eye and the @, duck in
        // front of it, and if the slope is steeper than the view (ducking would put
        // the eye in the hillside), ride up over it too
        const turn = ease(TURN_RATE)
        const yaw = rotation + (this.targetYaw - rotation) * turn
        let pitchGoal = this.targetPitch
        if (ground) {
            const enough = Math.max(MIN_DISTANCE, this.targetDistance * 0.5)
            while (
                pitchGoal < MAX_PITCH &&
                this.clearDistance(
                    ground,
                    transform.position,
                    yaw,
                    pitchGoal,
                    enough
                ) < enough
            ) {
                pitchGoal = Math.min(MAX_PITCH, pitchGoal + RIDE_UP)
            }
        }
        transform.orient(yaw, pitch + (pitchGoal - pitch) * turn)

        const zoom = ease(ZOOM_RATE)
        this.ease(this.fov, this.targetFov, zoom)

        // Duck quickly, then drift back out once the view is clear
        const clear = ground
            ? this.clearDistance(
                  ground,
                  transform.position,
                  transform.rotation,
                  transform.pitch,
                  this.targetDistance
              )
            : this.targetDistance
        if (clear < this.distance.data) this.ducking = true
        else if (clear >= this.targetDistance) this.ducking = false
        const rate = this.ducking
            ? clear < this.distance.data
                ? DUCK_RATE
                : RISE_RATE
            : ZOOM_RATE
        this.ease(
            this.distance,
            Math.min(clear, this.targetDistance),
            ease(rate)
        )
    }

    // How far back along a view the eye can sit (up to `distance`) before the
    // terrain cuts the line of sight to the @
    private clearDistance(
        ground: (x: number, y: number) => number,
        focus: Vector3,
        yaw: number,
        pitch: number,
        distance: number
    ): number {
        const back = Math.cos(pitch)
        const dx = Math.sin(yaw) * back
        const dy = Math.cos(yaw) * back
        const dz = Math.sin(pitch)
        const step = Math.max(0.5, distance / SIGHT_SAMPLES)
        // Start a couple of tiles out: the @'s own patch of ground doesn't count
        for (let d = 2; d < distance + step; d += step) {
            const t = Math.min(d, distance)
            const z = focus.z + SIGHT_HEIGHT + dz * t
            const margin = Math.min(SIGHT_CLEARANCE, t * 0.2)
            if (ground(focus.x + dx * t, focus.y + dy * t) + margin > z) {
                return Math.max(MIN_DUCK, t - step * 2)
            }
        }
        return distance
    }

    // Only notify listeners while the value is actually moving
    private ease(signal: Signal<number>, target: number, amount: number) {
        const next = signal.data + (target - signal.data) * amount
        if (Math.abs(next - signal.data) > 1e-4) signal.data = next
    }
}
