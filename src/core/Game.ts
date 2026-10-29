import { EntityManager } from '../entities/EntityManager'
import { Sprite, renderer } from '../render/Renderer'
import { InputController } from '../utils/Input'
import { clamp } from '../utils/Math'
import { Signal } from '../utils/Signal'
import { Vector3 } from './Types'

export const FPS = new Signal<number>(0)

const WALK_SPEED = 10 // tiles per second at the default camera distance
const SPRINT = 3

export function startGame() {
    console.log('Game started')

    const inputController = new InputController(
        document.getElementById('layer-game')!
    )
    const entityManager = new EntityManager()
    const map = renderer.map

    // Stand-in for the player until Player.ts exists: an @ the camera follows
    const { x, y, z } = map.spawn
    const marker: Sprite = {
        char: '@',
        color: '#ffd54a',
        position: new Vector3(x, y, z + 1),
    }
    renderer.sprites.push(marker)
    renderer.lighting.lantern.position = marker.position // carried by the @

    let lastTime = performance.now()
    const frameTimes: number[] = []
    const maxFrames = 60 // average over last 60 frames
    let lastFpsUpdate = 0

    function gameLoop(currentTime: number) {
        const deltaTime = currentTime - lastTime
        lastTime = currentTime

        // --- Average FPS calculation ---
        frameTimes.push(deltaTime)
        if (frameTimes.length > maxFrames) frameTimes.shift()
        // Publish a few times a second: every listener (the HUD) re-renders on each set
        if (currentTime - lastFpsUpdate > 250) {
            lastFpsUpdate = currentTime
            const avgDelta =
                frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
            FPS.data = 1000 / avgDelta
        }

        update(deltaTime)
        renderer.Draw()
        requestAnimationFrame(gameLoop)
    }

    gameLoop(lastTime)

    function update(deltaTime: number) {
        // Update game logic here

        entityManager.UpdateAll(deltaTime)

        // TODO handle input in physics update

        const camera = renderer.Camera
        const keys = inputController.keys
        const forward = Number(keys.has('w')) - Number(keys.has('s'))
        const strafe = Number(keys.has('d')) - Number(keys.has('a'))
        if (forward || strafe) {
            // Walk relative to where the camera faces; pulling the camera back speeds
            // you up so the @ crosses the screen at the same pace at any distance
            const yaw = camera.transform.data.rotation
            const speed =
                (WALK_SPEED * (keys.has('shift') ? SPRINT : 1) * deltaTime) /
                1000 /
                Math.hypot(forward, strafe)
            const scale = speed * (camera.distance.data / 60)
            const position = marker.position
            position.x = clamp(
                position.x +
                    (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * scale,
                0,
                map.mapWidth - 1
            )
            position.y = clamp(
                position.y +
                    (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * scale,
                0,
                map.mapHeight - 1
            )
        }

        const ground = map.HeightAt(marker.position.x, marker.position.y)
        marker.position.z = ground + 1

        camera.Control(inputController, deltaTime)
        camera.Follow(
            new Vector3(marker.position.x, marker.position.y, ground),
            deltaTime
        )
        inputController.EndFrame()
    }
}
