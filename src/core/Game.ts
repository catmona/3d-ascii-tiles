import { Renderer } from '../render/Renderer'
import { InputController } from '../utils/Input'

export function startGame() {
    console.log('Game started')

    const renderer = new Renderer()
    const inputController = new InputController(renderer.Camera)

    let lastTime = performance.now()
    function gameLoop(currentTime: number) {
        const deltaTime = currentTime - lastTime
        lastTime = currentTime

        update(deltaTime)
        renderer.Draw()
        requestAnimationFrame(gameLoop)
    }

    gameLoop(lastTime)

    function update(deltaTime: number) {}
}
