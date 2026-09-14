import type { Cartesian3, Matrix4, Quaternion } from '@cesium/engine'
import type { ControlMode, HandleDescriptor } from './types'

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

//T R S
export interface ControlSnapshot {
  readonly translation: Cartesian3
  readonly rotation: Quaternion
  readonly scale: Cartesian3
}


export interface CameraSnapshot {
  readonly positionWorld: Cartesian3
  readonly directionWorld: Cartesian3
  readonly upWorld: Cartesian3
  readonly rightWorld: Cartesian3
  readonly viewMatrix: Matrix4
  readonly projectionMatrix: Matrix4 //MVP之中ProjectionMatrix 投影矩阵，支持正摄投影/透视投影
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
}

export interface SessionContext {
  readonly mode: ControlMode
  readonly handle: HandleDescriptor
  readonly start: SessionStartSnapshot
}
