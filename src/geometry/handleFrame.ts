import { Cartesian3, Matrix3, Matrix4 } from '@cesium/engine'
import type { GeometryFrameContext } from '../core/frame'
import type { Handle } from './types'

/**
 * 绘制与拾取共用同一条矩阵选择规则，避免两边各写一份 if 而漂移。
 */
export function matrixForHandle(handle: Handle, frame: GeometryFrameContext): Matrix4 {
  switch (handle.frameKind) {
    case 'view':
      return frame.viewMatrix
    case 'gizmo':
      return frame.gizmoMatrix
    case 'axisFlip':
      return frame.axisFlipMatrix
  }
}

const scratchToCamWorld = new Cartesian3()
const scratchRotation = new Matrix3()

/** 相机方向在 gizmo 局部系下的单位向量，单面剔除用。 */
export function toCameraLocal(
  frame: GeometryFrameContext,
  result = new Cartesian3(),
): Cartesian3 {
  const control = frame.effectiveControl
  Cartesian3.subtract(
    frame.environment.camera.positionWorld,
    control.translation,
    scratchToCamWorld,
  )
  if (Cartesian3.magnitudeSquared(scratchToCamWorld) < 1e-18) {
    return Cartesian3.clone(Cartesian3.UNIT_Z, result)
  }
  Cartesian3.normalize(scratchToCamWorld, scratchToCamWorld)
  Matrix3.fromQuaternion(control.rotation, scratchRotation)
  Matrix3.transpose(scratchRotation, scratchRotation)
  Matrix3.multiplyByVector(scratchRotation, scratchToCamWorld, result)
  if (Cartesian3.magnitudeSquared(result) < 1e-18) {
    return Cartesian3.clone(Cartesian3.UNIT_Z, result)
  }
  return Cartesian3.normalize(result, result)
}
