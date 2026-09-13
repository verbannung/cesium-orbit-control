import { Cartesian3, Color } from '@cesium/engine'
import { BaseGeometry } from './baseGeometry'
import {
  buildRotateRing,
  buildRotateRingMeshes,
  buildViewRing,
  buildViewRingMeshes,
  VIEW_AXIS_RADIUS,
} from './geometryUtil'
import { Handle } from './types'

export class RotateGeometry extends BaseGeometry {
  build(): void {
    const X = Cartesian3.UNIT_X
    const Y = Cartesian3.UNIT_Y
    const Z = Cartesian3.UNIT_Z

    // 旋转手柄的约束轴即旋转轴，也是拖拽平面的法线。
    const x = new Handle(
      'rotate-x',
      'rotate',
      { kind: 'axis', axisLocal: X },
      Color.RED,
      'gizmo',
      buildRotateRingMeshes(Y, Z),
      buildRotateRing(Y, Z, 'rotate-x', Color.RED),
    )
    const y = new Handle(
      'rotate-y',
      'rotate',
      { kind: 'axis', axisLocal: Y },
      Color.LIME,
      'gizmo',
      buildRotateRingMeshes(Z, X),
      buildRotateRing(Z, X, 'rotate-y', Color.LIME),
    )
    const z = new Handle(
      'rotate-z',
      'rotate',
      { kind: 'axis', axisLocal: Z },
      Color.DODGERBLUE,
      'gizmo',
      buildRotateRingMeshes(X, Y),
      buildRotateRing(X, Y, 'rotate-z', Color.DODGERBLUE),
    )
    const view = new Handle(
      'rotate-view',
      'rotate',
      { kind: 'view' },
      Color.WHITE,
      'view',
      buildViewRingMeshes(X, Y, VIEW_AXIS_RADIUS),
      buildViewRing(X, Y, {
        id: 'rotate-view',
        color: Color.WHITE,
        radius: VIEW_AXIS_RADIUS,
        cullHalf: false,
      }),
    )

    this.assets = [x, y, z, view]
    for (const handle of this.assets) {
      for (const p of handle.primitives) this.scene.primitives.add(p)
    }
  }
}
