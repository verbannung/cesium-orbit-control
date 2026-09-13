import { Cartesian3, Matrix4, Quaternion } from '@cesium/engine'
import type { ControllerFrameContext } from '../core/frame'
import type { ResolvedOptions } from '../core/options'
import type { PointerInput } from '../core/pointer'
import type {
  SessionContext,
  WorldPolygon,
  WorldPolyline,
  WorldSegment,
} from '../core/snapshots'
import type {
  BaseTransformFrameState,
  RotateFrameState,
  RotateSpatialState,
  RotateTransformState,
} from '../core/state'
import { RING_RADIUS, VIEW_AXIS_RADIUS } from '../geometry/geometryUtil'
import { intersectPlane } from '../math/ray'
import { createBaseDetail, gizmoScale, normalizeOrNull } from './detailFactory'
import type { RotateDetail, RotateRuntime } from './details'
import { InteractionController, type TransformResult } from './interactionController'

const RING_SEGMENTS = 64
const LONG_AXIS_EXTENT = 6
const NORMAL_LENGTH = 1.35

const scratchCurrent = new Cartesian3()
const scratchStart = new Cartesian3()
const scratchQ = new Cartesian3()
const scratchCross = new Cartesian3()
const scratchRotated = new Cartesian3()

export class RotateController extends InteractionController<
  RotateDetail,
  RotateRuntime,
  RotateTransformState,
  RotateSpatialState,
  RotateFrameState
> {
  constructor(private readonly options: ResolvedOptions) {
    super()
  }

  protected createDetail(
    input: PointerInput,
    session: SessionContext,
    frame: ControllerFrameContext,
  ): RotateDetail | null {
    const seed = createBaseDetail(input, session, frame, this.options)
    if (!seed) return null

    // 旋转平面的法线就是旋转轴，createBaseDetail 已按此规则建面。
    const axisWorld = Cartesian3.clone(seed.planeNormalWorld, new Cartesian3())
    const axisLocal = Cartesian3.clone(seed.planeNormalLocal, new Cartesian3())

    // 半径守卫：起始交点离轴心太近则拖拽不稳定。
    Cartesian3.subtract(seed.startPointWorld, seed.planeOriginWorld, scratchStart)
    const radiusWorld = Cartesian3.magnitude(scratchStart)
    if (radiusWorld < this.options.minRotateRadius) return null

    const startDirectionWorld = Cartesian3.clone(scratchStart, new Cartesian3())
    if (!normalizeOrNull(startDirectionWorld)) return null
    const startDirectionLocal = Matrix4.multiplyByPointAsVector(
      seed.worldToLocalAtStart,
      startDirectionWorld,
      new Cartesian3(),
    )
    if (!normalizeOrNull(startDirectionLocal)) return null

    return {
      mode: 'rotate',
      startPointWorld: seed.startPointWorld,
      planeOriginWorld: seed.planeOriginWorld,
      planeNormalWorld: seed.planeNormalWorld,
      localToWorldAtStart: seed.localToWorldAtStart,
      worldToLocalAtStart: seed.worldToLocalAtStart,
      startControl: seed.startControl,
      axisLocal,
      axisWorld,
      startDirectionLocal,
      startDirectionWorld,
      radiusWorld,
      viewAligned: session.handle.constraint.kind === 'view',
    }
  }

  protected createRuntime(): RotateRuntime {
    return { revision: 0, previousRawAngle: 0, completedTurns: 0 }
  }

  /**
   * 旋转公式（世界系，减中心项后在旋转平面内）：
   *   s = p₀ − T₀,  q = p − T₀         均 ⊥ axisWorld
   *   θ_raw = atan2((s × q)·axisWorld, s·q) ∈ (−π, π]
   *   跨帧 unwrap：d = θ_raw − prevRaw
   *     d > π  → turns--（跨过 −π/π 边界向负方向转）
   *     d < −π → turns++
   *   θ = θ_raw + 2π·turns（总旋转角，支持多圈）
   *   R = fromAxisAngle(axisWorld, θ) ⊗ R₀（世界轴左乘）
   */
  protected computeTransform(
    input: PointerInput,
    detail: RotateDetail,
    runtime: RotateRuntime,
  ): TransformResult<RotateTransformState> | null {
    const current = intersectPlane(
      input.rayWorld,
      detail.planeOriginWorld,
      detail.planeNormalWorld,
      scratchCurrent,
    )
    if (!current) return null

    Cartesian3.subtract(detail.startPointWorld, detail.planeOriginWorld, scratchStart)
    Cartesian3.subtract(current, detail.planeOriginWorld, scratchQ)

    // 半径守卫：当前交点过近则本帧不成立，不推进 unwrap 记忆。
    if (Cartesian3.magnitude(scratchQ) < this.options.minRotateRadius * detail.radiusWorld) {
      return null
    }

    const axis = detail.axisWorld
    const sinTheta = Cartesian3.dot(
      Cartesian3.cross(scratchStart, scratchQ, scratchCross),
      axis,
    )
    const cosTheta = Cartesian3.dot(scratchStart, scratchQ)
    const rawAngle = Math.atan2(sinTheta, cosTheta)
    if (!Number.isFinite(rawAngle)) return null

    // 计算成功后才推进 runtime。
    const d = rawAngle - runtime.previousRawAngle
    if (d > Math.PI) runtime.completedTurns--
    else if (d < -Math.PI) runtime.completedTurns++
    runtime.previousRawAngle = rawAngle

    const accumulatedAngle = rawAngle + 2 * Math.PI * runtime.completedTurns

    const deltaRotation = Quaternion.fromAxisAngle(axis, accumulatedAngle, new Quaternion())
    const resultingRotation = Quaternion.multiply(
      deltaRotation,
      detail.startControl.rotation,
      new Quaternion(),
    )

    return {
      transform: {
        rawAngle,
        accumulatedAngle,
        // 显示单圈角：扇形因此恒定有界，多圈由 accumulatedAngle 表达。
        displayAngle: rawAngle,
        axisWorld: Cartesian3.clone(axis, new Cartesian3()),
        deltaRotation,
        resultingRotation,
      },
      control: {
        translation: detail.startControl.translation,
        rotation: resultingRotation,
        scale: detail.startControl.scale,
      },
      pointerWorld: Cartesian3.clone(current, new Cartesian3()),
    }
  }

  protected buildWorldSpatialState(
    result: TransformResult<RotateTransformState>,
    detail: RotateDetail,
    frame: ControllerFrameContext,
  ): RotateSpatialState {
    const center = detail.planeOriginWorld
    const scale = gizmoScale(frame)
    const radius = (detail.viewAligned ? VIEW_AXIS_RADIUS : RING_RADIUS) * scale
    const axis = detail.axisWorld
    const start = Cartesian3.multiplyByScalar(
      detail.startDirectionWorld,
      radius,
      new Cartesian3(),
    )

    return {
      centerWorld: Cartesian3.clone(center, new Cartesian3()),
      startPointWorld: Cartesian3.clone(detail.startPointWorld, new Cartesian3()),
      currentPointWorld: Cartesian3.clone(result.pointerWorld, new Cartesian3()),
      ringWorld: buildRing(center, start, axis),
      sectorWorld: buildSector(center, start, axis, result.transform.displayAngle),
      axisGuideWorld: !detail.viewAligned
        ? segmentThrough(center, axis, LONG_AXIS_EXTENT * scale)
        : null,
      normalGuideWorld: !detail.viewAligned
        ? {
            start: Cartesian3.clone(center, new Cartesian3()),
            end: Cartesian3.add(
              center,
              Cartesian3.multiplyByScalar(axis, NORMAL_LENGTH * scale, new Cartesian3()),
              new Cartesian3(),
            ),
          }
        : null,
      labelAnchorWorld: Cartesian3.clone(result.pointerWorld, new Cartesian3()),
    }
  }

  protected createFrameState(
    base: BaseTransformFrameState,
    transform: RotateTransformState,
    spatial: RotateSpatialState,
  ): RotateFrameState {
    return { ...base, mode: 'rotate', transform, spatial }
  }
}

