import { useEffect, useState } from 'react'
import { renderer } from '../render/Renderer'
import { FPS } from '../core/Game'

export default function HUD() {
    const [fps, setFps] = useState(FPS.data)
    const [drawCalls, setDrawCalls] = useState(renderer.draws.data)
    const [cameraTransform, setCameraTransform] = useState(
        renderer.Camera.transform.data
    )

    useEffect(() => {
        const fpsListener = (newFps: typeof FPS.data) => {
            setFps(newFps)
        }
        const drawsListener = (newDraws: typeof renderer.draws.data) => {
            setDrawCalls(newDraws)
        }
        const cameraTransformListener = (
            newTransform: typeof renderer.Camera.transform.data
        ) => {
            setCameraTransform(newTransform)
        }

        FPS.addListener(fpsListener)
        renderer.draws.addListener(drawsListener)
        renderer.Camera.transform.addListener(cameraTransformListener)

        return () => {
            FPS.removeListener(fpsListener)
            renderer.draws.removeListener(drawsListener)
            renderer.Camera.transform.removeListener(cameraTransformListener)
        }
    }, [])

    return (
        <div className="text-white">
            <div>FPS: {fps}</div>
            <div>
                Position: ({cameraTransform.position.x},{' '}
                {cameraTransform.position.y}, {cameraTransform.position.z})
            </div>
            <div>Rotation: {cameraTransform.rotation}°</div>
            <div>Pitch: {cameraTransform.pitch}°</div>
            <div>Draw Calls: {drawCalls}</div>
        </div>
    )
}
