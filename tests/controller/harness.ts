import { Cartesian2, Cartesian3, Matrix4, Quaternion, Ray } from '@cesium/engine'
import type { ControllerFrameContext } from '../../src/core/frame'
import { resolveOptions } from '../../src/core/options'
import { NO_MODIFIERS, type PointerInput } from '../../src/core/pointer'
import type {
  CameraSnapshot,
  ControlSnapshot,
  SessionContext,
  ViewportSnapshot,
} from '../../src/core/snapshots'
import type { ControlMode, HandleDescriptor, HandleId, ResolvedConstraint } from '../../src/core/types'

export const options = resolveOptions()

const CAMERA_HEIGHT = 10

export function identityControl(): ControlSnapshot {
  return {
    translation: new Cartesian3(),
    rotation: Quaternion.clone(Quaternion.IDENTITY, new Quaternion()),
    scale: new Cartesian3(1, 1, 1),
  }
}

export const viewport: ViewportSnapshot = {
  widthCss: 800,
  heightCss: 600,
  pixelRatio: 1,
}

/** 相机在 +Z 上俯视原点，Gizmo 单位尺度，便于手算期望值。 */
export const camera: CameraSnapshot = {
  positionWorld: new Cartesian3(0, 0, CAMERA_HEIGHT),
  directionWorld: new Cartesian3(0, 0, -1),
  upWorld: new Cartesian3(0, 1, 0),
  rightWorld: new Cartesian3(1, 0, 0),
  viewMatrix: Matrix4.clone(Matrix4.IDENTITY, new Matrix4()),
  projectionMatrix: Matrix4.clone(Matrix4.IDENTITY, new Matrix4()),
}

export function createFrame(
  committedControl: ControlSnapshot = identityControl(),
): ControllerFrameContext {
  const gizmoMatrix = Matrix4.clone(Matrix4.IDENTITY, new Matrix4())
  const inverse = Matrix4.inverse(gizmoMatrix, new Matrix4())
  return {
    environment: { camera, viewport, pixelScale: 100 },
    committedControl,
    gizmoMatrix,
    viewMatrix: Matrix4.clone(Matrix4.IDENTITY, new Matrix4()),
    axisFlipMatrix: Matrix4.clone(Matrix4.IDENTITY, new Matrix4()),
    worldToLocalPoint: (point, result) => Matrix4.multiplyByPoint(inverse, point, result),
    localToWorldPoint: (point, result) => Matrix4.multiplyByPoint(gizmoMatrix, point, result),
    localToWorldVector: (vector, result) =>
      Matrix4.multiplyByPointAsVector(gizmoMatrix, vector, result),
  }
}

/** 从 (x, y, CAMERA_HEIGHT) 垂直向下射，与 z=0 平面交于 (x, y, 0)。 */
export function pointerAt(x: number, y: number): PointerInput {
  return {
    pointerId: 1,
    screenPosition: new Cartesian2(x, y),
    rayWorld: new Ray(
      new Cartesian3(x, y, CAMERA_HEIGHT),
      new Cartesian3(0, 0, -1),
    ),
    modifiers: NO_MODIFIERS,
    timestamp: 0,
  }
}

export function handle(
  id: HandleId,
  mode: ControlMode,
  constraint: ResolvedConstraint,
): HandleDescriptor {
  return {
    id,
    mode,
    constraint,
    visual: { id, color: { toCssColorString: () => '#fff' } as never },
  }
}

export function session(
  descriptor: HandleDescriptor,
  control: ControlSnapshot = identityControl(),
): SessionContext {
  return {
    id: 'session-test',
    mode: descriptor.mode,
    handle: descriptor,
    start: {
      control,
      camera,
      viewport,
    },
  }
}
