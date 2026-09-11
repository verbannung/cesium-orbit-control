import {
  ArcType,
  BlendingState,
  BoundingSphere,
  BoxGeometry,
  Cartesian3,
  Color,
  ComponentDatatype,
  CylinderGeometry,
  Geometry,
  GeometryAttribute,
  GeometryAttributes,
  GeometryInstance,
  GeometryPipeline,
  Material,
  MaterialAppearance,
  Matrix3,
  Matrix4,
  PolylineMaterialAppearance,
  PolylineGeometry,
  Primitive,
  PrimitiveType,
} from '@cesium/engine'
import type { Handle, HandleId, MeshData } from './types'
import ringFS from '../shader/ringFS.glsl?raw'
import ringFSNoCull from '../shader/ringFSNoCull.glsl?raw'
import ringMaterial from '../shader/ringMaterial.glsl?raw'
import ringVS from '../shader/ringVS.glsl?raw'

// —— 几何尺寸常量（原 types / handles 分散定义，统一收口）——
export const AXIS_LENGTH = 1.0
export const HEAD_LEN = 0.25
export const HEAD_RADIUS = 0.06
export const HEAD_SLICES = 8
export const BOX_HALF = 0.05
export const STEM_WIDTH_PX = 2
export const TUBE_RADIUS = 0.03
export const RING_RADIUS = 1.0
export const VIEW_AXIS_RADIUS = 0.22
export const VIEW_PLANE_RADIUS = 0.22
export const RING_HALF_WIDTH_PX = 3
export const PLANE_MIN = 0.4
export const PLANE_MAX = 0.7
export const PICK_SIDES = 6
export const PICK_SEGMENTS = 48

const OVERLAY = {
  depthTest: { enabled: false },
  depthMask: true,
  cull: { enabled: false },
}

const OVERLAY_DEPTH = {
  depthTest: { enabled: false },
  depthMask: true,
  blending: BlendingState.ALPHA_BLEND,
}

const SEGMENTS = 64

export function pointAlong(direction: Cartesian3, d: number): Cartesian3 {
  return Cartesian3.multiplyByScalar(direction, d, new Cartesian3())
}

/**
 * 把局部偏移烘进顶点，而不是交给 GeometryInstance.modelMatrix。
 *
 * scene3DOnly + 单实例时 Cesium 不会烘顶点，而是把 instance 矩阵乘进
 * Primitive.modelMatrix 再回写。呈现域每帧覆写 Primitive.modelMatrix 为 gizmo 帧，
 * 那个乘积下一帧就没了，几何会塌回 gizmo 原点。
 */
export function bakeTransform(geometry: Geometry, modelMatrix: Matrix4): Geometry {
  const instance = new GeometryInstance({ geometry, modelMatrix })
  GeometryPipeline.transformToWorldCoordinates(instance)
  return instance.geometry
}

export function applyHandlePick(handle: Handle, picked: boolean): void {
  for (const p of handle.primitives) {
    const uniforms = (p.appearance as { material?: Material } | undefined)?.material?.uniforms as
      | Record<string, unknown>
      | undefined
    if (uniforms && 'u_pick' in uniforms) uniforms.u_pick = picked ? 1 : 0
  }
}

function createGizmoMaterial(color: Color): Material {
  return new Material({
    translucent: true,
    fabric: {
      type: 'gizmo_handle',
      uniforms: {
        u_color: color.withAlpha(0.9),
        u_pick: 0,
      },
      source: ringMaterial,
    },
  })
}

/** 平面手柄四角：u/v 张成面上 [PLANE_MIN, PLANE_MAX] */
export function planeCorners(u: Cartesian3, v: Cartesian3): Cartesian3[] {
  const at = (a: number, b: number): Cartesian3 =>
    new Cartesian3(a * u.x + b * v.x, a * u.y + b * v.y, a * u.z + b * v.z)
  return [
    at(PLANE_MIN, PLANE_MIN),
    at(PLANE_MIN, PLANE_MAX),
    at(PLANE_MAX, PLANE_MAX),
    at(PLANE_MAX, PLANE_MIN),
  ]
}

