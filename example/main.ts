import {
  CesiumWidget,
  Ion,
  IonImageryProvider,
  ImageryLayer,
  EllipsoidTerrainProvider,
  Cartesian3,
  Transforms,
  GeometryInstance,
  BoxGeometry,
  Primitive,
  ColorGeometryInstanceAttribute,
  Color,
  PerInstanceColorAppearance,
  HeadingPitchRange,
  Matrix4,
  Math as CesiumMath,
} from '@cesium/engine'
import '@cesium/engine/Source/Widget/CesiumWidget.css'
import { CesiumOrbitControl } from '../src/index'

Ion.defaultAccessToken = import.meta.env.CESIUM_TOKEN

const widget = new CesiumWidget('cesiumContainer', {
  baseLayer: ImageryLayer.fromProviderAsync(IonImageryProvider.fromAssetId(2)),
  terrainProvider: new EllipsoidTerrainProvider(),
  scene3DOnly: true,
});

const center = Cartesian3.fromDegrees(112, 32, 10);
const enuMatrix = Transforms.eastNorthUpToFixedFrame(center);

// 放到地理 center 的 ENU 面上
const primitive = new Primitive({
  geometryInstances: new GeometryInstance({
    geometry: new BoxGeometry({
      minimum: new Cartesian3(-0.5, -0.5, -0.5),
      maximum: new Cartesian3(0.5, 0.5, 0.5),
    }),
    attributes: {
      color: ColorGeometryInstanceAttribute.fromColor(Color.LIME.withAlpha(0.8)),
    },
  }),
  appearance: new PerInstanceColorAppearance({
    translucent: true,
    flat: true,
  }),
  modelMatrix: enuMatrix,
});
const orbitControl = new CesiumOrbitControl(widget);
widget.scene.primitives.add(primitive);

orbitControl.attachObject(primitive.modelMatrix, "rotate");

// lookAt 会锁定相机参考系，随后置回单位矩阵解锁，只借它摆好机位
widget.camera.lookAt(center, new HeadingPitchRange(0, CesiumMath.toRadians(-35), 40));
widget.camera.lookAtTransform(Matrix4.IDENTITY);

export { widget }
