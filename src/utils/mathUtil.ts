import {Matrix3, Matrix4} from "@cesium/engine";

export function rotate(
    rotation: Matrix3,
    result: Matrix4 = new Matrix4(),
): Matrix4 {
    return Matrix4.fromRotation(rotation, result)
}