// —— 视觉：环 ——

export function buildRing(opts: {
  id: HandleId
  u: Cartesian3
  v: Cartesian3
  color: Color
  radius?: number
  cullHalf: boolean
}): Primitive[] {
  const { id, u, v, color, cullHalf } = opts
  const radius = opts.radius ?? RING_RADIUS
  const material = createGizmoMaterial(color)

  const appearance = new MaterialAppearance({
    material,
    materialSupport: MaterialAppearance.MaterialSupport.BASIC,
    vertexShaderSource: ringVS,
    fragmentShaderSource: cullHalf ? ringFS : ringFSNoCull,
    translucent: true,
    flat: true,
    closed: false,
    renderState: OVERLAY_DEPTH,
  })
  ;(appearance as MaterialAppearance & { uniforms: Record<string, number> }).uniforms = {
    u_halfWidthPx: RING_HALF_WIDTH_PX,
    u_cullBackHalf: cullHalf ? 1 : 0,
  }

  const primitive = new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: buildRingStrip(u, v, radius),
      id,
    }),
    appearance,
    asynchronous: false,
    compressVertices: false,
    modelMatrix: new Matrix4(),
  })

  return [primitive]
}

function buildRingStrip(u: Cartesian3, v: Cartesian3, radius: number): Geometry {
  const positions = new Float64Array(SEGMENTS * 2 * 3)
  const tangents = new Float32Array(SEGMENTS * 2 * 3)
  const sides = new Float32Array(SEGMENTS * 2)
  const indices = new Uint16Array(SEGMENTS * 6)

  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    for (let k = 0; k < 2; k++) {
      const n = (i * 2 + k) * 3
      positions[n] = radius * (cos * u.x + sin * v.x)
      positions[n + 1] = radius * (cos * u.y + sin * v.y)
      positions[n + 2] = radius * (cos * u.z + sin * v.z)
      tangents[n] = -sin * u.x + cos * v.x
      tangents[n + 1] = -sin * u.y + cos * v.y
      tangents[n + 2] = -sin * u.z + cos * v.z
      sides[i * 2 + k] = k === 0 ? -1 : 1
    }
    const b = i * 2
    const bn = ((i + 1) % SEGMENTS) * 2
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
    boundingSphere: new BoundingSphere(Cartesian3.ZERO, radius),
  })
}

/**
 * 平移/通用视平面环。几何建在 u、v 张成的局部平面上。
 * 数据格式与 translateGeometry 一致：`(u, v) → Primitive[]`
 */

export function buildViewRing(
  u: Cartesian3,
  v: Cartesian3,
  opts: { id?: HandleId; color: Color; radius?: number; cullHalf?: boolean },
): Primitive[] {
  return buildRing({
    id: opts.id ?? 'translate-view',
    u,
    v,
    color: opts.color,
    radius: opts.radius ?? VIEW_PLANE_RADIUS,
    cullHalf: opts.cullHalf ?? false,
  })
}

/**
 * 视平面环碰撞代理：圆环管。
 * 数据格式：`(u, v) → MeshData[]`
 */
//TODO 支持整圆 以扩大碰撞体积
export function buildViewRingMeshes(
  u: Cartesian3,
  v: Cartesian3,
  radius = VIEW_PLANE_RADIUS,
): MeshData[] {
  const direction = Cartesian3.cross(u, v, new Cartesian3())
  return [
    buildRingTubeMesh(direction, u, v, radius, TUBE_RADIUS, PICK_SEGMENTS, PICK_SIDES),
  ]
}

// —— 视觉：平移轴（线段 + 圆锥）——

/**
 * 平移轴：线段 + 圆锥箭头。几何建在 u、v 张成平面的法向（u×v）上。
 * 数据格式：`(u, v) → Primitive[]`
 */
