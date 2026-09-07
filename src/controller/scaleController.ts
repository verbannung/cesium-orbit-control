import { Cartesian3, Matrix3, type Matrix4, type Ray } from '@cesium/engine'
import type { Handle } from '../core/types'
import type { OverlayState } from '../overlay/types'
import { intersectPlane } from '../math/ray'
import { snap } from '../math/snap'
import { BaseController } from './baseController'
import type { DragInput } from './types'

const scratchCurrent = new Cartesian3()
const scratchStartL = new Cartesian3()
const scratchCurrL = new Cartesian3()
const scratchScale = new Cartesian3()

export class ScaleController extends BaseController {
  private readonly currentPoint = new Cartesian3()
  private ratio = 1

  override begin(dragInput: DragInput, handle: Handle): boolean {
    if (!super.begin(dragInput, handle)) return false
    Cartesian3.clone(this.startPoint, this.currentPoint)
    this.ratio = 1
    return true
  }

  /**
   * axis：k = currentLocal[axis] / max(|startLocal[axis]|, minScaleDenominator)
   * uniform：k = |current - center| / max(|start - center|, minScaleDenominator)
   * 经 scaleSnap 后乘到 startScale，再对 minScale 取下限。
   */
  protected computeMatrix(pickRay: Ray): Matrix4 | null {
    const current = intersectPlane(pickRay, this.planeOrigin, this.planeNormal, scratchCurrent)
    if (!current) return null
    Cartesian3.clone(current, this.currentPoint)

    const denomFloor = this.options.minScaleDenominator
    Cartesian3.clone(this.startScale, scratchScale)

    if (this.constraint.kind === 'uniform') {
      const s = Cartesian3.distance(this.startPoint, this.startTranslation)
      const c = Cartesian3.distance(current, this.startTranslation)
      const k = snap(c / Math.max(s, denomFloor), this.options.scaleSnap)
      this.ratio = k
      scratchScale.x = Math.max(this.options.minScale, this.startScale.x * k)
      scratchScale.y = Math.max(this.options.minScale, this.startScale.y * k)
      scratchScale.z = Math.max(this.options.minScale, this.startScale.z * k)
      return this.compose(this.startTranslation, this.startRotation, scratchScale)
    }

    if (this.constraint.kind !== 'axis') return null

    toOffsetLocal(this.R_WorldToLocal, this.startTranslation, this.startPoint, scratchStartL)
    toOffsetLocal(this.R_WorldToLocal, this.startTranslation, current, scratchCurrL)

    const axis = this.constraint.axis
    const s = Cartesian3.dot(scratchStartL, axis)
    const c = Cartesian3.dot(scratchCurrL, axis)
    const k = snap(c / Math.max(Math.abs(s), denomFloor), this.options.scaleSnap)
    this.ratio = k

    const key = COMPONENTS[this.constraint.axisIndex]
    scratchScale[key] = Math.max(this.options.minScale, this.startScale[key] * k)

    return this.compose(this.startTranslation, this.startRotation, scratchScale)
  }

  overlayState(): OverlayState {
    const label =
      this.constraint.kind === 'axis'
        ? `${'XYZ'[this.constraint.axisIndex]}: ${this.ratio.toFixed(3)}`
        : `XYZ: ${this.ratio.toFixed(3)}`
    return {
      kind: 'scale',
      center: this.startTranslation,
      endWorld: this.currentPoint,
      label,
    }
  }

  end(): void {
    this.ratio = 1
  }
}

const COMPONENTS = ['x', 'y', 'z'] as const

function toOffsetLocal(
  R_WorldToLocal: Matrix3,
  origin: Cartesian3,
  world: Cartesian3,
  result: Cartesian3,
): Cartesian3 {
  Cartesian3.subtract(world, origin, result)
  return Matrix3.multiplyByVector(R_WorldToLocal, result, result)
}
