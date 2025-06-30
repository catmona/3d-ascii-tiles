import { Entity } from '../entities/Entity'
import { Signal } from '../utils/Signal'

export class Camera extends Entity {
    public zoom = new Signal<number>(1)
}