export function buildHeadAxis(
  u: Cartesian3,
  v: Cartesian3,
  color: Color,
): Primitive[] {
  const direction = Cartesian3.cross(u, v, new Cartesian3())
  const rotation = new Matrix3(
    u.x, v.x, direction.x,
    u.y, v.y, direction.y,
    u.z, v.z, direction.z,
  )

  const stem = new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: new PolylineGeometry({
        positions: [Cartesian3.ZERO, pointAlong(direction, AXIS_LENGTH)],
        width: STEM_WIDTH_PX,
        vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
        arcType: ArcType.NONE,
      }),
    }),
    appearance: new PolylineMaterialAppearance({
      material: createGizmoMaterial(color),
      translucent: true,
    }),
    asynchronous: false,
    modelMatrix: new Matrix4(),
  })

  const head = new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: bakeTransform(
        CylinderGeometry.createGeometry(
          new CylinderGeometry({
            length: HEAD_LEN,
            topRadius: 0.0,
            bottomRadius: HEAD_RADIUS,
            slices: HEAD_SLICES,
            vertexFormat: MaterialAppearance.MaterialSupport.BASIC.vertexFormat,
          }),
        )!,
        Matrix4.fromRotationTranslation(
          rotation,
          pointAlong(direction, AXIS_LENGTH + HEAD_LEN / 2),
        ),
      ),
    }),
    appearance: new MaterialAppearance({
      material: createGizmoMaterial(color),
      materialSupport: MaterialAppearance.MaterialSupport.BASIC,
      flat: true,
      translucent: true,
      renderState: OVERLAY,
    }),
    asynchronous: false,
    compressVertices: false,
    modelMatrix: new Matrix4(),
  })

  return [stem, head]
}

/**
 * 平移轴碰撞代理：圆管 + 圆锥。
 * 数据格式：`(u, v) → MeshData[]`
 */
export function buildHeadAxisMeshes(u: Cartesian3, v: Cartesian3): MeshData[] {
  const direction = Cartesian3.cross(u, v, new Cartesian3())
  return [
    buildStemMesh(direction, u, v, AXIS_LENGTH, TUBE_RADIUS),
    buildConeMesh(
      direction,
      u,
      v,
      AXIS_LENGTH,
      HEAD_LEN,
      Math.max(HEAD_RADIUS, TUBE_RADIUS),
      HEAD_SLICES,
    ),
  ]
}

// —— 视觉：缩放轴（线段 + 方块）——

/**
 * 缩放轴：线段 + 端点方块。几何建在 u、v 张成平面的法向（u×v）上。
 * 数据格式：`(u, v) → Primitive[]`
 */
export function buildBoxAxis(u: Cartesian3, v: Cartesian3, color: Color): Primitive[] {
  const direction = Cartesian3.cross(u, v, new Cartesian3())

  const stem = new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: new PolylineGeometry({
        positions: [Cartesian3.ZERO, pointAlong(direction, AXIS_LENGTH)],
        width: STEM_WIDTH_PX,
        vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
        arcType: ArcType.NONE,
      }),
    }),
    appearance: new PolylineMaterialAppearance({
      material: createGizmoMaterial(color),
      translucent: true,
    }),
    asynchronous: false,
    modelMatrix: new Matrix4(),
  })

  const box = new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: bakeTransform(
        BoxGeometry.createGeometry(
          BoxGeometry.fromDimensions({
            dimensions: new Cartesian3(BOX_HALF * 2, BOX_HALF * 2, BOX_HALF * 2),
            vertexFormat: MaterialAppearance.MaterialSupport.BASIC.vertexFormat,
          }),
        )!,
        Matrix4.fromTranslation(pointAlong(direction, AXIS_LENGTH + BOX_HALF)),
      ),
    }),
    appearance: new MaterialAppearance({
      material: createGizmoMaterial(color),
      materialSupport: MaterialAppearance.MaterialSupport.BASIC,
      flat: true,
      translucent: true,
      renderState: OVERLAY,
    }),
    asynchronous: false,
    compressVertices: false,
    modelMatrix: new Matrix4(),
  })

  return [stem, box]
}

