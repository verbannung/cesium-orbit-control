import { Cartesian3, Matrix3, type Matrix4, type Ray } from '@cesium/engine'
import type { Constraint, Handle } from '../core/types'
import type { OverlayState } from '../overlay/types'
import { intersectPlane } from '../math/ray'
import { snap } from '../math/snap'
import { BaseController } from './baseController'
import type { DragInput } from './types'

const scratchDeltaW = new Cartesian3()
const scratchDeltaL = new Cartesian3()
const scratchProj = new Cartesian3()
const scratchAxis = new Cartesian3()
const scratchT = new Cartesian3()
const scratchLabelDelta = new Cartesian3()

export class TranslateController extends BaseController {
  /** 最近一次写出的位置，供 overlay 画起点→终点连线 */
  private readonly currentTranslation = new Cartesian3()

  override begin(dragInput: DragInput, handle: Handle): boolean {
    if (!super.begin(dragInput, handle)) return false
    Cartesian3.clone(this.startTranslation, this.currentTranslation)
    return true
  }

  /**
   * deltaLocal = R_WorldToLocal · (current - startPoint)
   * 按 constraint 投影：axis 保留该轴分量，plane 保留 u/v 两分量，screen 整平面。
   * snap 作用于累积位移而非每帧增量
   */
  protected computeMatrix(pickRay: Ray): Matrix4 | null {
    const current = intersectPlane(pickRay, this.planeOrigin, this.planeNormal)
    if (!current) return null

    Cartesian3.subtract(current, this.startPoint, scratchDeltaW)

    const basis = constrainedBasis(this.constraint)
    if (!basis) {
      Cartesian3.add(this.startTranslation, scratchDeltaW, scratchT)
    } else {
      Matrix3.multiplyByVector(this.R_WorldToLocal, scratchDeltaW, scratchDeltaL)
      Cartesian3.clone(Cartesian3.ZERO, scratchProj)
      for (const b of basis) {
        const c = snap(Cartesian3.dot(scratchDeltaL, b), this.options.translateSnap)
        Cartesian3.multiplyByScalar(b, c, scratchAxis)
        Cartesian3.add(scratchProj, scratchAxis, scratchProj)
      }
      Matrix3.multiplyByVector(this.R_LocalToWorld, scratchProj, scratchDeltaW)
      Cartesian3.add(this.startTranslation, scratchDeltaW, scratchT)
    }

    Cartesian3.clone(scratchT, this.currentTranslation)
    return this.compose(scratchT, this.startRotation, this.startScale)
  }

  overlayState(): OverlayState {
    Cartesian3.subtract(this.currentTranslation, this.startTranslation, scratchLabelDelta)
    Matrix3.multiplyByVector(this.R_WorldToLocal, scratchLabelDelta, scratchLabelDelta)
    return {
      kind: 'translate',
      startWorld: this.startTranslation,
      endWorld: this.currentTranslation,
      label: formatDelta(this.constraint, scratchLabelDelta),
    }
  }

  end(): void {}
}
const AXIS_NAMES = 'XYZ'

/** null 表示不受约束，直接沿视平面自由移动 */
function constrainedBasis(constraint: Constraint): Cartesian3[] | null {
  switch (constraint.kind) {
    case 'axis':
      return [constraint.axis]
    case 'plane':
      return [constraint.u, constraint.v]
    default:
      return null
  }
}

function formatDelta(constraint: Constraint, deltaLocal: Cartesian3): string {
  switch (constraint.kind) {
    case 'axis':
      return part(constraint.axisIndex, deltaLocal)
    case 'plane':
      return `${part((constraint.planeIndex + 1) % 3, deltaLocal)}  ${part((constraint.planeIndex + 2) % 3, deltaLocal)}`
    default:
      return `${part(0, deltaLocal)}  ${part(1, deltaLocal)}  ${part(2, deltaLocal)}`
  }
}

function part(index: number, v: Cartesian3): string {
  const value = index === 0 ? v.x : index === 1 ? v.y : v.z
  return `${AXIS_NAMES[index]}: ${value.toFixed(3)}`
}

