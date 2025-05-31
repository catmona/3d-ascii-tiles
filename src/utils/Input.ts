import { Camera } from '../render/Camera'

export class InputController {
    private camera: Camera

    public constructor(camera: Camera) {
        this.camera = camera

        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.camera.rotate(-0.1) // Rotate left
            if (e.key === 'ArrowRight') this.camera.rotate(0.1) // Rotate right
            if (e.key === 'ArrowUp') this.camera.move(0, -1, 0) // Move up
            if (e.key === 'ArrowDown') this.camera.move(0, 1, 0) // Move down

            // TODO functionize in camera class
            if (e.key === 'q')
                this.camera.pitch = Math.min(
                    Math.PI / 2,
                    this.camera.pitch + 0.05
                )
            if (e.key === 'e')
                this.camera.pitch = Math.max(0.1, this.camera.pitch - 0.05)
        })
    }
}
