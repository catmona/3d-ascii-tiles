import { renderer } from '../render/Renderer'
import { FPS } from '../core/Game'
import { useSignal } from './useSignal'

const degrees = (radians: number) =>
    ((Math.round((radians * 180) / Math.PI) % 360) + 360) % 360

export default function HUD() {
    const fps = useSignal(FPS)
    const drawCalls = useSignal(renderer.draws)
    const glyphs = useSignal(renderer.glyphs)
    const drawn = useSignal(renderer.drawn)
    const lights = useSignal(renderer.lights)
    const distance = useSignal(renderer.Camera.distance)
    const fov = useSignal(renderer.Camera.fov)
    const cameraTransform = useSignal(renderer.Camera.transform)
    const { position, rotation, pitch } = cameraTransform

    return (
        <div className="m-2 rounded bg-black/60 px-3 py-2 font-mono text-xs leading-5 text-white">
            <div>FPS: {Math.round(fps)}</div>
            <div>
                Focus: ({position.x.toFixed(1)}, {position.y.toFixed(1)},{' '}
                {position.z.toFixed(1)})
            </div>
            <div>
                Yaw: {degrees(rotation)}° · Pitch: {degrees(pitch)}°
            </div>
            <div>
                Distance: {distance.toFixed(0)} · FOV: {fov.toFixed(0)}°
            </div>
            <div>
                Glyphs: {drawn.toLocaleString()} drawn of{' '}
                {glyphs.toLocaleString()}
            </div>
            <div>
                Draw Calls: {drawCalls} · Lights: {lights}
            </div>
            <div className="mt-1 text-white/50">
                WASD walk · shift sprint · drag orbit · Q/E turn 45° · R/F tilt
                · scroll zoom · shift+scroll FOV
            </div>
        </div>
    )
}
