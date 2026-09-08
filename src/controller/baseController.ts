import { Cartesian3, Matrix3, Quaternion, type Ray } from '@cesium/engine'
import type { FrameContext } from '../frame/gizmoFrame'
import type { Handle } from '../geometry/types'
import { intersectPlane } from '../math/ray'
import type { ResolvedOptions } from '../core/options'

const scratchAxis = new Cartesian3()
const scratchProj = new Cartesian3()

export abstract class BaseController {
  protected readonly planeNormal = new Cartesian3()
  protected readonly planeOrigin = new Cartesian3()
  protected readonly startPoint = new Cartesian3()

  protected readonly startRotation = new Quaternion()
  protected readonly R_LocalToWorld = new Matrix3()
  protected readonly R_WorldToLocal = new Matrix3()
  protected readonly startTranslation = new Cartesian3()
  protected readonly startScale = new Cartesian3()
  protected readonly toCameraLocal = new Cartesian3()

  protected frame!: FrameContext

  constructor(protected readonly options: ResolvedOptions) {}

  /**
   * 冻结 TRS 与视线，建交面。
   * 法线退化（|dot(n_L, v)| < degenerateThreshold）或无射线交点则返回 false。
   * 前置条件：调用方在 begin/end 期间须保持 frame.tripodFrozen。
   */
  begin(handle: Handle, pickRay: Ray, frame: FrameContext): boolean {
    this.frame = frame

    Quaternion.clone(frame.rotation, this.startRotation)
    Matrix3.fromQuaternion(this.startRotation, this.R_LocalToWorld)
    Matrix3.transpose(this.R_LocalToWorld, this.R_WorldToLocal)
    Cartesian3.clone(frame.translation, this.startTranslation)
    Cartesian3.clone(frame.scale, this.startScale)
    Cartesian3.clone(frame.toCameraLocal, this.toCameraLocal)

    const nLocal = this.buildHandlePlane(handle, this.toCameraLocal)
    if (!nLocal) return false

    // 退化检查：局部系下法线与视线夹角过小说明面侧视/轴对准，交点不稳定
    if (Math.abs(Cartesian3.dot(nLocal, this.toCameraLocal)) < this.options.degenerateThreshold) {
      return false
    }

    Matrix3.multiplyByVector(this.R_LocalToWorld, nLocal, this.planeNormal)
    Cartesian3.normalize(this.planeNormal, this.planeNormal)

    Cartesian3.clone(this.startTranslation, this.planeOrigin)
    const hit = intersectPlane(pickRay, this.planeOrigin, this.planeNormal)
    if (!hit) return false
    Cartesian3.clone(hit, this.startPoint)
    return true
  }

  /**
   * 局部系求交面法线。面必须包含整个自由子空间（basisLocal 的正交补）。
   *
   * basisLocal 是**约束基**（零自由度方向），自由子空间 = span(basisLocal)^⊥：
   *   axis（余维 2，自由轴 a = u × v）：n_L = normalize(v − (v·a)a)
   *     含 a 的平面有一族，取最正对相机的那张，保证拖拽时分量不退化
   *   plane（余维 1，约束基 c = basisLocal[0]）：n_L = c
   *     含自由面的平面唯一，直接就是约束基本身
   *   view/uniform（余维 0）：n_L = v（退化到视平面）
   *     view：约束基由相机每帧给出，等价于"动态 plane 型"
   *     uniform：真正零约束，三轴全自由
   */
  protected buildHandlePlane(
    handle: Handle,
    toCameraLocal: Cartesian3,
    result = new Cartesian3(),
  ): Cartesian3 | null {
    const handleType = handle.handleType
    if (handleType === 'axis') {
      // 自由轴 a = u × v，basisLocal = [u, v] 是约束基（张成正交面）
      const axis = axisOf(handle, scratchAxis)
      if (!axis) return null
      Cartesian3.multiplyByScalar(axis, Cartesian3.dot(toCameraLocal, axis), scratchProj)
      Cartesian3.subtract(toCameraLocal, scratchProj, result)
      return normalize(result)
    } else if (handleType === 'plane') {
      // 约束基 c = basisLocal[0]，面法线即约束基
      return Cartesian3.clone(handle.basisLocal[0], result)
    } else {
      // view：约束基等于当前视线（每帧动态），退化为视平面
      // uniform：零约束，同样取视平面
      return Cartesian3.clone(toCameraLocal, result)
    }
  }

  /** 射线 ∩ 冻住的平面，只写 frame.translation / rotation / scale */
  abstract compute(pickRay: Ray): void

  abstract end(): void
}

/**
 * axis 手柄的自由轴：basisLocal = [u, v] 是约束基（正交于自由轴），
 * u × v 即自由轴方向。
 */
export function axisOf(handle: Handle, result = new Cartesian3()): Cartesian3 | null {
  Cartesian3.cross(handle.basisLocal[0], handle.basisLocal[1], result)
  return normalize(result)
}

function normalize(v: Cartesian3): Cartesian3 | null {
  if (Cartesian3.magnitudeSquared(v) < 1e-18) return null
  return Cartesian3.normalize(v, v)
}
