import { Cartesian3, Color } from '@cesium/engine'
import { BaseGeometry } from './baseGeometry'
import {
  buildBoxAxis,
  buildBoxAxisMeshes,
  buildViewRing,
  buildViewRingMeshes,
  VIEW_AXIS_RADIUS,
} from './geometryUtil'
import { Handle } from './types'

export class ScaleGeometry extends BaseGeometry {
  build(): void {
    const X = Cartesian3.UNIT_X
    const Y = Cartesian3.UNIT_Y
    const Z = Cartesian3.UNIT_Z

    const x = new Handle(
      'scale-x',
      'scale',
      { kind: 'axis', axisLocal: X },
      Color.RED,
      'axisFlip',
      buildBoxAxisMeshes(Y, Z),
      buildBoxAxis(Y, Z, Color.RED),
    )
    const y = new Handle(
      'scale-y',
      'scale',
      { kind: 'axis', axisLocal: Y },
      Color.LIME,
      'axisFlip',
      buildBoxAxisMeshes(Z, X),
      buildBoxAxis(Z, X, Color.LIME),
    )
    const z = new Handle(
      'scale-z',
      'scale',
      { kind: 'axis', axisLocal: Z },
      Color.DODGERBLUE,
      'axisFlip',
      buildBoxAxisMeshes(X, Y),
      buildBoxAxis(X, Y, Color.DODGERBLUE),
    )
    const uniform = new Handle(
      'scale-uniform',
      'scale',
      { kind: 'uniform' },
      Color.WHITE,
      'view',
      buildViewRingMeshes(X, Y, VIEW_AXIS_RADIUS),
      buildViewRing(X, Y, {
        id: 'scale-uniform',
        color: Color.WHITE,
        radius: VIEW_AXIS_RADIUS,
        cullHalf: false,
      }),
    )

    this.assets = [x, y, z, uniform]
    for (const handle of this.assets) {
      for (const p of handle.primitives) this.scene.primitives.add(p)
    }
  }
}
