import { renderer } from '../render/Renderer'
import { InputController } from '../utils/Input'
import { Signal } from '../utils/Signal'

export const FPS = new Signal<number>(0)

export function startGame() {
    console.log('Game started')

    const inputController = new InputController()

    let lastTime = performance.now()
    const frameTimes: number[] = []
    const maxFrames = 60 // average over last 60 frames

    function gameLoop(currentTime: number) {
        const deltaTime = currentTime - lastTime
        lastTime = currentTime

        // --- Average FPS calculation ---
        frameTimes.push(deltaTime)
        if (frameTimes.length > maxFrames) frameTimes.shift()
        const avgDelta =
            frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
        FPS.data = 1000 / avgDelta

        update(deltaTime)
        renderer.Draw()
        requestAnimationFrame(gameLoop)
    }

    gameLoop(lastTime)

    function update(deltaTime: number) {
        // Update game logic here
        // For example, you can update the camera position based on input
        if (inputController.keys.has('w')) {
            renderer.Camera.MoveForward(deltaTime * 0.01) // Adjust speed as needed
        }
        if (inputController.keys.has('s')) {
            renderer.Camera.MoveBack(deltaTime * 0.01)
        }
        if (inputController.keys.has('a')) {
            renderer.Camera.MoveLeft(deltaTime * 0.01)
        }
        if (inputController.keys.has('d')) {
            renderer.Camera.MoveRight(deltaTime * 0.01)
        }
    }
}
