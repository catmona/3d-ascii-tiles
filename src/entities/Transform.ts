import { Vector3 } from '../core/Types'

export class Transform {
    public position: Vector3

    public rotation: number
    public pitch: number
    public forward!: Vector3
    public right!: Vector3

    public constructor(
        position: Vector3,
        rotation: number = 0,
        pitch: number = 0
    ) {
        this.position = position
        this.rotation = rotation // in radians
        this.pitch = pitch // in radians

        this.UpdateDirectionVectors()
    }

    private UpdateDirectionVectors() {
        const cosPitch = Math.cos(this.pitch)
        const sinPitch = Math.sin(this.pitch)
        const cosYaw = Math.cos(this.rotation)
        const sinYaw = Math.sin(this.rotation)

        // Forward vector (Z-forward, Y-up)
        this.forward = {
            x: cosPitch * sinYaw,
            y: sinPitch,
            z: cosPitch * cosYaw,
        }

        // World up vector (Y-up)
        const up = { x: 0, y: 1, z: 0 }

        // Right vector = up x forward (cross product)
        this.right = {
            x: up.y * this.forward.z - up.z * this.forward.y,
            y: up.z * this.forward.x - up.x * this.forward.z,
            z: up.x * this.forward.y - up.y * this.forward.x,
        }
    }

    public move(dx: number, dy: number, dz: number) {
        this.position = {
            x: this.position.x + dx,
            y: this.position.y + dy,
            z: this.position.z + dz,
        }
    }

    public rotate(dRotation: number, dPitch: number) {
        this.rotation += dRotation

        // Clamp pitch to prevent flipping
        this.pitch = Math.max(0, Math.min(Math.PI / 2, this.pitch - dPitch))

        this.UpdateDirectionVectors()
    }
}
