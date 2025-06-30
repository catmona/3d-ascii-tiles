import { SystemType } from '../core/Types'
import { Entity } from './Entity'

export class EntityManager {
    private entities = new Map<number, Entity>()
    private systems: Record<SystemType, Set<number>> = {
        [SystemType.Physics]: new Set(),
        // add more here
    }
    private nextEntityId = 0

    public AddEntity(entity: Entity): number {
        this.entities.set(this.nextEntityId, entity)
        entity.id = this.nextEntityId

        for (const system of entity.systems) {
            this.systems[system].add(entity.id)
        }

        return this.nextEntityId++
    }

    public RemoveEntity(entityId: number): void {
        const entity = this.entities.get(entityId)
        if (!entity) {
            throw new Error(`Entity with ID ${entityId} does not exist.`)
        }

        this.entities.delete(entityId)
        for (const system of entity.systems) {
            this.systems[system].delete(entityId)
        }
    }

    public UpdateAll(deltaTime: number): void {
        // base update for all entities
        for (const entity of this.entities.values()) {
            entity.Update()
        }

        // update entities with physics system
        for (const id of this.systems[SystemType.Physics]) {
            const entity = this.entities.get(id)
            if (entity) {
                entity.UpdatePhysics(deltaTime)
            }
        }

        // add more system updates here
    }
}
