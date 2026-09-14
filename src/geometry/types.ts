import type { Cartesian3, Color, Primitive } from '@cesium/engine'
import type {
  ControlMode,
  HandleDescriptor,
  HandleFrameKind,
  HandleId,
  ResolvedConstraint,
} from '../core/types'

export type { Triple, ControlMode, HandleId } from '../core/types'
export { AXES } from '../core/types'

export interface MeshData {
  positions: Cartesian3[]
  indices: Uint32Array
  boundingRadius: number
}

/**
 * 一个手柄的渲染与拾取资产，外加创建时就解析好的 HandleDescriptor。
 * 交互语义全部在 descriptor 里，几何资产只负责画和拾取。
 */
export class Handle {
  readonly descriptor: HandleDescriptor
  readonly frameKind: HandleFrameKind
  meshes: MeshData[]
  primitives: Primitive[]

  constructor(
    id: HandleId,
    mode: ControlMode,
    constraint: ResolvedConstraint,
    color: Color,
    frameKind: HandleFrameKind,
    meshes: MeshData[],
    primitives: Primitive[],
  ) {
    this.descriptor = {
      id,
      mode,
      constraint,
      color,
    }
    this.frameKind = frameKind
    this.meshes = meshes
    this.primitives = primitives
  }

  get id(): HandleId {
    return this.descriptor.id
  }

  get color(): Color {
    return this.descriptor.color
  }
}
