import { Vector3 } from '../core/Types'
import { Signal } from '../utils/Signal'

export class Camera {
    public position = new Signal<Vector3>(Vector3.Zero) // 3D position in world coordinates
    public rotation = new Signal<number>(0) // in radians
    public pitch = new Signal<number>(0) // in radians
    public zoom = new Signal<number>(1)
    public forward = new Signal<Vector3>(Vector3.Zero) // direction vector
    public right = new Signal<Vector3>(Vector3.Zero) // direction vector

    public constructor() {
        this.UpdateDirectionVectors()
    }

    private UpdateDirectionVectors() {
        const cosPitch = Math.cos(this.pitch.data)
        const sinPitch = Math.sin(this.pitch.data)
        const cosYaw = Math.cos(this.rotation.data)
        const sinYaw = Math.sin(this.rotation.data)

        // Forward vector (Z-forward, Y-up)
        this.forward.data = {
            x: cosPitch * sinYaw,
            y: sinPitch,
            z: cosPitch * cosYaw,
        }

        // World up vector (Y-up)
        const up = { x: 0, y: 1, z: 0 }

        // Right vector = up x forward (cross product)
        this.right.data = {
            x: up.y * this.forward.data.z - up.z * this.forward.data.y,
            y: up.z * this.forward.data.x - up.x * this.forward.data.z,
            z: up.x * this.forward.data.y - up.y * this.forward.data.x,
        }
    }

    public move(dx: number, dy: number, dz: number) {
        this.position.data = {
            x: this.position.data.x + dx,
            y: this.position.data.y + dy,
            z: this.position.data.z + dz,
        }
    }

    public rotate(dRotation: number) {
        this.rotation.data += dRotation
        this.UpdateDirectionVectors()
    }
}
