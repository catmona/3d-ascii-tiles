export class Vector3 {
    x: number
    y: number
    z: number

    public constructor(x: number, y: number, z: number) {
        this.x = x
        this.y = y
        this.z = z
    }

    public static get Zero(): Vector3 {
        return new Vector3(0, 0, 0)
    }
}
