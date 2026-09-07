import { Cartesian3, Matrix3, Quaternion, type Ray } from '@cesium/engine'
import { intersectPlane } from '../math/ray'
import { BaseController } from './baseController'
import type { FrameContext } from '../frame/gizmoFrame'
import { Handle } from '../geometry/types'

const scratchCurrent = new Cartesian3()
const scratchPrevL = new Cartesian3()
const scratchCurrL = new Cartesian3()
// const scratchAxis = new Cartesian3()
const scratchCross = new Cartesian3()
const scratchDelta = new Quaternion()
const scratchNextDelta = new Quaternion()

export class RotateController extends BaseController {
  /** 上一帧交点，世界系，每帧推进 */
  private readonly prevPoint = new Cartesian3()
  /** 累积旋转增量，局部系 */
  private readonly deltaRotation = Quaternion.clone(Quaternion.IDENTITY, new Quaternion())
  /** 累积角度标量，供 overlay 显示度数 */
  private angle = 0
  /** 当前拖拽手柄 */
  // private handle!: Handle
  /** 旋转轴，局部系 */
  private readonly axisLocalVec = new Cartesian3()

  override begin(handle: Handle, pickRay: Ray, frame: FrameContext): boolean {
    if (!super.begin(handle, pickRay, frame)) return false

    // this.handle = handle
    Cartesian3.clone(this.startPoint, this.prevPoint)
    Quaternion.clone(Quaternion.IDENTITY, this.deltaRotation)
    this.angle = 0

    const axis = this.planeNormal
    if (!axis) return false
    Cartesian3.clone(axis, this.axisLocalVec)

    return true
  }

  /**
   * 由 prevPoint→current 求增量角，累积到 deltaRotation。
   * 最终姿态 = startRotation ⊗ deltaRotation。
   * 仅在返回非 null 时推进增量状态。
   * 其中获得的是世界坐标系的 current，将 prev/current 相对中心的向量
   * 转化到局部坐标系下，投影到旋转平面后计算旋转增量，刷入 frame.rotation。
   */
  override compute(pickRay: Ray): void {
    const current = intersectPlane(pickRay, this.planeOrigin, this.planeNormal, scratchCurrent)
    if (!current) return
    // if (Cartesian3.distance(current, this.startTranslation) < this.options.minRotateRadius) {
    //   return
    // }

    const axis = this.axisLocalVec
    if (Cartesian3.magnitudeSquared(axis) < 1e-18) return

    this.toOffsetLocal(this.prevPoint, scratchPrevL)
    this.toOffsetLocal(current, scratchCurrL)
    // projectOntoPlane(scratchPrevL, axis)
    // projectOntoPlane(scratchCurrL, axis)

    // if (
    //   Cartesian3.magnitude(scratchPrevL) < this.options.minRotateRadius ||
    //   Cartesian3.magnitude(scratchCurrL) < this.options.minRotateRadius
    // ) {
    //   return
    // }

    const sin = Cartesian3.dot(Cartesian3.cross(scratchPrevL, scratchCurrL, scratchCross), axis)
    const cos = Cartesian3.dot(scratchPrevL, scratchCurrL)
    const dTheta = Math.atan2(sin, cos) //TODO atan存在-PI~PI跳变

      Quaternion.fromAxisAngle(axis, dTheta, scratchDelta)
      Quaternion.multiply(this.deltaRotation, scratchDelta, scratchNextDelta)
      Quaternion.clone(scratchNextDelta, this.deltaRotation)
      Quaternion.multiply(this.startRotation, this.deltaRotation, this.frame.rotation)
      this.angle += dTheta


    Cartesian3.clone(current, this.prevPoint)
  }

  end(): void {
    Quaternion.clone(Quaternion.IDENTITY, this.deltaRotation)
    this.angle = 0
  }





  private toOffsetLocal(world: Cartesian3, result: Cartesian3): Cartesian3 {
    Cartesian3.subtract(world, this.startTranslation, result)
    return Matrix3.multiplyByVector(this.R_WorldToLocal, result, result)
  }
}


