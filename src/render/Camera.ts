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

// An orbit camera. The transform holds the focus point and the angles drawn this
// frame; input only moves the targets, and everything eases toward them.
export class Camera extends Entity {
    public distance = new Signal<number>(60)
    public fov = new Signal<number>(40)

    private targetYaw: number
    private targetPitch: number
    private targetDistance = this.distance.data
    private targetFov = this.fov.data

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

    public Follow(focus: Vector3, deltaTime: number) {
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

        const turn = ease(TURN_RATE)
        transform.orient(
            rotation + (this.targetYaw - rotation) * turn,
            pitch + (this.targetPitch - pitch) * turn
        )

        const zoom = ease(ZOOM_RATE)
        this.ease(this.distance, this.targetDistance, zoom)
        this.ease(this.fov, this.targetFov, zoom)
    }

    // Only notify listeners while the value is actually moving
    private ease(signal: Signal<number>, target: number, amount: number) {
        const next = signal.data + (target - signal.data) * amount
        if (Math.abs(next - signal.data) > 1e-4) signal.data = next
    }
}
