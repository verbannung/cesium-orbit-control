import { Cartesian3, Matrix3, type Ray } from '@cesium/engine'
import { intersectPlane } from '../math/ray'
import { axisOf, BaseController } from './baseController'
import { snap } from '../math/snap'
import type { FrameContext } from '../frame/gizmoFrame'
import type { Handle } from '../geometry/types'
import type { ResolvedOptions } from '../core/options'

const scratchCurrent = new Cartesian3()
const scratchDeltaW = new Cartesian3()
const scratchDeltaL = new Cartesian3()
const scratchComp = new Cartesian3()
const scratchResult = new Cartesian3()

export class TranslateController extends BaseController {
  /**
   * 约束方向，局部系。
   * axis 型：自由轴方向 a（单位向量）
   * plane 型：约束基 c = basisLocal[0]（面法线，单位向量）
   */
  private readonly constraintLocal = new Cartesian3()
  private constraintKind: 'axis' | 'plane' | 'free' = 'free'

  constructor(options: ResolvedOptions) {
    super(options)
  }

  override begin(handle: Handle, pickRay: Ray, frame: FrameContext): boolean {
    if (!super.begin(handle, pickRay, frame)) return false

    if (handle.handleType === 'axis') {
      const axis = axisOf(handle)
      if (!axis) return false
      Cartesian3.clone(axis, this.constraintLocal)
      this.constraintKind = 'axis'
    } else if (handle.handleType === 'plane') {
      Cartesian3.clone(handle.basisLocal[0], this.constraintLocal)
      this.constraintKind = 'plane'
    } else {
      this.constraintKind = 'free'
    }

    return true
  }

  /**
   * 位移链路（局部系）：
   *   Δ_W = p − p₀
   *   Δ_L = R₀ᵀ Δ_W                    进入局部（纯旋转，不含 S）
   *   axis : Δ_L ← (Δ_L·a)a            保留自由轴分量
   *   plane: Δ_L ← Δ_L − (Δ_L·c)c     去掉约束基分量
   *   ℓ = Δ_L ⊘ S₀                     世界长度 → 物体局部单位
   *   ℓ_i ← snap(ℓ_i, translateSnap)   以物体局部单位对齐
   *   Δ_L′ = ℓ ⊙ S₀
   *   frame.translation = T₀ + R₀ Δ_L′
   *
   * 注：basisLocal 的各元素均为坐标轴，⊘S₀ 不会破坏约束方向正交性。
   * 无 snap 时 S₀⁻¹·S₀ ≡ I，Δ_L′ = Δ_L，链路等价于直接世界位移。
   * T 是纯世界量，写回 frame.translation 的是世界坐标。
   */
  override compute(pickRay: Ray): void {
    const current = intersectPlane(pickRay, this.planeOrigin, this.planeNormal, scratchCurrent)
    if (!current) return

    // Δ_W = p − p₀
    Cartesian3.subtract(current, this.startPoint, scratchDeltaW)

    // Δ_L = R₀ᵀ Δ_W
    Matrix3.multiplyByVector(this.R_WorldToLocal, scratchDeltaW, scratchDeltaL)

    // 约束投影（局部系，R₀ 正交保证投影有效）
    if (this.constraintKind !== 'free') {
      const c = this.constraintLocal
      const proj = Cartesian3.dot(scratchDeltaL, c)
      Cartesian3.multiplyByScalar(c, proj, scratchComp)
      if (this.constraintKind === 'axis') {
        Cartesian3.clone(scratchComp, scratchDeltaL)
      } else {
        // plane：去掉法线分量，保留面内分量
        Cartesian3.subtract(scratchDeltaL, scratchComp, scratchDeltaL)
      }
    }

    // ℓ = Δ_L ⊘ S₀（世界长度 → 物体局部单位），对约束方向 snap
    const s = this.startScale
    scratchResult.x = snap(scratchDeltaL.x / s.x, this.options.translateSnap)
    scratchResult.y = snap(scratchDeltaL.y / s.y, this.options.translateSnap)
    scratchResult.z = snap(scratchDeltaL.z / s.z, this.options.translateSnap)

    // Δ_L′ = ℓ ⊙ S₀，回到世界长度
    scratchResult.x *= s.x
    scratchResult.y *= s.y
    scratchResult.z *= s.z

    // frame.translation = T₀ + R₀ Δ_L′
    Matrix3.multiplyByVector(this.R_LocalToWorld, scratchResult, scratchDeltaW)
    Cartesian3.add(this.startTranslation, scratchDeltaW, this.frame.translation)
  }

  end(): void {
    this.constraintKind = 'free'
  }
}
