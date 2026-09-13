import { Cartesian3, Matrix4 } from '@cesium/engine'
import type { ControllerFrameContext } from '../core/frame'
import type { ResolvedOptions } from '../core/options'
import type { PointerInput } from '../core/pointer'
import type { SessionContext, WorldSegment } from '../core/snapshots'
import type {
  BaseTransformFrameState,
  ScaleFrameState,
  ScaleSpatialState,
  ScaleTransformState,
} from '../core/state'
import { intersectPlane } from '../math/ray'
import { snap } from '../math/snap'
import { createBaseDetail, gizmoScale, localDirectionToWorld } from './detailFactory'
import type { ScaleDetail, ScaleRuntime } from './details'
import { InteractionController, type TransformResult } from './interactionController'

/** 各轴分量下标 */
const COMPONENTS = ['x', 'y', 'z'] as const
const AXIS_GUIDE_LENGTH = 6

const scratchCurrent = new Cartesian3()
const scratchStartLocal = new Cartesian3()
const scratchCurrentLocal = new Cartesian3()

export class ScaleController extends InteractionController<
  ScaleDetail,
  ScaleRuntime,
  ScaleTransformState,
  ScaleSpatialState,
  ScaleFrameState
> {
  constructor(private readonly options: ResolvedOptions) {
    super()
  }

  protected createDetail(
    input: PointerInput,
    session: SessionContext,
    frame: ControllerFrameContext,
  ): ScaleDetail | null {
    const seed = createBaseDetail(input, session, frame, this.options)
    if (!seed) return null

    const constraint = session.handle.constraint
    let resolved: ScaleDetail['constraint']

    if (constraint.kind === 'axis') {
      const axisLocal = Cartesian3.clone(constraint.axisLocal, new Cartesian3())
      const axisWorld = localDirectionToWorld(seed, axisLocal)
      if (!axisWorld) return null

      // 解析出的自由轴均为坐标轴，|a_i| 中只有一个接近 1，argmax 精确。
      const ax = Math.abs(axisLocal.x)
      const ay = Math.abs(axisLocal.y)
      const az = Math.abs(axisLocal.z)
      const axisIndex: 0 | 1 | 2 = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2

      startOffsetLocal(seed, seed.startPointWorld, scratchStartLocal)
      resolved = {
        kind: 'axis',
        axisIndex,
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
      startPointWorld: seed.startPointWorld,
      planeOriginWorld: seed.planeOriginWorld,
      planeNormalWorld: seed.planeNormalWorld,
      localToWorldAtStart: seed.localToWorldAtStart,
      worldToLocalAtStart: seed.worldToLocalAtStart,
      startControl: seed.startControl,
      constraint: resolved,
    }
  }

  protected createRuntime(): ScaleRuntime {
    return { revision: 0 }
  }

  /**
   * 缩放比值公式（局部系，起始姿态为纯旋转，s_L/q_L 不含物体 S）：
   *   s_L = R₀ᵀ(p₀ − T₀),  q_L = R₀ᵀ(p − T₀)
   *   axis   : k = (q_L·a) / (s_L·a)  求交面含自由轴 a，分母不退化
   *   uniform: k = |q_L| / |s_L|       求交面即视平面，取径向模长比
   *
   * k 是无量纲比值，不需要 ⊘S₀（分子分母同系，换算会约掉）。
   */
  protected computeTransform(
    input: PointerInput,
    detail: ScaleDetail,
  ): TransformResult<ScaleTransformState> | null {
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
    const resultingScale = Cartesian3.clone(start, new Cartesian3())
    const appliedFactor = new Cartesian3(1, 1, 1)
    const uniform = detail.constraint.kind === 'uniform'

    const applyComponent = (index: 0 | 1 | 2): void => {
      const key = COMPONENTS[index]
      // minScale 之后逐轴 clamp，appliedFactor 因此可能与 snappedRatio 不同。
      const applied = Math.max(this.options.minScale, start[key] * snappedRatio)
      resultingScale[key] = applied
      appliedFactor[key] = Math.abs(start[key]) > 1e-12 ? applied / start[key] : 1
    }

    if (detail.constraint.kind === 'axis') {
      applyComponent(detail.constraint.axisIndex)
    } else {
      applyComponent(0)
      applyComponent(1)
      applyComponent(2)
    }

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

  protected buildWorldSpatialState(
    result: TransformResult<ScaleTransformState>,
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

  protected createFrameState(
    base: BaseTransformFrameState,
    transform: ScaleTransformState,
    spatial: ScaleSpatialState,
  ): ScaleFrameState {
    return { ...base, mode: 'scale', transform, spatial }
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
