import { Cartesian3, Matrix3, Matrix4 } from '@cesium/engine'
import type { ControllerFrameContext } from '../core/frame'
import type { ResolvedOptions } from '../core/options'
import type { PointerInput } from '../core/pointer'
import { cloneControl } from '../core/controlSnapshot'
import type { ControlSnapshot, SessionContext } from '../core/snapshots'
import type { ControlMode, ResolvedConstraint } from '../core/types'
import { intersectPlane } from '../math/ray'
import type { BaseInteractionDetail } from './details'

const scratchProj = new Cartesian3()
const scratchToCamWorld = new Cartesian3()
const scratchRotation = new Matrix3()
const scratchScale = new Cartesian3()

export interface DragDetailSeed extends BaseInteractionDetail {
  readonly toCameraLocal: Cartesian3
  readonly planeNormalLocal: Cartesian3
}

export function createDragDetailSeed(
  input: PointerInput,
  session: SessionContext,
  frame: ControllerFrameContext,
  options: ResolvedOptions,
): DragDetailSeed | null {
  const control = cloneControl(session.start.control)
  const toCameraLocal = computeToCameraLocal(control, frame)
  const planeNormalLocal = resolveDragPlaneNormalLocal(
    session.mode,
    session.handle.constraint,
    toCameraLocal,
  )
  if (!planeNormalLocal) return null
  if (Math.abs(Cartesian3.dot(planeNormalLocal, toCameraLocal)) < options.degenerateThreshold) {
    return null
  }

  const rotation = Matrix3.fromQuaternion(control.rotation, new Matrix3())
  const localToWorldAtStart = Matrix4.fromRotationTranslation(rotation, control.translation, new Matrix4())
  const worldToLocalAtStart = Matrix4.inverse(localToWorldAtStart, new Matrix4())
  const planeNormalWorld = Matrix3.multiplyByVector(rotation, planeNormalLocal, new Cartesian3())
  if (!normalizeOrNull(planeNormalWorld)) return null

  const planeOriginWorld = Cartesian3.clone(control.translation, new Cartesian3())
  const hit = intersectPlane(input.rayWorld, planeOriginWorld, planeNormalWorld)
  if (!hit) return null

  return {
    startPointWorld: Cartesian3.clone(hit, new Cartesian3()),
    planeOriginWorld,
    planeNormalWorld,
    localToWorldAtStart,
    worldToLocalAtStart,
    startControl: control,
    toCameraLocal: Cartesian3.clone(toCameraLocal, new Cartesian3()),
    planeNormalLocal: Cartesian3.clone(planeNormalLocal, new Cartesian3()),
  }
}

function computeToCameraLocal(
  control: ControlSnapshot,
  frame: ControllerFrameContext,
  result = new Cartesian3(),
): Cartesian3 {
  Cartesian3.subtract(frame.environment.camera.positionWorld, control.translation, scratchToCamWorld)
  if (Cartesian3.magnitudeSquared(scratchToCamWorld) < 1e-18) {
    Cartesian3.clone(Cartesian3.UNIT_Z, scratchToCamWorld)
  } else {
    Cartesian3.normalize(scratchToCamWorld, scratchToCamWorld)
  }
  Matrix3.fromQuaternion(control.rotation, scratchRotation)
  Matrix3.transpose(scratchRotation, scratchRotation)
  Matrix3.multiplyByVector(scratchRotation, scratchToCamWorld, result)
  return normalizeOrNull(result) ?? Cartesian3.clone(Cartesian3.UNIT_Z, result)
}

function resolveDragPlaneNormalLocal(
  mode: ControlMode,
  constraint: ResolvedConstraint,
  toCameraLocal: Cartesian3,
  result = new Cartesian3(),
): Cartesian3 | null {
  switch (constraint.kind) {
    case 'axis': {
      if (mode === 'rotate') return Cartesian3.clone(constraint.axisLocal, result)
      Cartesian3.multiplyByScalar(
        constraint.axisLocal,
        Cartesian3.dot(toCameraLocal, constraint.axisLocal),
        scratchProj,
      )
      Cartesian3.subtract(toCameraLocal, scratchProj, result)
      return normalizeOrNull(result)
    }
    case 'plane':
      return Cartesian3.clone(constraint.normalLocal, result)
    case 'view':
    case 'uniform':
      return Cartesian3.clone(toCameraLocal, result)
  }
}

export function localDirectionToWorld(
  detail: BaseInteractionDetail,
  local: Cartesian3,
  result = new Cartesian3(),
): Cartesian3 | null {
  Matrix4.multiplyByPointAsVector(detail.localToWorldAtStart, local, result)
  return normalizeOrNull(result)
}

export function normalizeOrNull(v: Cartesian3): Cartesian3 | null {
  if (Cartesian3.magnitudeSquared(v) < 1e-18) return null
  return Cartesian3.normalize(v, v)
}

export function gizmoScale(frame: ControllerFrameContext): number {
  const magnitude = Matrix4.getScale(frame.gizmoMatrix, scratchScale).x
  return magnitude > 1e-12 ? magnitude : 1
}
