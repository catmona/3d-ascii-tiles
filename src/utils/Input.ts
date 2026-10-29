// Collects raw input as it arrives; the game reads it once per frame, then calls EndFrame
export class InputController {
    public keys = new Set<string>() // held down
    public pressed = new Set<string>() // went down this frame
    public drag = { x: 0, y: 0 } // mouse movement this frame while a button is held
    public wheel = 0 // scroll this frame

    private dragging = false

    public constructor(target: HTMLElement) {
        target.addEventListener('mousedown', () => {
            this.dragging = true
        })
        target.addEventListener('contextmenu', (e) => e.preventDefault())
        window.addEventListener('mouseup', () => {
            this.dragging = false
        })
        window.addEventListener('mousemove', (e) => {
            if (this.dragging) {
                this.drag.x += e.movementX
                this.drag.y += e.movementY
            }
        })

        window.addEventListener(
            'wheel',
            (e) => {
                // Browsers report shift+scroll as horizontal scrolling
                this.wheel += e.deltaY || e.deltaX
            },
            { passive: true }
        )

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase()
            if (!e.repeat) this.pressed.add(key)
            this.keys.add(key)
        })
        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key.toLowerCase())
        })
        window.addEventListener('blur', () => {
            this.keys.clear()
            this.dragging = false
        })
    }

    public EndFrame() {
        this.pressed.clear()
        this.drag.x = 0
        this.drag.y = 0
        this.wheel = 0
    }
}
