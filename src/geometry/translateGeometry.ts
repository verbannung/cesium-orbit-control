import {
  Cartesian3,
  ColorGeometryInstanceAttribute,
  CylinderGeometry,
  GeometryInstance,
  Matrix4,
  PerInstanceColorAppearance,
  Primitive,
} from '@cesium/engine'
import { BaseGeometry } from './baseGeometry'
import {
  AXES,
  buildAxisLinePrimitive,
  buildDiscGeometry,
  gizmoSolidRenderState,
} from './geometryUtil'
import {
  AXIS_LENGTH,
  HEAD_LEN,
  HEAD_RADIUS,
  HEAD_SLICES,
  type GizmoPickId,
} from './geometry'

export class TranslateGeometry extends BaseGeometry {
  public buildGeometry(modelMatrix: Matrix4): Primitive[] {
    this._primitives = buildTransformPrimitive(modelMatrix)
    return this._primitives
  }
}

export function buildTransformPrimitive(modelMatrix: Matrix4 = Matrix4.IDENTITY) {
  return [
    buildAxisLinePrimitive(modelMatrix, 'translate', AXIS_LENGTH),
    buildArrowHeadPrimitive(modelMatrix),
  ]
}

function buildArrowHeadPrimitive(modelMatrix: Matrix4) {
  const disc = buildDiscGeometry(HEAD_RADIUS, HEAD_SLICES)
  const cone = new CylinderGeometry({
    length: HEAD_LEN,
    topRadius: 0.0,
    bottomRadius: HEAD_RADIUS,
    slices: HEAD_SLICES,
    vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
  })
  const discLocal = Matrix4.fromTranslation(new Cartesian3(0, 0, AXIS_LENGTH))
  const coneLocal = Matrix4.fromTranslation(
    new Cartesian3(0, 0, AXIS_LENGTH + HEAD_LEN / 2),
  )

  const instances = AXES.flatMap(({ axis, color, rot }) => [
    new GeometryInstance({
      geometry: disc,
      modelMatrix: Matrix4.multiply(rot, discLocal, new Matrix4()),
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
      id: { axis, type: 'translate' } satisfies GizmoPickId,
    }),
    new GeometryInstance({
      geometry: cone,
      modelMatrix: Matrix4.multiply(rot, coneLocal, new Matrix4()),
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
      id: { axis, type: 'translate' } satisfies GizmoPickId,
    }),
  ])

  return new Primitive({
    geometryInstances: instances,
    appearance: new PerInstanceColorAppearance({
      flat: true,
      translucent: false,
      renderState: gizmoSolidRenderState(),
    }),
    asynchronous: false,
    compressVertices: false,
    modelMatrix,
  })
}
