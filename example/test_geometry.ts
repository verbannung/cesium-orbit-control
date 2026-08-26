import {
  CesiumWidget,
  Ion,
  IonImageryProvider,
  ImageryLayer,
  EllipsoidTerrainProvider,
  Cartesian3,
  Transforms,
  HeadingPitchRange,
  Matrix4,
  Math as CesiumMath,
} from '@cesium/engine'
import '@cesium/engine/Source/Widget/CesiumWidget.css'
import { GeometryManager } from '../src/geometry/geometryManager'
import type { Mode } from '../src/geometry/geometry'

Ion.defaultAccessToken = import.meta.env.CESIUM_TOKEN

const widget = new CesiumWidget('cesiumContainer', {
  baseLayer: ImageryLayer.fromProviderAsync(IonImageryProvider.fromAssetId(2)),
  scene3DOnly: true,
})

const center = Cartesian3.fromDegrees(112, 32, 10)
const enuMatrix = Transforms.eastNorthUpToFixedFrame(center)

const modes: Mode[] = ['translate', 'rotate', 'scale']
for (const mode of modes) {
  const manager = new GeometryManager(mode)
  manager.buildGeometry(enuMatrix.clone(), widget.scene)
}

widget.camera.lookAt(center, new HeadingPitchRange(0, CesiumMath.toRadians(-35), 40))
widget.camera.lookAtTransform(Matrix4.IDENTITY)

export { widget }
