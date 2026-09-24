import type { Cartesian2, Cartesian3, Matrix4, Ray } from '@cesium/engine'

/**
 * Input 模块协议：归一化指针输入、相机/视口快照与唯一的 Cesium 适配面。
 * 本文件只允许出现类型，不得导出任何运行时值。
 */

export interface PointerModifiers {
  readonly shift: boolean
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
}

/**
 * 输入适配层把 DOM/Cesium 事件归一化成 PointerInput，
 * Controller 因此不依赖 DOM Event，也不自己求射线。
 */
export interface PointerInput {
  readonly pointerId: number
  readonly screenPosition: Cartesian2
  readonly rayWorld: Ray
  readonly modifiers: PointerModifiers
  readonly timestamp: number
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

/**
 * Overlay 所需的最小输入适配面，只暴露挂载、视口与世界坐标投影能力。
 * OverlayManager 依赖该接口，不能访问事件、相机快照或相机控制能力。
 */
export interface OverlayInputSource {
  /** 画布视口快照（CSS 尺寸 + DPR） */
  getViewport(): ViewportSnapshot

  /** 世界坐标投影到 CSS 像素坐标。在相机背后或投影失败时返回 null */
  worldToWindow(worldPosition: Cartesian3, result?: Cartesian2): Cartesian2 | null

  /** overlay canvas 的挂载宿主 */
  getCanvas(): HTMLCanvasElement
}

/**
 * 完整的 Cesium 输入适配面。EventManager / RenderSystem 依赖它，不依赖 Scene/Camera。
 * CesiumInputSource 同时实现 OverlayInputSource，组合根可按消费者所需能力注入。
 */
export interface InputSource extends OverlayInputSource {
  /** 注册 canvas 事件，返回解绑函数 */
  bindEvents(handlers: PointerHandlers): () => void

  /** 注册 preRender 回调 */
  onPreRender(cb: () => void): void
  removePreRender(): void

  /** 相机世界位置 */
  getCameraPosition(result?: Cartesian3): Cartesian3

  /** 相机完整快照，会话起始冻结用 */
  getCameraSnapshot(): CameraSnapshot

  /** 查询/设置是否允许摄像机交互（如原生鼠标缩放/旋转/平移） */
  getCameraEnabled(): boolean
  setCameraEnabled(enabled: boolean): void

  /** 单位距离在屏幕上占多少像素，用于 screenScale 与 pickPadding 换算 */
  getPixelScale(worldPosition: Cartesian3): number
}

/**
 * 归一化后的指针回调。适配层负责求射线，射线不可用时不派发事件，
 * 因此 EventManager 拿到的 PointerInput 一定是完整的。
 */
export interface PointerHandlers {
  onDown(input: PointerInput): void
  onMove(input: PointerInput): void
  onUp(input: PointerInput | null): void
}
