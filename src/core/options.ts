import type { Matrix4 } from '@cesium/engine'

export interface OrbitControlOptions {
  gizmoPixelSize?: number
  pickPaddingPx?: number
  degenerateThreshold?: number
  translateSnap?: number
  scaleSnap?: number
  minScale?: number
  minRotateRadius?: number
  minScaleDenominator?: number
  axisLimit?: number
  planeLimit?: number
  showOverlay?: boolean
  onChange?: (modelMatrix: Matrix4) => void
}

export interface ResolvedOptions {
  /** gizmo 的目标屏幕像素尺寸 */
  readonly gizmoPixelSize: number

  /**
   * 拾取 mesh 相对渲染 mesh 加粗的像素数。
   *
   * 注意这是 build 时参数，不是求交时的容差 ——
   * 三角形求交没有自然的容差参数，细环靠加粗拾取 mesh 提高命中率。
   */
  readonly pickPaddingPx: number

  /** 法线与视线夹角的退化阈值，|dot| 低于此值视为退化，begin 返回 false */
  readonly degenerateThreshold: number

  /** 位移吸附步长，0 关闭。对累积位移取整，非每帧增量 */
  readonly translateSnap: number
  /** 缩放吸附步长，0 关闭。对累积比例取整 */
  readonly scaleSnap: number
  /** 各轴缩放下限，防塌缩 */
  readonly minScale: number
  /**
   * 缩放分母下限。退化视角下 startLocal[axis] 趋近 0 会让比例爆炸，
   * minScale 约束的是结果不是分母，不能替代此项
   */
  readonly minScaleDenominator: number
  /** 旋转起始交点到轴心的最小距离（局部单位），不足则本次拖拽不成立 */
  readonly minRotateRadius: number

  /** |dot(axis, toCamera)| 超过此值时轴投影退化成一个点，隐藏该轴 */
  readonly axisLimit: number
  /** |dot(planeNormal, toCamera)| 低于此值时平面接近侧视，隐藏该平面 */
  readonly planeLimit: number
  /** 是否绘制拖拽辅助层（连线、扇形、数值） */
  readonly showOverlay: boolean

  readonly onChange?: (modelMatrix: Matrix4) => void
}

const DEFAULTS: Omit<ResolvedOptions, 'onChange'> = {
  gizmoPixelSize: 80,
  pickPaddingPx: 8,
  degenerateThreshold: 0.15,
  translateSnap: 0,
  scaleSnap: 0,
  minScale: 0.01,
  minScaleDenominator: 1e-6,
  minRotateRadius: 0.15,
  axisLimit: 0.98,
  planeLimit: 0.2,
  showOverlay: true,
}

export function resolveOptions(options: OrbitControlOptions = {}): ResolvedOptions {
  return {
    gizmoPixelSize: options.gizmoPixelSize ?? DEFAULTS.gizmoPixelSize,
    pickPaddingPx: options.pickPaddingPx ?? DEFAULTS.pickPaddingPx,
    degenerateThreshold: options.degenerateThreshold ?? DEFAULTS.degenerateThreshold,
    translateSnap: options.translateSnap ?? DEFAULTS.translateSnap,
    scaleSnap: options.scaleSnap ?? DEFAULTS.scaleSnap,
    minScale: options.minScale ?? DEFAULTS.minScale,
    minScaleDenominator: options.minScaleDenominator ?? DEFAULTS.minScaleDenominator,
    minRotateRadius: options.minRotateRadius ?? DEFAULTS.minRotateRadius,
    axisLimit: options.axisLimit ?? DEFAULTS.axisLimit,
    planeLimit: options.planeLimit ?? DEFAULTS.planeLimit,
    showOverlay: options.showOverlay ?? DEFAULTS.showOverlay,
    onChange: options.onChange,
  }
}
