import { Cartesian3, Color } from '@cesium/engine'
import { BaseGeometry } from './baseGeometry'
import {
  buildHeadAxis,
  buildHeadAxisMeshes,
  buildViewRing,
  buildViewRingMeshes,
} from './geometryUtil'
import { Handle } from './handle'

export class TranslateGeometry extends BaseGeometry {
  build(): void {
    const X = Cartesian3.UNIT_X
    const Y = Cartesian3.UNIT_Y
    const Z = Cartesian3.UNIT_Z

    // 约束在此解析一次：轴手柄的自由轴即 u × v（架构不变量 9）。
    const x = new Handle(
      'translate-x',
      'translate',
      { kind: 'axis', axisLocal: X },
      Color.RED,
      'axisFlip',
      buildHeadAxisMeshes(Y, Z),
      buildHeadAxis(Y, Z, Color.RED),
    )
    const y = new Handle(
      'translate-y',
      'translate',
      { kind: 'axis', axisLocal: Y },
      Color.LIME,
      'axisFlip',
      buildHeadAxisMeshes(Z, X),
      buildHeadAxis(Z, X, Color.LIME),
    )
    const z = new Handle(
      'translate-z',
      'translate',
      { kind: 'axis', axisLocal: Z },
      Color.DODGERBLUE,
      'axisFlip',
      buildHeadAxisMeshes(X, Y),
      buildHeadAxis(X, Y, Color.DODGERBLUE),
    )
    const view = new Handle(
      'translate-view',
      'translate',
      { kind: 'view' },
      Color.WHITE,
      'view',
      buildViewRingMeshes(X, Y),
      buildViewRing(X, Y, { id: 'translate-view', color: Color.WHITE }),
    )

    this.assets = [x, y, z, view]
    for (const handle of this.assets) {
      for (const p of handle.primitives) this.scene.primitives.add(p)
    }
  }
}
