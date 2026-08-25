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
import ringVS from './ringVS.glsl?raw'
import ringFS from './ringFS.glsl?raw'
import ringMaterial from './ringMaterial.glsl?raw'

interface RingOptions {
  modelMatrix?: Matrix4
  u?: Cartesian3
  v?: Cartesian3
  color?: Color
  axis?: 'X' | 'Y' | 'Z'
  halfWidthPx?: number
}

function buildRingPrimitive(options: RingOptions = {}) {
  const {
    modelMatrix = Matrix4.IDENTITY,
    u = Cartesian3.UNIT_X,
    v = Cartesian3.UNIT_Y,
    color = Color.LIME.withAlpha(0.8),
    axis,
    halfWidthPx = 3.0,
  } = options

  const segments = 64
  const ringStrip = buildRingStrip(u, v, segments)
  // 每种颜色用独立 type，避免 Material 缓存串色
  const material = new Material({
    translucent: true,
    fabric: {
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
    // renderState 是整体替换而非合并：一旦自定义，translucent 隐含的 blending
    // 也必须一起写出来，否则半透明会失效。depthTest 关闭让操控器不被地形遮挡。
    renderState: {
      depthTest: { enabled: false },
      depthMask: false,
      blending: BlendingState.ALPHA_BLEND,
    },
  })
  // VS 用的 uniform 挂在 appearance 上（Material 会改名，VS 拿不到）
  // MaterialAppearance 类型未声明 uniforms，但 Primitive 会读取
  ;(appearance as MaterialAppearance & { uniforms: Record<string, number> }).uniforms =
    { u_halfWidthPx: halfWidthPx }

  return new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: ringStrip,
      id: axis ? { axis, type: 'rotate' } : undefined,
    }),
    appearance,
    asynchronous: false,
    compressVertices: false,
    modelMatrix,
  })
}

//u v必须正交且归一化
function buildRingStrip(u: Cartesian3, v: Cartesian3, segments: number) {
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
    //每一个路径有两个顶点
    for (let k = 0; k < 2; k++) {
      const index = i * 2 + k
      positions[index * 3] = point.x
      positions[index * 3 + 1] = point.y
      positions[index * 3 + 2] = point.z
      tangents[index * 3] = tangent.x
      tangents[index * 3 + 1] = tangent.y
      tangents[index * 3 + 2] = tangent.z
      //标记正面或者反面
      sides[index] = k === 0 ? -1 : 1
    }
  }
  for (let i = 0; i < segments; i++) {
    const b = i * 2
    //0->1->2 1->3->2
    const bn = ((i + 1) % segments) * 2
    indices.set([b, b + 1, bn, bn, b + 1, bn + 1], i * 6)
  }
  return new Geometry({
    attributes: {
      // 名字必须叫 position：Primitive 会自动做 RTE 拆成 position3DHigh/Low
      position: new GeometryAttribute({
        componentDatatype: ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: positions,
      }),
      //运行时额外属性，需要指定
      tangentMC: new GeometryAttribute({
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 3,
        values: tangents,
      }),
      //标记，运行时可以获取
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

export { buildRingPrimitive, buildRingStrip }
