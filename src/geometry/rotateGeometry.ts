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

      //旋转只有一个约束轴
    const x = new Handle(
      'rotate-x',
      [X],
      Color.RED,
      buildRotateRingMeshes(Y, Z),
      buildRotateRing(Y, Z, 'rotate-x'),
        'plane'
    )
    const y = new Handle(
      'rotate-y',
      [Y],
      Color.LIME,
      buildRotateRingMeshes(Z, X),
      buildRotateRing(Z, X, 'rotate-y'),
        'plane'
    )
    const z = new Handle(
      'rotate-z',
      [Z],
      Color.DODGERBLUE,
      buildRotateRingMeshes(X, Y),
      buildRotateRing(X, Y, 'rotate-z'),
        'plane'
    )
    const view = new Handle(
      'rotate-view',
      [Z],
      Color.WHITE,
      buildViewRingMeshes(X, Y, VIEW_AXIS_RADIUS),
      buildViewRing(X, Y, { id: 'rotate-view', radius: VIEW_AXIS_RADIUS, cullHalf: false }),
        'view'
    )

    this.assets = [x, y, z, view]
    for (const handle of this.assets) {
      for (const p of handle.primitives) this.scene.primitives.add(p)
    }
  }
}
