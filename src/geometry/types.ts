import { Color, Cartesian3, type Primitive } from '@cesium/engine'

export type Triple<T> = [T, T, T]

export const AXES: Triple<Cartesian3> = [
  Cartesian3.UNIT_X,
  Cartesian3.UNIT_Y,
  Cartesian3.UNIT_Z,
]

export type Mode = 'translate' | 'rotate' | 'scale'

/** 每个轴/手柄唯一标识 */
export type HandleId =
  | 'translate-x'
  | 'translate-y'
  | 'translate-z'
  | 'translate-xy'
  | 'translate-yz'
  | 'translate-zx'
  | 'translate-view'
  | 'rotate-x'
  | 'rotate-y'
  | 'rotate-z'
  | 'rotate-view'
  | 'scale-x'
  | 'scale-y'
  | 'scale-z'
  | 'scale-uniform'

export type HandleType = 'axis' | 'plane' | 'view' | 'uniform'


export interface MeshData {
  positions: Cartesian3[]
  indices: Uint32Array
  boundingRadius: number
}

/** mesh / primitive 状态保存 */
export class Handle {
  readonly id: HandleId
  readonly basisLocal: ReadonlyArray<Cartesian3>
  readonly color: Color
  primitives!: Primitive[]
  meshes: MeshData[]
    handleType:HandleType

  constructor(
    id: HandleId,
    basisLocal: ReadonlyArray<Cartesian3>,
    color: Color,
    meshes: MeshData[],
    primitives: Primitive[],
    handleType:HandleType
  ) {
    this.id = id
    this.basisLocal = basisLocal
    this.color = color
    this.meshes = meshes
    this.primitives = primitives
      this.handleType = handleType
  }
}
