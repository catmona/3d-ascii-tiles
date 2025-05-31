import { Vector3 } from '../core/Types'

export class Camera {
    public position: Vector3 // 3D position in world coordinates
    public rotation: number // in radians
    public pitch: number // in radians
    public zoom: number

    public constructor() {
        this.position = { x: 0, y: 0, z: 0 } // center of the map
        this.rotation = 0 // facing "north"
        this.pitch = 0 // level view
        this.zoom = 1 // default zoom level
    }

    public move(dx: number, dy: number, dz: number) {
        this.position.x += dx
        this.position.y += dy
        this.position.z += dz
    }

    public rotate(dRotation: number) {
        this.rotation += dRotation
    }

    public tilt(dPitch: number) {
        this.pitch += dPitch
    }

    public setZoom(newZoom: number) {
        this.zoom = newZoom
    }
}
