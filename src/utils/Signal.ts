export class Signal<T> {
    private listeners: Array<(data: T) => void> = []
    private _data: T

    public constructor(initialData: T) {
        this._data = initialData
    }

    public get data(): T {
        return this._data
    }

    public set data(value: T) {
        this._data = value
        this.notify(value)
    }

    public addListener(listener: (data: T) => void): void {
        this.listeners.push(listener)
    }

    public removeListener(listener: (data: T) => void): void {
        this.listeners = this.listeners.filter((l) => l !== listener)
    }

    public notify(data: T): void {
        for (const listener of this.listeners) {
            listener(data)
        }
    }
}
