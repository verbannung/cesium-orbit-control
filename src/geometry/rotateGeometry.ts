import {
  BlendingState,
  BoundingSphere,
  Cartesian3,
  Color,
  ComponentDatatype,
  Geometry,
  GeometryAttribute,
  GeometryAttributes,
  GeometryInstance,
  Material,
  MaterialAppearance,
  Matrix4,
  Primitive,
  PrimitiveType,
} from '@cesium/engine'
import { BaseGeometry } from './baseGeometry'
import { AXES } from './geometryUtil'
import type { AxisId, GizmoPickId } from './geometry'
import ringVS from '../shader/ringVS.glsl?raw'
import ringFS from '../shader/ringFS.glsl?raw'
import ringMaterial from '../shader/ringMaterial.glsl?raw'

interface RingOptions {
  modelMatrix?: Matrix4
  u?: Cartesian3
  v?: Cartesian3
  color?: Color
  axis?: AxisId
    halfWidthPx?: number,
    segments?: number,
}

export class RotateGeometry extends BaseGeometry {
  private buildSingle(
    axis: AxisId,
    color: Color,
    rot: Matrix4,
    modelMatrix: Matrix4,
  ): Primitive {
    const u = Matrix4.multiplyByPointAsVector(rot, Cartesian3.UNIT_X, new Cartesian3())
    const v = Matrix4.multiplyByPointAsVector(rot, Cartesian3.UNIT_Y, new Cartesian3())
    Cartesian3.normalize(u, u)
    Cartesian3.normalize(v, v)

    return buildRingPrimitive({
      modelMatrix: Matrix4.clone(modelMatrix, new Matrix4()),
      u,
      v,
      color,
      axis,
      halfWidthPx: 3.0,
    })
  }

  public buildGeometry(modelMatrix: Matrix4): Primitive[] {
    this._primitives = AXES.map(({ axis, color, rot }) =>
      this.buildSingle(axis, color, rot, modelMatrix),
    )
    return this._primitives
  }
}

export function buildRingPrimitive(options: RingOptions = {}) {
  const {
    modelMatrix = Matrix4.IDENTITY,
    u = Cartesian3.UNIT_X,
    v = Cartesian3.UNIT_Y,
    color = Color.LIME.withAlpha(0.8),
    axis,
      halfWidthPx = 3.0,
    segments = 64,
  } = options

  const ringStrip = buildRingStrip(u, v, segments)
  // 每种颜色用独立 type，避免 Material 缓存串色
  const material = new Material({
    translucent: true,
      fabric: {
        //避免缓存串色
      type: `ScreenSpaceRing_${axis ?? 'default'}`,
      uniforms: {
        u_color: color,
      },
      source: ringMaterial,
    },
  })

  const appearance = new MaterialAppearance({
    material,
    materialSupport: MaterialAppearance.MaterialSupport.BASIC,
    vertexShaderSource: ringVS,
    fragmentShaderSource: ringFS,
    translucent: true,
    flat: true,
    closed: false,
    renderState: {
      depthTest: { enabled: false },
      depthMask: false,
      blending: BlendingState.ALPHA_BLEND,
    },
  })
  ;(appearance as MaterialAppearance & { uniforms: Record<string, number> }).uniforms =
    { u_halfWidthPx: halfWidthPx }

  return new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: ringStrip,
      id: axis ? ({ axis, type: 'rotate' } satisfies GizmoPickId) : undefined,
    }),
    appearance,
    asynchronous: false,
    compressVertices: false,
    modelMatrix,
  })
}

/** u、v 必须正交且归一化 */
export function buildRingStrip(u: Cartesian3, v: Cartesian3, segments: number) {
  const vertexCount = segments * 2
  const positions = new Float64Array(vertexCount * 3)
  const tangents = new Float32Array(vertexCount * 3)
  const sides = new Float32Array(vertexCount)

  const point = new Cartesian3()
  const tangent = new Cartesian3()
  const temp = new Cartesian3()
  const indices = new Uint16Array(segments * 6)

  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    // P(a) = cos·u + sin·v            （单位圆，半径 1）
    Cartesian3.multiplyByScalar(u, cos, point)
    Cartesian3.multiplyByScalar(v, sin, temp)
    Cartesian3.add(point, temp, point)
    // P'(a) = -sin·u + cos·v          （解析切线，等价于 cross(n, P)）
    Cartesian3.multiplyByScalar(u, -sin, tangent)
    Cartesian3.multiplyByScalar(v, cos, temp)
    Cartesian3.add(tangent, temp, tangent)
    // u、v 正交归一 → |P'(a)| = sqrt(sin²+cos²) = 1，无需归一化
    for (let k = 0; k < 2; k++) {
      const index = i * 2 + k
      positions[index * 3] = point.x
      positions[index * 3 + 1] = point.y
      positions[index * 3 + 2] = point.z
      tangents[index * 3] = tangent.x
      tangents[index * 3 + 1] = tangent.y
      tangents[index * 3 + 2] = tangent.z
      sides[index] = k === 0 ? -1 : 1
    }
  }
  for (let i = 0; i < segments; i++) {
    const b = i * 2
    const bn = ((i + 1) % segments) * 2
    indices.set([b, b + 1, bn, bn, b + 1, bn + 1], i * 6)
  }
  return new Geometry({
    attributes: {
      position: new GeometryAttribute({
        componentDatatype: ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: positions,
      }),
      tangentMC: new GeometryAttribute({
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 3,
        values: tangents,
      }),
      side: new GeometryAttribute({
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 1,
        values: sides,
      }),
    } as unknown as GeometryAttributes,
    indices,
    primitiveType: PrimitiveType.TRIANGLES,
    boundingSphere: new BoundingSphere(Cartesian3.ZERO, 1.0),
  })
}
