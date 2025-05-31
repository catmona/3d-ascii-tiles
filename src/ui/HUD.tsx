import { useEffect, useState } from 'react'
import { renderer } from '../render/Renderer'
import { render } from 'react-dom'

export default function HUD() {
    const [fps, setFps] = useState(60)
    const [position, setPosition] = useState(renderer.Camera.position.data)
    const [rotation, setRotation] = useState(renderer.Camera.rotation.data)
    const [pitch, setPitch] = useState(renderer.Camera.pitch.data)

    useEffect(() => {
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

        renderer.Camera.position.addListener(positionListener)
        renderer.Camera.rotation.addListener(rotationListener)
        renderer.Camera.pitch.addListener(pitchListener)

        return () => {
            renderer.Camera.position.removeListener(positionListener)
            renderer.Camera.rotation.removeListener(rotationListener)
            renderer.Camera.pitch.removeListener(pitchListener)
        }
    }, [])

    return (
        <div>
            {/* <div>FPS: 60</div> */}
            <div>
                Position: ({position.x}, {position.y}, {position.z})
            </div>
            <div>Rotation: {rotation}°</div>
            <div>Pitch: {pitch}°</div>
        </div>
    )
}
