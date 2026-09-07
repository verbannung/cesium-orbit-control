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
import { OrbitControl } from '../src/index'
import type { Mode } from '../src/geometry/types'

Ion.defaultAccessToken = import.meta.env.CESIUM_TOKEN

const widget = new CesiumWidget('cesiumContainer', {
  baseLayer: ImageryLayer.fromProviderAsync(IonImageryProvider.fromAssetId(2)),
  terrainProvider: new EllipsoidTerrainProvider(),
  scene3DOnly: true,
});
// widget.scene.camera.switchToOrthographicFrustum();


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
widget.scene.primitives.add(primitive);

// onModelMatrixChange 是唯一对外推送口，宿主自行决定怎么消费
const orbitControl = new OrbitControl(widget.canvas, widget.scene, widget.camera, {
  onModelMatrixChange: (m) => Matrix4.clone(m, primitive.modelMatrix),
});
orbitControl.bind(primitive.modelMatrix, 'translate');

const modes: Mode[] = ['translate', 'rotate', 'scale'];

const hint = document.createElement('div');
hint.style.cssText =
  'position:fixed;top:8px;left:8px;padding:6px 10px;background:rgba(0,0,0,.6);' +
  'color:#fff;font:13px monospace;border-radius:4px;pointer-events:none';
document.body.appendChild(hint);
const renderHint = () => {
  hint.textContent = `1/2/3 切换模式 | 当前: ${orbitControl.currentMode}`;
};
renderHint();

window.addEventListener('keydown', (e) => {
  const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
  if (i < 0) return;
  orbitControl.setMode(modes[i]);
  renderHint();
});

// lookAt 会锁定相机参考系，随后置回单位矩阵解锁，只借它摆好机位
widget.camera.lookAt(center, new HeadingPitchRange(0, CesiumMath.toRadians(-35), 40));
widget.camera.lookAtTransform(Matrix4.IDENTITY);

export { widget }
