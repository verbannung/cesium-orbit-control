import { Cartesian3, Quaternion } from '@cesium/engine'
import type { ControlSnapshot } from './snapshots'

/** 发布边界上的深拷贝：Cesium 数学类型可变，跨模块传递必须拷贝。 */
export function cloneControl(control: ControlSnapshot): ControlSnapshot {
  return {
    translation: Cartesian3.clone(control.translation, new Cartesian3()),
    rotation: Quaternion.clone(control.rotation, new Quaternion()),
    scale: Cartesian3.clone(control.scale, new Cartesian3()),
  }
}

export function identityControl(): ControlSnapshot {
  return {
    translation: new Cartesian3(),
    rotation: Quaternion.clone(Quaternion.IDENTITY, new Quaternion()),
    scale: new Cartesian3(1, 1, 1),
  }
}

export function controlEquals(a: ControlSnapshot, b: ControlSnapshot): boolean {
  return (
    Cartesian3.equals(a.translation, b.translation) &&
    Quaternion.equals(a.rotation, b.rotation) &&
    Cartesian3.equals(a.scale, b.scale)
  )
}
