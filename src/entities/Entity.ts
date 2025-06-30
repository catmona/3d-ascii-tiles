import { SystemType, Vector3 } from '../core/Types'
import { Signal } from '../utils/Signal'
import { Transform } from './Transform'

export abstract class Entity {
    public id: number // TODO id grabbing should be automatic
    public transform: Signal<Transform>
    public systems: SystemType[] = []

    public constructor(position: Vector3 = Vector3.Zero) {
        this.id = -1 // Placeholder for ID, should be set by the entity manager
        this.transform = new Signal<Transform>(new Transform(position))
    }

    public Update() {
        // Update logic for the entity
    }

    public UpdatePhysics(deltaTime: number) {}

    public MoveForward(speed: number) {
        this.transform.data.move(
            -Math.sin(this.transform.data.rotation) * speed,
            -Math.cos(this.transform.data.rotation) * speed,
            0
        )
    }
    public MoveBack(speed: number) {
        this.transform.data.move(
            Math.sin(this.transform.data.rotation) * speed,
            Math.cos(this.transform.data.rotation) * speed,
            0
        )
    }
    public MoveLeft(speed: number) {
        this.transform.data.move(
            -Math.cos(this.transform.data.rotation) * speed,
            Math.sin(this.transform.data.rotation) * speed,
            0
        )
    }
    public MoveRight(speed: number) {
        this.transform.data.move(
            Math.cos(this.transform.data.rotation) * speed,
            -Math.sin(this.transform.data.rotation) * speed,
            0
        )
    }
}
