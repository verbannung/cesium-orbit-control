import { Cartesian3, Matrix4 } from '@cesium/engine'
import type { ControllerFrameContext } from '../core/frame'
import type { ResolvedOptions } from '../core/options'
import type { PointerInput } from '../core/pointer'
import type { ControlSnapshot, SessionContext, WorldSegment } from '../core/snapshots'
import type {
  DragComputeResult,
  ScaleSpatialState,
  ScaleTransformState,
} from '../core/state'
import { intersectPlane } from '../math/ray'
import { snap } from '../math/snap'
import { createDragDetailSeed, gizmoScale, localDirectionToWorld } from './dragMath'
import type { ScaleDetail } from './details'
import { DragSession } from './dragSession'

const AXIS_GUIDE_LENGTH = 6

const scratchCurrent = new Cartesian3()
const scratchStartLocal = new Cartesian3()
const scratchCurrentLocal = new Cartesian3()

interface TransformResult {
  readonly transform: ScaleTransformState
  readonly control: ControlSnapshot
  readonly pointerWorld: Cartesian3
}

export class ScaleController extends DragSession<ScaleDetail> {
  constructor(private readonly options: ResolvedOptions) {
    super()
  }

  protected createDetail(
    input: PointerInput,
    session: SessionContext,
    frame: ControllerFrameContext,
  ): ScaleDetail | null {
    const seed = createDragDetailSeed(input, session, frame, this.options)
    if (!seed) return null

    const constraint = session.handle.constraint
    let resolved: ScaleDetail['constraint']

    if (constraint.kind === 'axis') {
      const axisLocal = Cartesian3.clone(constraint.axisLocal, new Cartesian3())
      const axisWorld = localDirectionToWorld(seed, axisLocal)
      if (!axisWorld) return null

      // 解析出的轴均为单位坐标轴，恰好一个分量的绝对值接近 1。
      const isXAxis = Math.abs(axisLocal.x) > 0.5
      const isYAxis = Math.abs(axisLocal.y) > 0.5
      const isZAxis = Math.abs(axisLocal.z) > 0.5

      startOffsetLocal(seed, seed.startPointWorld, scratchStartLocal)
      resolved = {
        kind: 'axis',
        isXAxis,
        isYAxis,
        isZAxis,
        axisLocal,
        axisWorld,
        startComponent: Cartesian3.dot(scratchStartLocal, axisLocal),
      }
    } else {
      startOffsetLocal(seed, seed.startPointWorld, scratchStartLocal)
      resolved = {
        kind: 'uniform',
        startRadiusWorld: Cartesian3.magnitude(scratchStartLocal),
      }
    }

    return {
      mode: 'scale',
      startCenterPointWorld: seed.startCenterPointWorld,
      startPointWorld: seed.startPointWorld,
      planeOriginWorld: seed.planeOriginWorld,
      planeNormalWorld: seed.planeNormalWorld,
      localToWorldAtStart: seed.localToWorldAtStart,
      worldToLocalAtStart: seed.worldToLocalAtStart,
      startControl: seed.startControl,
      constraint: resolved,
    }
  }

