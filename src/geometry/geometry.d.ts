import type { Matrix4 } from '@cesium/engine'

export type AxisId = 'X' | 'Y' | 'Z'
export type Mode = 'translate' | 'scale' | 'rotate'

export interface GeometryOptions {
  modelMatrix: Matrix4 // L -> W
}

/** Primitive / GeometryInstance 拾取 id */
export interface GizmoPickId {
  axis: AxisId
  type: Mode
}

export const AXIS_LENGTH = 1.0
export const HEAD_LEN = 0.25
export const HEAD_RADIUS = 0.06
export const HEAD_SLICES = 8
export const STEM_WIDTH_PX = 2
export const BOX_HALF = 0.05
