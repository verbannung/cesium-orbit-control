import type { OverlayFrameContext } from '../core/frame'
import type { TransformFrameState } from '../core/state'

/**
 * 屏幕空间渲染器。只消费 Controller 已解析的世界图元与受限投影能力。
 *
 * Overlay 不得：读取局部基重新推导轴或平面、求 Gizmo 矩阵的逆、
 * 做局部/世界转换、重新生成旋转圆弧、按起终点反推角度/位移/缩放比例。
 */
export interface Overlay<TState extends TransformFrameState = TransformFrameState> {
  render(frame: OverlayFrameContext, state: TState): void
  clear(): void
  destroy(): void
}
