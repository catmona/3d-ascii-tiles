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
                camera.pitch = Math.max(
                    -Math.PI / 2,
                    Math.min(Math.PI / 2, camera.pitch - dy * 0.002)
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

        const speed = 0.1
        function MoveUp() {
            camera.position.x += camera.forward.x * speed
            camera.position.y += camera.forward.y * speed
        }
        function MoveDown() {
            camera.position.x -= camera.forward.x * speed
            camera.position.y -= camera.forward.y * speed
        }
        function MoveLeft() {
            camera.position.x -= camera.right.x * speed
            camera.position.y -= camera.right.y * speed
        }
        function MoveRight() {
            camera.position.x += camera.right.x * speed
            camera.position.y += camera.right.y * speed
        }
    }
}
