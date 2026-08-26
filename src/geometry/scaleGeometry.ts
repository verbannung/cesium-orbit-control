import {
  BoxGeometry,
  Cartesian3,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  Matrix4,
  PerInstanceColorAppearance,
  Primitive,
} from '@cesium/engine'
import { BaseGeometry } from './baseGeometry'
import { AXES, buildAxisLinePrimitive, gizmoSolidRenderState } from './geometryUtil'
import { AXIS_LENGTH, BOX_HALF, type GizmoPickId } from './geometry'

export class ScaleGeometry extends BaseGeometry {
  public buildGeometry(modelMatrix: Matrix4): Primitive[] {
    this._primitives = buildScalePrimitive(modelMatrix)
    return this._primitives
  }
}

export function buildScalePrimitive(modelMatrix: Matrix4 = Matrix4.IDENTITY) {
  return [
    buildAxisLinePrimitive(modelMatrix, 'scale', AXIS_LENGTH),
    buildScaleBoxPrimitive(modelMatrix),
  ]
}

function buildScaleBoxPrimitive(modelMatrix: Matrix4) {
  const box = BoxGeometry.fromDimensions({
    dimensions: new Cartesian3(BOX_HALF * 2, BOX_HALF * 2, BOX_HALF * 2),
    vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
  })
  const local = Matrix4.fromTranslation(new Cartesian3(0, 0, AXIS_LENGTH + BOX_HALF))
  return new Primitive({
    geometryInstances: AXES.map(({ axis, color, rot }) => new GeometryInstance({
      geometry: box,
      modelMatrix: Matrix4.multiply(rot, local, new Matrix4()),
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
      id: { axis, type: 'scale' } satisfies GizmoPickId,
    })),
    appearance: new PerInstanceColorAppearance({
      flat: true,
      translucent: false,
      renderState: gizmoSolidRenderState(),
    }),
    asynchronous: false,
    modelMatrix,
  })
}
