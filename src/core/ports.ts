import type { Cartesian2, Cartesian3, Matrix4, Ray } from '@cesium/engine'

/** 唯一的 Cesium 适配面。EventManager 与 GizmoFrame 依赖它，不依赖 Scene/Camera
 * 该接口只暴露输入、相机以及像素投影等“输入源”能力。具体实现见 cesiumInputSource.ts
 */
export interface InputSource {
  /** 注册 canvas 事件与 window 兜底事件，返回解绑函数 */
  bindEvents(handlers: PointerHandlers): () => void

  /** 注册 preRender 回调，返回解绑函数 */
  onPreRender(cb: () => void): void
  removePreRender(): void

  /** 获取屏幕像素点的射线。如果失败应返回 null */
  getPickRay(screenPos: Cartesian2, result?: Ray): Ray | null

  /** 获取相机世界位置 */
  getCameraPosition(result?: Cartesian3): Cartesian3

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

export interface PointerHandlers {
  onDown(screenPos: Cartesian2): void
  onMove(screenPos: Cartesian2): void
  onUp(): void
}
