import { Cartesian3, Matrix3, type Ray } from '@cesium/engine'
import { intersectPlane } from '../math/ray'
import { axisOf, BaseController } from './baseController'
import { snap } from '../math/snap'
import type { FrameContext } from '../frame/gizmoFrame'
import type { Handle, HandleType } from '../geometry/types'
import type { ResolvedOptions } from '../core/options'

/** 各轴分量下标 */
const COMPONENTS = ['x', 'y', 'z'] as const

const scratchCurrent = new Cartesian3()
const scratchSL = new Cartesian3()
const scratchQL = new Cartesian3()

export class ScaleController extends BaseController {
  private handleType: HandleType = 'axis'
  /**
   * 自由轴，局部系单位向量（axis 型）。
   * axis 型的 basisLocal = [u, v] 是约束基，a = u × v 是自由轴。
   */
  private readonly axisLocal = new Cartesian3()
  /**
   * 自由轴对应的 scale 分量下标（0/1/2 → x/y/z），axis 型用。
   * 用 argmax|a_i| 取主轴分量，因为 basisLocal 的轴均为坐标轴，结果精确。
   */
  private axisIndex = 0

  constructor(options: ResolvedOptions) {
    super(options)
  }

  override begin(handle: Handle, pickRay: Ray, frame: FrameContext): boolean {
    if (!super.begin(handle, pickRay, frame)) return false

    this.handleType = handle.handleType

    if (handle.handleType === 'axis') {
      const axis = axisOf(handle)
      if (!axis) return false
      Cartesian3.clone(axis, this.axisLocal)
      // 取主轴分量下标（basisLocal 均为坐标轴，|a_i| 中只有一个接近 1）
      const ax = Math.abs(axis.x), ay = Math.abs(axis.y), az = Math.abs(axis.z)
      this.axisIndex = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2
    }

    return true
  }

  /**
   * 缩放比值公式（局部系，gizmoMatrix 不含物体 S，故 s_L/q_L 是纯旋转偏移）：
   *   s_L = R₀ᵀ(p₀ − T₀),  q_L = R₀ᵀ(p − T₀)
   *   axis   : k = (q_L·a) / (s_L·a)  求交面含自由轴 a，分母不退化
   *   uniform: k = |q_L| / |s_L|       求交面即视平面，取径向模长比
   *
   * k 是无量纲比值，不需要 ⊘S₀（分子分母在同一坐标系，换算会约掉）。
   * k 的语义即"在该轴上放大 k 倍"，直接乘以 S₀ 得新缩放。
   */
  override compute(pickRay: Ray): void {
    const current = intersectPlane(pickRay, this.planeOrigin, this.planeNormal, scratchCurrent)
    if (!current) return

    // 进入局部系（纯旋转，不含 S）
    Matrix3.multiplyByVector(this.R_WorldToLocal, Cartesian3.subtract(this.startPoint, this.startTranslation, scratchSL), scratchSL)
    Matrix3.multiplyByVector(this.R_WorldToLocal, Cartesian3.subtract(current, this.startTranslation, scratchQL), scratchQL)

    let s: number, c: number
    if (this.handleType === 'axis') {
      const a = this.axisLocal
      s = Cartesian3.dot(scratchSL, a)
      c = Cartesian3.dot(scratchQL, a)
    } else {
      // uniform：径向模长比
      s = Cartesian3.magnitude(scratchSL)
      c = Cartesian3.magnitude(scratchQL)
    }

    if (Math.abs(s) < this.options.minScaleDenominator) return

    const k = snap(c / s, this.options.scaleSnap)
    const scale = this.frame.scale
    const s0 = this.startScale

    if (this.handleType === 'axis') {
      const key = COMPONENTS[this.axisIndex]
      scale[key] = Math.max(this.options.minScale, s0[key] * k)
    } else {
      scale.x = Math.max(this.options.minScale, s0.x * k)
      scale.y = Math.max(this.options.minScale, s0.y * k)
      scale.z = Math.max(this.options.minScale, s0.z * k)
    }
  }

  end(): void {}
}
