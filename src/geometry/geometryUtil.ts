import {
  ArcType,
  BoundingSphere,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  ComponentDatatype,
  Geometry,
  GeometryAttribute,
  GeometryAttributes,
  GeometryInstance,
  Matrix3,
  Matrix4,
  PolylineColorAppearance,
  PolylineGeometry,
  Primitive,
  PrimitiveType,
} from '@cesium/engine'
import {type GizmoPickId, STEM_WIDTH_PX} from './geometry'
import {rotate} from "../utils/mathUtil";


/** 默认构建 Z 轴朝上的坐标系，通过 rot 转到 X/Y/Z */
export const AXES = [
  { axis: 'X' as const, color: Color.RED, rot: rotate(Matrix3.fromRotationY(-Math.PI / 2)) },
  { axis: 'Y' as const, color: Color.LIME, rot: rotate(Matrix3.fromRotationX(-Math.PI / 2)) },
  { axis: 'Z' as const, color: Color.DODGERBLUE, rot: Matrix4.IDENTITY },
]



export function gizmoSolidRenderState() {
  // depth 关：不被地形挡住；cull 关：杆端圆盘从两侧都能看见
  return {
    depthTest: { enabled: false },
    depthMask: true,
    cull: { enabled: false },
  }
}

/** XY 平面实心圆盘，对齐 imm_draw_circle_fill_3d */
export function buildDiscGeometry(radius: number, slices: number): Geometry {
  const vertCount = slices + 1
  const positions = new Float64Array(vertCount * 3)
  const indices = new Uint16Array(slices * 3)
  for (let i = 0; i < slices; i++) {
    const a = (i / slices) * Math.PI * 2
    const vi = i + 1
    positions[vi * 3] = Math.cos(a) * radius
    positions[vi * 3 + 1] = Math.sin(a) * radius
    indices[i * 3] = 0
    indices[i * 3 + 1] = vi
    indices[i * 3 + 2] = (i + 1) % slices + 1
  }
  return new Geometry({
    attributes: {
      position: new GeometryAttribute({
        componentDatatype: ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: positions,
      }),
    } as unknown as GeometryAttributes,
    indices,
    primitiveType: PrimitiveType.TRIANGLES,
    boundingSphere: new BoundingSphere(Cartesian3.ZERO, radius),
  })
}


export function buildAxisLinePrimitive(
  modelMatrix: Matrix4,
  type: 'translate' | 'scale',
  length: number,
) {
  return new Primitive({
    geometryInstances: AXES.map(({ axis, color, rot }) => new GeometryInstance({
      geometry: new PolylineGeometry({
        positions: [Cartesian3.ZERO, new Cartesian3(0, 0, length)],
        width: STEM_WIDTH_PX,
        vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
        arcType: ArcType.NONE,
      }),
      modelMatrix: Matrix4.clone(rot),
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
      id: { axis, type } satisfies GizmoPickId,
    })),
    appearance: new PolylineColorAppearance({ translucent: false }),
    asynchronous: false,
    modelMatrix,
  })
}

