import type { Cartesian2, Cartesian3 } from '@cesium/engine'
import type { PointerInput } from './pointer'
import type { CameraSnapshot, ViewportSnapshot } from './snapshots'

/**
 * 唯一的 Cesium 适配面。EventManager / RenderSystem 依赖它，不依赖 Scene/Camera。
 * 该接口只暴露输入、相机以及像素投影等"输入源"能力。实现见 cesiumInputSource.ts
 */
export interface InputSource {
  /** 注册 canvas 事件与 window 兜底事件，返回解绑函数 */
  bindEvents(handlers: PointerHandlers): () => void

  /** 注册 preRender 回调 */
  onPreRender(cb: () => void): void
  removePreRender(): void

  /** 相机世界位置 */
  getCameraPosition(result?: Cartesian3): Cartesian3

  /** 相机完整快照，会话起始冻结用 */
  getCameraSnapshot(): CameraSnapshot

  /** 画布视口快照（CSS 尺寸 + DPR） */
  getViewport(): ViewportSnapshot

  /** 查询/设置是否允许摄像机交互（如原生鼠标缩放/旋转/平移） */
  getCameraEnabled(): boolean
  setCameraEnabled(enabled: boolean): void

  /** 单位距离在屏幕上占多少像素，用于 screenScale 与 pickPadding 换算 */
  getPixelScale(worldPosition: Cartesian3): number

  /** 世界坐标投影到 CSS 像素坐标。在相机背后或投影失败时返回 null */
  worldToWindow(worldPosition: Cartesian3, result?: Cartesian2): Cartesian2 | null

  /** overlay canvas 的挂载宿主 */
  getCanvas(): HTMLCanvasElement
}

/**
 * 归一化后的指针回调。适配层负责求射线，射线不可用时不派发事件，
 * 因此 EventManager 拿到的 PointerInput 一定是完整的。
 */
export interface PointerHandlers {
  onDown(input: PointerInput): void
  onMove(input: PointerInput): void
  onUp(input: PointerInput | null): void
  /** 输入序列被浏览器取消或意外丢失 pointer capture 时调用。 */
  onCancel(): void
  /** 相机或视口环境变化时调用。 */
  onEnvironmentChange?(): void
}