/**
 * 缩放轴碰撞代理：圆管 + 方块。
 * 数据格式：`(u, v) → MeshData[]`
 */
export function buildBoxAxisMeshes(u: Cartesian3, v: Cartesian3): MeshData[] {
  const direction = Cartesian3.cross(u, v, new Cartesian3())
  return [
    buildStemMesh(direction, u, v, AXIS_LENGTH, TUBE_RADIUS),
    buildBoxMesh(direction, AXIS_LENGTH + BOX_HALF, Math.max(BOX_HALF, TUBE_RADIUS)),
  ]
}

/**
 * 旋转轴环（半环剔除）。几何建在 u、v 张成的局部平面上。
 * 数据格式：`(u, v, id) → Primitive[]`
 */
export function buildRotateRing(
  u: Cartesian3,
  v: Cartesian3,
  id: HandleId,
  color: Color,
): Primitive[] {
  return buildRing({
    id,
    u,
    v,
    color,
    radius: RING_RADIUS,
    cullHalf: true,
  })
}

/**
 * 旋转轴环碰撞代理：整圈圆环管。
 * 数据格式：`(u, v) → MeshData[]`
 */
export function buildRotateRingMeshes(u: Cartesian3, v: Cartesian3): MeshData[] {
  return buildViewRingMeshes(u, v, RING_RADIUS)
}

// —— 碰撞 mesh 原语 ——

/** 沿主轴扫掠圆管，两端不封口 */
export function buildStemMesh(
  direction: Cartesian3,
  u: Cartesian3,
  v: Cartesian3,
  length: number,
  tubeRadius: number,
): MeshData {
  const positions: Cartesian3[] = []
  for (let i = 0; i < 2; i++) {
    const along = i * length
    for (let j = 0; j < PICK_SIDES; j++) {
      const a = (j / PICK_SIDES) * Math.PI * 2
      const cu = Math.cos(a) * tubeRadius
      const sv = Math.sin(a) * tubeRadius
      positions.push(
        new Cartesian3(
          along * direction.x + cu * u.x + sv * v.x,
          along * direction.y + cu * u.y + sv * v.y,
          along * direction.z + cu * u.z + sv * v.z,
        ),
      )
    }
  }

  const indices = new Uint32Array(PICK_SIDES * 6)
  let p = 0
  for (let j = 0; j < PICK_SIDES; j++) {
    const j2 = (j + 1) % PICK_SIDES
    indices[p++] = j
    indices[p++] = j2
    indices[p++] = PICK_SIDES + j
    indices[p++] = PICK_SIDES + j
    indices[p++] = j2
    indices[p++] = PICK_SIDES + j2
  }

  return { positions, indices, boundingRadius: length + tubeRadius }
}

/** 箭头圆锥拾取代理，底面封口 */
export function buildConeMesh(
  direction: Cartesian3,
  u: Cartesian3,
  v: Cartesian3,
  stemLength: number,
  headLen: number,
  radius: number,
  slices: number,
): MeshData {
  const tip = stemLength + headLen
  const positions: Cartesian3[] = [
    new Cartesian3(tip * direction.x, tip * direction.y, tip * direction.z),
    new Cartesian3(stemLength * direction.x, stemLength * direction.y, stemLength * direction.z),
  ]
  for (let i = 0; i < slices; i++) {
    const a = (i / slices) * Math.PI * 2
    const cu = Math.cos(a) * radius
    const sv = Math.sin(a) * radius
    positions.push(
      new Cartesian3(
        stemLength * direction.x + cu * u.x + sv * v.x,
        stemLength * direction.y + cu * u.y + sv * v.y,
        stemLength * direction.z + cu * u.z + sv * v.z,
      ),
    )
  }

  const indices = new Uint32Array(slices * 6)
  let p = 0
  for (let i = 0; i < slices; i++) {
    const r0 = 2 + i
    const r1 = 2 + ((i + 1) % slices)
    indices[p++] = 0
    indices[p++] = r0
    indices[p++] = r1
    indices[p++] = 1
    indices[p++] = r1
    indices[p++] = r0
  }

  return {
    positions,
    indices,
    boundingRadius: Math.hypot(stemLength + headLen, radius),
  }
}

