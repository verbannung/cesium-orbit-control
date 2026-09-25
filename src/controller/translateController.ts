import { Cartesian3, Matrix4 } from '@cesium/engine'
import type { ControllerFrameContext } from '../render/types'
import type { ResolvedOptions } from '../types'
import type { PointerInput } from '../input/types'
import type {
  ControllerInputParam,
  DragFrameOutcome,
  EmptyDragDetail,
  TranslateSessionContext,
  TranslateTransformResult,
} from './types'
import type { WorldPolygon, WorldPolyline, WorldSegment } from '../types'
import type { TranslateGuideWorld, TranslateOverlayState } from '../overlay/types'
import { AXES } from '../constants'
import { intersectPlane } from '../util/ray'
import { snap } from '../util/snap'
import {
  createDragDetailSeed,
  gizmoScale,
  localDirectionToWorld,
  normalizeOrNull,
} from './controllerUtil'
import { DragSession } from './dragSession'

const AXIS_GUIDE_LENGTH = 1.5
const PLANE_GUIDE_SIZE = 0.55
const VIEW_GUIDE_RADIUS = 0.6
const VIEW_GUIDE_SEGMENTS = 32

const scratchCurrent = new Cartesian3()
const scratchDeltaW = new Cartesian3()
const scratchDeltaL = new Cartesian3()
const scratchComp = new Cartesian3()
const scratchApplied = new Cartesian3()

export class TranslateController extends DragSession<TranslateSessionContext, EmptyDragDetail> {
  constructor(private readonly options: ResolvedOptions) {
    super()
  }

