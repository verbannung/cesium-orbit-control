import { Cartesian3, Color } from '@cesium/engine'
import { BaseGeometry } from './baseGeometry'
import {
  buildHeadAxis,
  buildHeadAxisMeshes,
  buildViewRing,
  buildViewRingMeshes,
} from './geometryUtil'
import { Handle } from './types'

export class TranslateGeometry extends BaseGeometry {
  build(): void {
    const X = Cartesian3.UNIT_X
    const Y = Cartesian3.UNIT_Y
    const Z = Cartesian3.UNIT_Z

    // Handle(id, basisLocal, color, meshes, primitives)
    const x = new Handle(
      'translate-x',
      [Y, Z],
      Color.RED,
      buildHeadAxisMeshes(Y, Z),
      buildHeadAxis(Y, Z, Color.RED),
        'axis'
    )
    const y = new Handle(
      'translate-y',
      [Z, X],
      Color.LIME,
      buildHeadAxisMeshes(Z, X),
      buildHeadAxis(Z, X, Color.LIME),
        'axis'
    )
    const z = new Handle(
      'translate-z',
      [X, Y],
      Color.DODGERBLUE,
      buildHeadAxisMeshes(X, Y),
      buildHeadAxis(X, Y, Color.DODGERBLUE),
        'axis'
    )
    const view = new Handle(
      'translate-view',
      [X, Y],
      Color.WHITE,
      buildViewRingMeshes(X, Y),
      buildViewRing(X, Y, { id: 'translate-view', color: Color.WHITE }),
        'view'
    )

    this.assets = [x, y, z, view]
    for (const handle of this.assets) {
      for (const p of handle.primitives) this.scene.primitives.add(p)
    }
  }
}
