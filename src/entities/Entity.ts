import { Vector3 } from '../core/Types'
import { Signal } from '../utils/Signal'
import { Transform } from './Transform'

export abstract class Entity {
    public id: number // TODO id grabbing should be automatic
    public transform: Signal<Transform>

    public constructor(id: number, position: Vector3 = Vector3.Zero) {
        this.id = id
        this.transform = new Signal<Transform>(new Transform(position))
    }

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