  protected createSessionContext(param: ControllerInputParam): TranslateSessionContext | null {
    const seed = createDragDetailSeed(param, this.options)
    if (!seed) return null

    const constraint = param.handle.constraint
    let resolved: TranslateSessionContext['constraint']

    if (constraint.kind === 'axis') {
      const axisLocal = Cartesian3.clone(constraint.axisLocal, new Cartesian3())
      const axisWorld = localDirectionToWorld(seed, axisLocal)
      if (!axisWorld) return null
      resolved = { kind: 'axis', axisLocal, axisWorld }
    } else if (constraint.kind === 'plane') {
      const normalLocal = Cartesian3.clone(constraint.normalLocal, new Cartesian3())
      const normalWorld = localDirectionToWorld(seed, normalLocal)
      if (!normalWorld) return null
      resolved = { kind: 'plane', normalLocal, normalWorld }
    } else {
      resolved = {
        kind: 'view',
        planeNormalWorld: Cartesian3.clone(seed.planeNormalWorld, new Cartesian3()),
      }
    }

    return {
      mode: 'translate',
      handle: param.handle,
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

  protected createInitialDetail(): EmptyDragDetail {
    return {}
  }

  /**
   * 位移链路（局部系）：
   *   Δ_W = p − p₀
   *   Δ_L = R₀ᵀ Δ_W                    进入局部（纯旋转，不含 S）
   *   axis : Δ_L ← (Δ_L·a)a            保留自由轴分量
   *   plane: Δ_L ← Δ_L − (Δ_L·c)c      去掉约束基分量
   *   ℓ = Δ_L ⊘ S₀                     世界长度 → 物体局部单位
   *   ℓ_i ← snap(ℓ_i, translateSnap)   以物体局部单位对齐
   *   Δ_L′ = ℓ ⊙ S₀
   *   T = T₀ + R₀ Δ_L′
   *
   * 无 snap 时 S₀⁻¹·S₀ ≡ I，Δ_L′ = Δ_L，链路等价于直接世界位移。
   */
  private computeTransform(
    input: PointerInput,
    context: TranslateSessionContext,
  ): TranslateTransformResult | null {
    const current = intersectPlane(
      input.rayWorld,
      context.planeOriginWorld,
      context.planeNormalWorld,
      scratchCurrent,
    )
    if (!current) return null

    // Δ_W = p − p₀，Δ_L = R₀ᵀ Δ_W
    Cartesian3.subtract(current, context.startPointWorld, scratchDeltaW)
    Matrix4.multiplyByPointAsVector(context.worldToLocalAtStart, scratchDeltaW, scratchDeltaL)

    // 约束投影（局部系，R₀ 正交保证投影有效）
    if (context.constraint.kind === 'axis') {
      const a = context.constraint.axisLocal
      Cartesian3.multiplyByScalar(a, Cartesian3.dot(scratchDeltaL, a), scratchComp)
      Cartesian3.clone(scratchComp, scratchDeltaL)
    } else if (context.constraint.kind === 'plane') {
      const c = context.constraint.normalLocal
      Cartesian3.multiplyByScalar(c, Cartesian3.dot(scratchDeltaL, c), scratchComp)
      Cartesian3.subtract(scratchDeltaL, scratchComp, scratchDeltaL)
    }

    // ℓ = Δ_L ⊘ S₀，snap 后回到世界长度
    const s = context.startControl.scale
    scratchApplied.x = snap(scratchDeltaL.x / s.x, this.options.translateSnap) * s.x
    scratchApplied.y = snap(scratchDeltaL.y / s.y, this.options.translateSnap) * s.y
    scratchApplied.z = snap(scratchDeltaL.z / s.z, this.options.translateSnap) * s.z

    const appliedDeltaWorld = Matrix4.multiplyByPointAsVector(
      context.localToWorldAtStart,
      scratchApplied,
      new Cartesian3(),
    )
    const resultingTranslation = Cartesian3.add(
      context.startControl.translation,
      appliedDeltaWorld,
      new Cartesian3(),
    )

    return {
      control: {
        translation: resultingTranslation,
        rotation: context.startControl.rotation,
        scale: context.startControl.scale,
      },
      pointerWorld: Cartesian3.clone(current, new Cartesian3()),
    }
  }

  protected computeFrame(
    input: PointerInput,
    context: TranslateSessionContext,
    detail: EmptyDragDetail,
    frame: ControllerFrameContext,
  ): DragFrameOutcome<EmptyDragDetail> | null {
    const result = this.computeTransform(input, context)
    if (!result) return null
    return {
      result: {
        effectiveControl: result.control,
        overlay: this.buildOverlay(result, context, frame),
      },
      detail,
    }
  }

  private buildOverlay(
    result: TranslateTransformResult,
    context: TranslateSessionContext,
    frame: ControllerFrameContext,
  ): TranslateOverlayState {
    const center = result.control.translation
    const scale = gizmoScale(frame)

    return {
      color: context.handle.color.toCssColorString(),
      displayTranslation: Cartesian3.clone(center, new Cartesian3()),
      guide: this.buildGuide(context, center, scale, result.pointerWorld),
      labelAnchorWorld: Cartesian3.clone(center, new Cartesian3()),
    }
  }

  private buildGuide(
    context: TranslateSessionContext,
    center: Cartesian3,
    scale: number,
    currentWorld: Cartesian3,
  ): TranslateGuideWorld {
    if (context.constraint.kind === 'axis') {
      return {
        kind: 'axis',
        line: segmentThrough(
          context.startCenterPointWorld,
          context.constraint.axisWorld,
          AXIS_GUIDE_LENGTH * scale,
        ),
      }
    }

    if (context.constraint.kind === 'plane') {
      return {
        kind: 'plane',
        polygon: planeQuad(center, context.constraint.normalWorld, PLANE_GUIDE_SIZE * scale),
      }
    }

    return {
      kind: 'view',
      ring: ringAround(center, context.constraint.planeNormalWorld, VIEW_GUIDE_RADIUS * scale),
      movementArrow: {
        start: Cartesian3.clone(context.startPointWorld, new Cartesian3()),
        end: Cartesian3.clone(currentWorld, new Cartesian3()),
      },
    }
  }

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

/** 世界系下与 normal 正交的一对单位基。 */
export function planeBasis(normal: Cartesian3): readonly [Cartesian3, Cartesian3] {
  let seed = AXES[0]
  let best = Math.abs(Cartesian3.dot(normal, AXES[0]))
  for (let i = 1; i < 3; i++) {
    const projection = Math.abs(Cartesian3.dot(normal, AXES[i]))
    if (projection < best) {
      best = projection
      seed = AXES[i]
    }
  }
  const u = Cartesian3.cross(seed, normal, new Cartesian3())
  normalizeOrNull(u)
  const v = Cartesian3.cross(normal, u, new Cartesian3())
  normalizeOrNull(v)
  return [u, v]
}

function planeQuad(center: Cartesian3, normal: Cartesian3, size: number): WorldPolygon {
  const [u, v] = planeBasis(normal)
  const corner = (uScale: number, vScale: number): Cartesian3 => {
    const point = Cartesian3.multiplyByScalar(u, uScale * size, new Cartesian3())
    Cartesian3.add(
      point,
      Cartesian3.multiplyByScalar(v, vScale * size, new Cartesian3()),
      point,
    )
    return Cartesian3.add(center, point, point)
  }
  return {
    points: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)],
  }
}

function ringAround(center: Cartesian3, normal: Cartesian3, radius: number): WorldPolyline {
  const [u, v] = planeBasis(normal)
  const points: Cartesian3[] = []
  for (let i = 0; i < VIEW_GUIDE_SEGMENTS; i++) {
    const angle = (i / VIEW_GUIDE_SEGMENTS) * Math.PI * 2
    const point = Cartesian3.multiplyByScalar(u, Math.cos(angle) * radius, new Cartesian3())
    Cartesian3.add(
      point,
      Cartesian3.multiplyByScalar(v, Math.sin(angle) * radius, new Cartesian3()),
      point,
    )
    points.push(Cartesian3.add(center, point, point))
  }
  return { points, closed: true }
}
