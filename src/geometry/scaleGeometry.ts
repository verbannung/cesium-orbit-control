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

    // Handle(id, basisLocal, color, meshes, primitives)
    const x = new Handle(
      'scale-x',
      [Y, Z],
      Color.RED,
      buildBoxAxisMeshes(Y, Z),
      buildBoxAxis(Y, Z, Color.RED),
        'axis'
    )
    const y = new Handle(
      'scale-y',
      [Z, X],
      Color.LIME,
      buildBoxAxisMeshes(Z, X),
      buildBoxAxis(Z, X, Color.LIME),
                'axis'
    )
    const z = new Handle(
      'scale-z',
      [X,Y],
      Color.DODGERBLUE,
      buildBoxAxisMeshes(X, Y),
      buildBoxAxis(X, Y, Color.DODGERBLUE),
                'axis'

    )
    const uniform = new Handle(
      'scale-uniform',
      [Z],
      Color.WHITE,
      buildViewRingMeshes(X, Y, VIEW_AXIS_RADIUS),
      buildViewRing(X, Y, {
        id: 'scale-uniform',
        color: Color.WHITE,
        radius: VIEW_AXIS_RADIUS,
        cullHalf: false,
      }),
                'uniform'
    )

    this.assets = [x, y, z, uniform]
    for (const handle of this.assets) {
      for (const p of handle.primitives) this.scene.primitives.add(p)
    }
  }
}