  /**
   * 缩放比值公式（局部系，起始姿态为纯旋转，s_L/q_L 不含物体 S）：
   *   s_L = R₀ᵀ(p₀ − T₀),  q_L = R₀ᵀ(p − T₀)
   *   axis   : k = (q_L·a) / (s_L·a)  求交面含自由轴 a，分母不退化
   *   uniform: k = |q_L| / |s_L|       求交面即视平面，取径向模长比
   *
   * k 是无量纲比值，不需要 ⊘S₀（分子分母同系，换算会约掉）。
   */
  private computeTransform(
    input: PointerInput,
    detail: ScaleDetail,
  ): TransformResult | null {
    const current = intersectPlane(
      input.rayWorld,
      detail.planeOriginWorld,
      detail.planeNormalWorld,
      scratchCurrent,
    )
    if (!current) return null

    startOffsetLocal(detail, current, scratchCurrentLocal)

    let denominator: number
    let numerator: number
    if (detail.constraint.kind === 'axis') {
      denominator = detail.constraint.startComponent
      numerator = Cartesian3.dot(scratchCurrentLocal, detail.constraint.axisLocal)
    } else {
      denominator = detail.constraint.startRadiusWorld
      numerator = Cartesian3.magnitude(scratchCurrentLocal)
    }

    if (Math.abs(denominator) < this.options.minScaleDenominator) return null

    const rawRatio = numerator / denominator
    if (!Number.isFinite(rawRatio)) return null
    const snappedRatio = snap(rawRatio, this.options.scaleSnap)

    const start = detail.startControl.scale
    const uniform = detail.constraint.kind === 'uniform'
    const axisConstraint = detail.constraint.kind === 'axis' ? detail.constraint : null
    // 吸附后的比例先统一作用于三个分量，再逐轴执行 minScale。
    const resultingScale = Cartesian3.multiplyByScalar(start, snappedRatio, new Cartesian3())
    resultingScale.x = Math.max(this.options.minScale, resultingScale.x)
    resultingScale.y = Math.max(this.options.minScale, resultingScale.y)
    resultingScale.z = Math.max(this.options.minScale, resultingScale.z)

    if (axisConstraint) {
      if (!axisConstraint.isXAxis) resultingScale.x = start.x
      if (!axisConstraint.isYAxis) resultingScale.y = start.y
      if (!axisConstraint.isZAxis) resultingScale.z = start.z
    }

    const appliedFactor = new Cartesian3(
      Math.abs(start.x) > 1e-12 ? resultingScale.x / start.x : 1,
      Math.abs(start.y) > 1e-12 ? resultingScale.y / start.y : 1,
      Math.abs(start.z) > 1e-12 ? resultingScale.z / start.z : 1,
    )

    return {
      transform: {
        rawRatio,
        snappedRatio,
        appliedFactor,
        resultingScale,
        uniform,
      },
      control: {
        translation: detail.startControl.translation,
        rotation: detail.startControl.rotation,
        scale: resultingScale,
      },
      pointerWorld: Cartesian3.clone(current, new Cartesian3()),
    }
  }

  protected computeFrame(
    input: PointerInput,
    detail: ScaleDetail,
    session: SessionContext,
    frame: ControllerFrameContext,
  ): DragComputeResult | null {
    const result = this.computeTransform(input, detail)
    if (!result) return null
    const spatial = this.buildWorldSpatialState(result, detail, frame)
    return {
      effectiveControl: result.control,
      overlay: { handle: session.handle, mode: 'scale', transform: result.transform, spatial },
    }
  }

  private buildWorldSpatialState(
    result: TransformResult,
    detail: ScaleDetail,
    frame: ControllerFrameContext,
  ): ScaleSpatialState {
    const isAxis = detail.constraint.kind === 'axis'
    const scale = gizmoScale(frame)

    return {
      startPointWorld: Cartesian3.clone(detail.startPointWorld, new Cartesian3()),
      currentPointWorld: Cartesian3.clone(result.pointerWorld, new Cartesian3()),
      axisGuideWorld:
        detail.constraint.kind === 'axis'
          ? segmentThrough(
              detail.planeOriginWorld,
              detail.constraint.axisWorld,
              AXIS_GUIDE_LENGTH * scale,
            )
          : null,
      movementArrowWorld: isAxis
        ? null
        : {
            start: Cartesian3.clone(detail.startPointWorld, new Cartesian3()),
            end: Cartesian3.clone(result.pointerWorld, new Cartesian3()),
          },
      labelAnchorWorld: Cartesian3.clone(result.pointerWorld, new Cartesian3()),
    }
  }

}

/** (点 − T₀) 转到起始局部系。起始姿态为纯旋转，故结果不含物体 S。 */
function startOffsetLocal(
  detail: { planeOriginWorld: Cartesian3; worldToLocalAtStart: Matrix4 },
  pointWorld: Cartesian3,
  result: Cartesian3,
): Cartesian3 {
  Cartesian3.subtract(pointWorld, detail.planeOriginWorld, result)
  return Matrix4.multiplyByPointAsVector(detail.worldToLocalAtStart, result, result)
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
