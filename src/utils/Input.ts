import { renderer } from '../render/Renderer'

export class InputController {
    public keys = new Set<string>()
    public sensitivity = 0.002

    public constructor() {
        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement) {
                const dx = -e.movementX
                const dy = -e.movementY

                renderer.Camera.transform.data.rotate(
                    dx * this.sensitivity,
                    dy * this.sensitivity
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
