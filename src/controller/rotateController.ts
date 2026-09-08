import { Cartesian3, Quaternion, type Ray } from '@cesium/engine'
import { intersectPlane } from '../math/ray'
import { BaseController } from './baseController'
import type { FrameContext } from '../frame/gizmoFrame'
import type { Handle } from '../geometry/types'
import type { ResolvedOptions } from '../core/options'

const scratchCurrent = new Cartesian3()
const scratchS = new Cartesian3()
const scratchQ = new Cartesian3()
const scratchCross = new Cartesian3()
const scratchDelta = new Quaternion()

export class RotateController extends BaseController {
  /** 旋转轴，世界系（= planeNormal，按 begin 时冻住） */
  private readonly axisWorld = new Cartesian3()

  /** unwrap 状态：上一帧的原始角（atan2 输出，∈ (−π, π]） */
  private prevRaw = 0
  /** 跨帧累计完整圈数 */
  private turns = 0

  constructor(options: ResolvedOptions) {
    super(options)
  }

  override begin(handle: Handle, pickRay: Ray, frame: FrameContext): boolean {
    if (!super.begin(handle, pickRay, frame)) return false

    // planeNormal 已在 super.begin 中转换为世界系单位向量
    Cartesian3.clone(this.planeNormal, this.axisWorld)
    this.prevRaw = 0
    this.turns = 0

    // 半径守卫（相对形式）：起始交点离轴心太近则拖拽不稳定
    // |s| 即环所在位置的半径（世界单位），minRotateRadius 是无量纲比值
    Cartesian3.subtract(this.startPoint, this.startTranslation, scratchS)
    if (Cartesian3.magnitude(scratchS) < this.options.minRotateRadius) return false

    return true
  }

  /**
   * 旋转公式（世界系，减中心项后在旋转平面内）：
   *   s = p₀ − T₀,  q = p − T₀         均 ⊥ axisWorld
   *   θ_raw = atan2((s × q)·axisWorld, s·q) ∈ (−π, π]
   *   跨帧 unwrap：d = θ_raw − prevRaw
   *     d > π  → turns--（跨过 −π/π 边界向负方向转）
   *     d < −π → turns++（跨过 −π/π 边界向正方向转）
   *   θ = θ_raw + 2π·turns（总旋转角，支持多圈）
   *   frame.rotation = fromAxisAngle(axisWorld, θ) ⊗ startRotation（世界轴左乘）
   */
  override compute(pickRay: Ray): void {
    const current = intersectPlane(pickRay, this.planeOrigin, this.planeNormal, scratchCurrent)
    if (!current) return

    const axis = this.axisWorld
    if (Cartesian3.magnitudeSquared(axis) < 1e-18) return

    // 相对中心的偏移向量（⊥ axisWorld）
    Cartesian3.subtract(this.startPoint, this.startTranslation, scratchS)
    Cartesian3.subtract(current, this.startTranslation, scratchQ)

    // 半径守卫：当前交点过近则跳过本帧
    if (Cartesian3.magnitude(scratchQ) < this.options.minRotateRadius * Cartesian3.magnitude(scratchS)) return

    const sinTheta = Cartesian3.dot(Cartesian3.cross(scratchS, scratchQ, scratchCross), axis)
    const cosTheta = Cartesian3.dot(scratchS, scratchQ)
    const rawTheta = Math.atan2(sinTheta, cosTheta) // ∈ (−π, π]

    // 跨帧 unwrap：检测 ±π 边界跳变
    const d = rawTheta - this.prevRaw
    if (d > Math.PI) this.turns--
    else if (d < -Math.PI) this.turns++
    this.prevRaw = rawTheta

    const theta = rawTheta + 2 * Math.PI * this.turns

    // 世界轴左乘：R_total = R_delta · R_start
    Quaternion.fromAxisAngle(axis, theta, scratchDelta)
    Quaternion.multiply(scratchDelta, this.startRotation, this.frame.rotation)
  }

  end(): void {
    this.prevRaw = 0
    this.turns = 0
  }
}
