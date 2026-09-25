import { Cartesian3, Matrix4, Quaternion } from '@cesium/engine'
import type { ControllerFrameContext } from '../render/types'
import type { ResolvedOptions } from '../types'
import type { PointerInput } from '../input/types'
import type {
  ControllerInputParam,
  DragFrameOutcome,
  RotateDetail,
  RotateSessionContext,
  RotateTransformResult,
} from './types'
import type { WorldPolygon, WorldPolyline, WorldSegment } from '../types'
import type { RotateOverlayState } from '../overlay/types'
import { RING_RADIUS, VIEW_AXIS_RADIUS } from '../constants'
import { intersectPlane } from '../util/ray'
import { createDragDetailSeed, gizmoScale, normalizeOrNull } from './controllerUtil'
import { DragSession } from './dragSession'

const RING_SEGMENTS = 64
const LONG_AXIS_EXTENT = 6
const NORMAL_LENGTH = 1.35

const scratchCurrent = new Cartesian3()
const scratchStart = new Cartesian3()
const scratchQ = new Cartesian3()
const scratchCross = new Cartesian3()
const scratchRotated = new Cartesian3()

export class RotateController extends DragSession<RotateSessionContext, RotateDetail> {
  constructor(private readonly options: ResolvedOptions) {
    super()
  }

  protected createSessionContext(param: ControllerInputParam): RotateSessionContext | null {
    const seed = createDragDetailSeed(param, this.options)
    if (!seed) return null

    // 旋转平面的法线就是旋转轴，createDragDetailSeed 已按此规则建面。
    const axisWorld = Cartesian3.clone(seed.planeNormalWorld, new Cartesian3())
    const axisLocal = Cartesian3.clone(seed.planeNormalLocal, new Cartesian3())

    // 半径守卫：起始交点离轴心太近则拖拽不稳定。
      // 浮点数 除数太小，微小误差被极度放大
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
      handle: param.handle,
      startCenterPointWorld: seed.startCenterPointWorld,
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
      viewAligned: param.handle.constraint.kind === 'view',
    }
  }

  protected createInitialDetail(): RotateDetail {
    return { previousRawAngle: 0, completedTurns: 0 }
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
  private computeTransform(
    input: PointerInput,
    context: RotateSessionContext,
    detail: RotateDetail,
  ): RotateTransformResult | null {
    const current = intersectPlane(
      input.rayWorld,
      context.planeOriginWorld,
      context.planeNormalWorld,
      scratchCurrent,
    )
    if (!current) return null

    Cartesian3.subtract(context.startPointWorld, context.planeOriginWorld, scratchStart)
    Cartesian3.subtract(current, context.planeOriginWorld, scratchQ)

    //屏幕交点小于
    if (Cartesian3.magnitude(scratchQ) < this.options.minRotateRadius * context.radiusWorld) {
      return null
    }

    const axis = context.axisWorld
    const sinTheta = Cartesian3.dot(
      Cartesian3.cross(scratchStart, scratchQ, scratchCross),
      axis,
    )
    const cosTheta = Cartesian3.dot(scratchStart, scratchQ)
    const rawAngle = Math.atan2(sinTheta, cosTheta)
    if (!Number.isFinite(rawAngle)) return null

    // 计算成功后才推进跨帧结果。
    const d = rawAngle - detail.previousRawAngle
    let completedTurns = detail.completedTurns
    if (d > Math.PI) completedTurns--
    else if (d < -Math.PI) completedTurns++

    const accumulatedAngle = rawAngle + 2 * Math.PI * completedTurns

    const deltaRotation = Quaternion.fromAxisAngle(axis, accumulatedAngle, new Quaternion())
    const resultingRotation = Quaternion.multiply(
      deltaRotation,
      context.startControl.rotation,
      new Quaternion(),
    )

    return {
      // 显示单圈角：扇形因此恒定有界，多圈由 accumulatedAngle 表达。
      displayAngle: rawAngle,
      control: {
        translation: context.startControl.translation,
        rotation: resultingRotation,
        scale: context.startControl.scale,
      },
      pointerWorld: Cartesian3.clone(current, new Cartesian3()),
      nextDetail: { previousRawAngle: rawAngle, completedTurns },
    }
  }

  protected computeFrame(
    input: PointerInput,
    context: RotateSessionContext,
    detail: RotateDetail,
    frame: ControllerFrameContext,
  ): DragFrameOutcome<RotateDetail> | null {
    const result = this.computeTransform(input, context, detail)
    if (!result) return null
    return {
      result: {
        effectiveControl: result.control,
        overlay: this.buildOverlay(result, context, frame),
      },
      detail: result.nextDetail,
    }
  }

  private buildOverlay(
    result: RotateTransformResult,
    context: RotateSessionContext,
    frame: ControllerFrameContext,
  ): RotateOverlayState {
    const center = context.planeOriginWorld
    const scale = gizmoScale(frame)
    const radius = (context.viewAligned ? VIEW_AXIS_RADIUS : RING_RADIUS) * scale
    const axis = context.axisWorld
    const start = Cartesian3.multiplyByScalar(
      context.startDirectionWorld,
      radius,
      new Cartesian3(),
    )

    return {
      color: context.handle.color.toCssColorString(),
      displayAngle: result.displayAngle,
      ringWorld: buildRing(center, start, axis),
      sectorWorld: buildSector(center, start, axis, result.displayAngle),
      axisGuideWorld: !context.viewAligned
        ? segmentThrough(center, axis, LONG_AXIS_EXTENT * scale)
        : null,
      normalGuideWorld: !context.viewAligned
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
