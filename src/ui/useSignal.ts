import { useEffect, useState } from 'react'
import { Signal } from '../utils/Signal'

// Mirror a Signal into React state for as long as the component is mounted
export function useSignal<T>(signal: Signal<T>): T {
    const [value, setValue] = useState(signal.data)

    useEffect(() => {
        const listener = (data: T) => setValue(() => data)
        signal.addListener(listener)
        return () => signal.removeListener(listener)
    }, [signal])

    return value
}
