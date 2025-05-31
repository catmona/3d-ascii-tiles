import { renderer } from '../render/Renderer'

export class InputController {
    public keys = new Set<string>()

    public constructor() {
        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement) {
                const dx = -e.movementX
                const dy = -e.movementY

                renderer.Camera.rotate(dx * 0.002) // adjust sensitivity

                // Clamp pitch to prevent flipping
                renderer.Camera.pitch.data = Math.max(
                    0,
                    Math.min(
                        Math.PI / 2,
                        renderer.Camera.pitch.data - dy * 0.002
                    )
                )
            }
        })

        window.addEventListener('keydown', (e) => {
            this.keys.add(e.key.toLowerCase())
        })
        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key.toLowerCase())
        })
    }
}