function buildRing(
  center: Cartesian3,
  startOffset: Cartesian3,
  axis: Cartesian3,
): WorldPolyline {
  const points: Cartesian3[] = []
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const angle = (i / RING_SEGMENTS) * Math.PI * 2
    points.push(offsetPoint(center, startOffset, axis, angle))
  }
  return { points, closed: true }
}

function buildSector(
  center: Cartesian3,
  startOffset: Cartesian3,
  axis: Cartesian3,
  signedAngle: number,
): WorldPolygon {
  const points: Cartesian3[] = [Cartesian3.clone(center, new Cartesian3())]
  if (!Number.isFinite(signedAngle)) return { points }

  const segments = Math.max(
    2,
    Math.ceil((Math.abs(signedAngle) / (Math.PI * 2)) * RING_SEGMENTS),
  )
  for (let i = 0; i <= segments; i++) {
    points.push(offsetPoint(center, startOffset, axis, signedAngle * (i / segments)))
  }
  return { points }
}

function offsetPoint(
  center: Cartesian3,
  offset: Cartesian3,
  axis: Cartesian3,
  angle: number,
): Cartesian3 {
  rotateAroundAxis(offset, axis, angle, scratchRotated)
  return Cartesian3.add(center, scratchRotated, new Cartesian3())
}

/** Rodrigues 轴角旋转。 */
function rotateAroundAxis(
  vector: Cartesian3,
  axis: Cartesian3,
  angle: number,
  result: Cartesian3,
): Cartesian3 {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  Cartesian3.cross(axis, vector, scratchCross)
  const parallelScale = Cartesian3.dot(axis, vector) * (1 - cosine)
  result.x = vector.x * cosine + scratchCross.x * sine + axis.x * parallelScale
  result.y = vector.y * cosine + scratchCross.y * sine + axis.y * parallelScale
  result.z = vector.z * cosine + scratchCross.z * sine + axis.z * parallelScale
  return result
}

function segmentThrough(
  center: Cartesian3,
  direction: Cartesian3,
  halfLength: number,
): WorldSegment {
  const offset = Cartesian3.multiplyByScalar(direction, halfLength, new Cartesian3())
  return {
    start: Cartesian3.subtract(center, offset, new Cartesian3()),
    end: Cartesian3.add(center, offset, new Cartesian3()),
  }
}