/** 轴端方块拾取代理 */
export function buildBoxMesh(direction: Cartesian3, center: number, half: number): MeshData {
  const positions: Cartesian3[] = []
  for (let sz = -1; sz <= 1; sz += 2) {
    for (let sy = -1; sy <= 1; sy += 2) {
      for (let sx = -1; sx <= 1; sx += 2) {
        positions.push(
          new Cartesian3(
            sx * half + center * direction.x,
            sy * half + center * direction.y,
            sz * half + center * direction.z,
          ),
        )
      }
    }
  }

  const quads: readonly [number, number, number, number][] = [
    [0, 1, 3, 2],
    [4, 6, 7, 5],
    [0, 4, 5, 1],
    [2, 3, 7, 6],
    [0, 2, 6, 4],
    [1, 5, 7, 3],
  ]
  const indices = new Uint32Array(quads.length * 6)
  let p = 0
  for (const [a, b, c, d] of quads) {
    indices[p++] = a
    indices[p++] = b
    indices[p++] = c
    indices[p++] = a
    indices[p++] = c
    indices[p++] = d
  }

  return { positions, indices, boundingRadius: center + half * Math.sqrt(3) }
}

/** 平面方片拾取代理，双面（求交时不依赖绕序） */
export function buildQuadMesh(corners: readonly Cartesian3[], padding: number): MeshData {
  const center = new Cartesian3()
  for (const c of corners) Cartesian3.add(center, c, center)
  Cartesian3.divideByScalar(center, corners.length, center)

  const positions = corners.map((c) => {
    const outward = Cartesian3.subtract(c, center, new Cartesian3())
    const len = Cartesian3.magnitude(outward)
    if (len < 1e-12) return Cartesian3.clone(c, new Cartesian3())
    Cartesian3.multiplyByScalar(outward, (len + padding) / len, outward)
    return Cartesian3.add(center, outward, outward)
  })

  return {
    positions,
    indices: new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]),
    boundingRadius: positions.reduce((m, p) => Math.max(m, Cartesian3.magnitude(p)), 0),
  }
}

/** 环心线圆管拾取代理 */
export function buildRingTubeMesh(
  normal: Cartesian3,
  u: Cartesian3,
  v: Cartesian3,
  ringRadius: number,
  tubeRadius: number,
  segments: number,
  sides: number,
): MeshData {
  const positions: Cartesian3[] = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    for (let j = 0; j < sides; j++) {
      const b = (j / sides) * Math.PI * 2
      const radial = ringRadius + Math.cos(b) * tubeRadius
      const along = Math.sin(b) * tubeRadius
      positions.push(
        new Cartesian3(
          radial * (ca * u.x + sa * v.x) + along * normal.x,
          radial * (ca * u.y + sa * v.y) + along * normal.y,
          radial * (ca * u.z + sa * v.z) + along * normal.z,
        ),
      )
    }
  }

  const indices = new Uint32Array(segments * sides * 6)
  let p = 0
  for (let i = 0; i < segments; i++) {
    const i2 = (i + 1) % segments
    for (let j = 0; j < sides; j++) {
      const j2 = (j + 1) % sides
      indices[p++] = i * sides + j
      indices[p++] = i * sides + j2
      indices[p++] = i2 * sides + j
      indices[p++] = i2 * sides + j
      indices[p++] = i * sides + j2
      indices[p++] = i2 * sides + j2
    }
  }

  return {
    positions,
    indices,
    boundingRadius: ringRadius + tubeRadius,
  }
}
