import { Cartesian3, Matrix3, Quaternion, type Ray } from '@cesium/engine'
import type { FrameContext } from '../frame/gizmoFrame'
import type { Handle, HandleId } from '../geometry/types'
import { intersectPlane } from '../math/ray'


export abstract class BaseController {
  // protected handleType!: HandleType


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

  /**
   * 抽出 id → type 与 basis，冻 TRS 与求交面。
   * 法线退化或无交点则本次拖拽不成立。
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

    Matrix3.multiplyByVector(this.R_LocalToWorld, nLocal, this.planeNormal)
    if (Cartesian3.magnitudeSquared(this.planeNormal) < 1e-18) return false
    Cartesian3.normalize(this.planeNormal, this.planeNormal)

    Cartesian3.clone(this.startTranslation, this.planeOrigin)
    const hit = intersectPlane(pickRay, this.planeOrigin, this.planeNormal)
    if (!hit) return false
    Cartesian3.clone(hit, this.startPoint)
    return true
  }

  /**
   * 局部系求交面法线。axis / view / uniform 用视线；plane 用 u×v。
   */
  protected buildHandlePlane(
    handle:Handle,
    toCameraLocal: Cartesian3,
    result = new Cartesian3(),
  ): Cartesian3 | null {
      const handleType= handle.handleType
      if(handleType==='axis'){
          return Cartesian3.cross(handle.basisLocal[0], handle.basisLocal[1], result)
      }else if(handleType==='plane'){
              return Cartesian3.clone(handle.basisLocal[0], result)
      }else if(handleType==='view'||'uniform'){
          return Cartesian3.clone(toCameraLocal, result)
      }
      return null
  }

  /** 射线 ∩ 冻住的 Plane，只写 frame.translation / rotation / scale */
  abstract compute(pickRay: Ray): void

  abstract end(): void
}

function normalize(v: Cartesian3): Cartesian3 | null {
  if (Cartesian3.magnitudeSquared(v) < 1e-18) return null
  return Cartesian3.normalize(v, v)
}
