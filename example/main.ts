import {
  CesiumWidget,
  Ion,
  IonImageryProvider,
  ImageryLayer,
  EllipsoidTerrainProvider,
  Cartesian3,
  Color,
  Transforms ,
  Primitive,
  GeometryInstance,
  BoxGeometry,
  ColorGeometryInstanceAttribute,
  PerInstanceColorAppearance,
} from '@cesium/engine'
import '@cesium/engine/Source/Widget/CesiumWidget.css'
import { CesiumOrbitControl } from '../src/index'

Ion.defaultAccessToken = import.meta.env.CESIUM_TOKEN

const widget = new CesiumWidget('cesiumContainer', {
  baseLayer: ImageryLayer.fromProviderAsync(IonImageryProvider.fromAssetId(2)),
  terrainProvider: new EllipsoidTerrainProvider(),
  scene3DOnly: true 
})


const center = Cartesian3.fromDegrees(112, 32, 0);

const enuMatrix = Transforms.eastNorthUpToFixedFrame(center)


const half = 0.1;
const box = widget.scene.primitives.add(
  new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: new BoxGeometry({
        maximum: new Cartesian3(half, half, half),
        minimum: new Cartesian3(-half, -half, -half),
      }),
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(Color.YELLOW.withAlpha(0.7)),
      },
    }),
    appearance: new PerInstanceColorAppearance({
      translucent: true,
    }),
    modelMatrix: enuMatrix, 
  })
);

const orbitControl = new CesiumOrbitControl(widget)



orbitControl.attachObject(box.modelMatrix)
widget.camera.flyTo({
  destination: center
})



export { widget }
