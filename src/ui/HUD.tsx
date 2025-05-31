import { useEffect, useState } from 'react'
import { renderer } from '../render/Renderer'
import { FPS } from '../core/Game'

export default function HUD() {
    const [fps, setFps] = useState(FPS.data)
    const [position, setPosition] = useState(renderer.Camera.position.data)
    const [rotation, setRotation] = useState(renderer.Camera.rotation.data)
    const [pitch, setPitch] = useState(renderer.Camera.pitch.data)
    const [drawCalls, setDrawCalls] = useState(renderer.tilesDrawn.data)

    useEffect(() => {
        const fpsListener = (newFps: typeof FPS.data) => {
            setFps(newFps)
        }
        const positionListener = (
            newPosition: typeof renderer.Camera.position.data
        ) => {
            setPosition(newPosition)
        }
        const rotationListener = (
            newRotation: typeof renderer.Camera.rotation.data
        ) => {
            setRotation(newRotation)
        }
        const pitchListener = (newPitch: typeof renderer.Camera.pitch.data) => {
            setPitch(newPitch)
        }
        const drawCallsListener = (
            newDrawCalls: typeof renderer.tilesDrawn.data
        ) => {
            setDrawCalls(newDrawCalls)
        }

        FPS.addListener(fpsListener)
        renderer.Camera.position.addListener(positionListener)
        renderer.Camera.rotation.addListener(rotationListener)
        renderer.Camera.pitch.addListener(pitchListener)
        renderer.tilesDrawn.addListener(drawCallsListener)

        return () => {
            FPS.removeListener(fpsListener)
            renderer.Camera.position.removeListener(positionListener)
            renderer.Camera.rotation.removeListener(rotationListener)
            renderer.Camera.pitch.removeListener(pitchListener)
            renderer.tilesDrawn.removeListener(drawCallsListener)
        }
    }, [])

    return (
        <div className="text-white">
            <div>FPS: {fps}</div>
            <div>
                Position: ({position.x}, {position.y}, {position.z})
            </div>
            <div>Rotation: {rotation}°</div>
            <div>Pitch: {pitch}°</div>
            <div>Draw Calls: {drawCalls}</div>
        </div>
    )
}
