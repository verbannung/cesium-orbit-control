import type { Cartesian2, Cartesian3, Matrix4 } from '@cesium/engine'
import type {
  CameraSnapshot,
  ControlSnapshot,
  ViewportSnapshot,
} from './snapshots'

export interface FrameEnvironment {
  readonly camera: CameraSnapshot
  readonly viewport: ViewportSnapshot
  /** 单位世界长度占多少 CSS 像素 */
  readonly pixelScale: number
}

/**
 * Controller 的帧切片：拥有全部三维能力。
 * gizmoMatrix = [R · s | T]，s 为屏幕均匀尺度，不含物体自身 S。
 */
export interface ControllerFrameContext {
  readonly environment: FrameEnvironment
  readonly committedControl: ControlSnapshot //模型 R/S/T
  readonly gizmoMatrix: Matrix4
  readonly viewMatrix: Matrix4
  readonly axisFlipMatrix: Matrix4

}

/** Geometry 的帧切片：只读矩阵与生效控制状态，不含交互语义。 */
export interface GeometryFrameContext {
  readonly environment: FrameEnvironment
  readonly effectiveControl: ControlSnapshot
  readonly gizmoMatrix: Matrix4
  readonly viewMatrix: Matrix4
  readonly axisFlipMatrix: Matrix4
}

/**
 * Overlay 的帧切片：只有屏幕能力。
 * 故意不提供 gizmoMatrix / viewMatrix / axisFlipMatrix /
 * screenToWorldRay，
 * 从类型层面阻止 Overlay 重新推导交互语义。
 */
export interface OverlayFrameContext {
  readonly viewport: ViewportSnapshot
  readonly pixelRatio: number

  worldToScreen(point: Cartesian3, result?: Cartesian2): Cartesian2 | null
}
