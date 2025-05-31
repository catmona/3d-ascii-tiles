import { Vector3 } from '../core/Types'

export class Camera {
    public position: Vector3 // 3D position in world coordinates
    public rotation: number // in radians
    public pitch: number // in radians
    public zoom: number
    public forward: Vector3 // direction vector
    public right: Vector3 // direction vector

    public constructor() {
        this.position = { x: 0, y: 0, z: 0 } // center of the map
        this.rotation = 0 // facing "north"
        this.pitch = 0 // level view
        this.zoom = 1 // default zoom level
        this.UpdateDirectionVectors()
    }

    private UpdateDirectionVectors() {
        this.forward = {
            x: Math.cos(this.rotation),
            y: Math.sin(this.rotation),
            z: 0,
        }
        this.right = {
            x: -Math.sin(this.rotation),
            y: Math.cos(this.rotation),
            z: 0,
        }
    }

    public rotate(dRotation: number) {
        this.rotation += dRotation
        this.UpdateDirectionVectors()
    }

    public tilt(dPitch: number) {
        this.pitch += dPitch
    }

    public setZoom(newZoom: number) {
        this.zoom = newZoom
    }
}
