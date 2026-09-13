import type { Cartesian3, Matrix4, Quaternion } from '@cesium/engine'
import type { ControlMode, HandleDescriptor } from './types'

export type SessionId = string

/**
 * 坐标/向量/四元数/矩阵一律直接使用 Cesium 类型（架构文档 6.1）。
 * Cesium 数学类型可变，不可变性由所有权规则保证：
 * Controller 发布前必须 clone，已发布对象只读，不得再作为 result 参数。
 */
export interface WorldSegment {
  readonly start: Cartesian3
  readonly end: Cartesian3
}

export interface WorldPolyline {
  readonly points: readonly Cartesian3[]
  readonly closed: boolean
}

export interface WorldPolygon {
  readonly points: readonly Cartesian3[]
}

export interface ControlSnapshot {
  readonly translation: Cartesian3
  readonly rotation: Quaternion
  readonly scale: Cartesian3
}

/** Geometry 与外部对象在一帧内应观察到的生效 TRS。 */
export type EffectiveControlState = ControlSnapshot

export interface CameraSnapshot {
  readonly positionWorld: Cartesian3
  readonly directionWorld: Cartesian3
  readonly upWorld: Cartesian3
  readonly rightWorld: Cartesian3
  readonly viewMatrix: Matrix4
  readonly projectionMatrix: Matrix4
}

export interface ViewportSnapshot {
  readonly widthCss: number
  readonly heightCss: number
  readonly pixelRatio: number
}

export interface SessionStartSnapshot {
  readonly control: ControlSnapshot
  readonly camera: CameraSnapshot
  readonly viewport: ViewportSnapshot
  readonly environmentRevision: number
}

export interface SessionContext {
  readonly id: SessionId
  readonly mode: ControlMode
  readonly handle: HandleDescriptor
  readonly start: SessionStartSnapshot
}
