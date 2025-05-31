import { Vector3 } from '../core/Types'
import { Camera } from '../render/Camera'

export class InputController {
    private camera: Camera

    public constructor(camera: Camera) {
        this.camera = camera

        let lastMouseX: number | null = null
        let lastMouseY: number | null = null

        window.addEventListener('mousemove', (e) => {
            if (lastMouseX !== null) {
                const dx = e.clientX - lastMouseX
                camera.rotate(dx * 0.002) // adjust sensitivity
            }
            lastMouseX = e.clientX

            if (lastMouseY !== null) {
                const dy = e.clientY - lastMouseY

                // Clamp pitch to prevent flipping
                camera.pitch.data = Math.max(
                    -Math.PI / 2,
                    Math.min(Math.PI / 2, camera.pitch.data - dy * 0.002)
                ) // adjust sensitivity and clamp pitch
            }
            lastMouseY = e.clientY
        })

        window.addEventListener('keydown', (e) => {
            if (e.key === 'w') MoveUp()
            if (e.key === 's') MoveDown()
            if (e.key === 'a') MoveLeft()
            if (e.key === 'd') MoveRight()
        })

        const speed = 1
        function MoveUp() {
            camera.move(
                Math.sin(camera.rotation.data) * speed,
                Math.cos(camera.rotation.data) * speed,
                0
            )
        }
        function MoveDown() {
            camera.move(
                -Math.sin(camera.rotation.data) * speed,
                -Math.cos(camera.rotation.data) * speed,
                0
            )
        }
        function MoveLeft() {
            camera.move(
                -Math.cos(camera.rotation.data) * speed,
                Math.sin(camera.rotation.data) * speed,
                0
            )
        }
        function MoveRight() {
            camera.move(
                Math.cos(camera.rotation.data) * speed,
                -Math.sin(camera.rotation.data) * speed,
                0
            )
        }
    }
}
