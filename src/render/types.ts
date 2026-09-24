import type { Matrix4 } from '@cesium/engine'
import type { ControlSnapshot } from '../controller/types'
import type { CameraSnapshot, ViewportSnapshot } from '../input/types'
import type { DragOverlayState } from '../overlay/types'

/**
 * Render 模块协议：RenderSystem 向 Controller / Geometry 提供的帧切片，
 * 以及 Geometry / Overlay / modelMatrix 的渲染分发出口。
 * 本文件只允许出现类型，不得导出任何运行时值。
 */

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

/** RenderSystem 每帧的分发出口。 */
export interface RenderSystemSinks {
  onGeometryFrame(frame: GeometryFrameContext): void
  onOverlayFrame(overlay: DragOverlayState | null): void
  onModelMatrix(modelMatrix: Matrix4): void
}
