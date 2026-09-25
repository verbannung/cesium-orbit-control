import type { Cartesian3 } from '@cesium/engine'
import type { OverlayInputSource } from '../input/types'
import type { WorldPolygon, WorldPolyline, WorldSegment } from '../types'

/**
 * Overlay 模块协议：屏幕空间渲染器接口与 Controller 已解析的绘制状态。
 * 本文件只允许出现类型，不得导出任何运行时值。
 */

/**
 * 屏幕空间渲染器。只消费 Controller 已解析的世界图元与受限投影能力。
 *
 * Overlay 不得：读取局部基重新推导轴或平面、求 Gizmo 矩阵的逆、
 * 做局部/世界转换、重新生成旋转圆弧、按起终点反推角度/位移/缩放比例。
 */
export interface Overlay<TState extends DragOverlayState = DragOverlayState> {
  render(input: OverlayInputSource, state: TState): void
}

/* ------------------------------- translate ------------------------------- */

export type TranslateGuideWorld =
  | {
      readonly kind: 'axis'
      readonly line: WorldSegment
    }
  | {
      readonly kind: 'plane'
      readonly polygon: WorldPolygon
    }
  | {
      readonly kind: 'view'
      readonly ring: WorldPolyline
      readonly movementArrow: WorldSegment
    }

/** 平移拖拽的纯绘制载荷；字段与画笔消费同级，无 mode / transform / spatial 包层。 */
export interface TranslateOverlayState {
  readonly color: string
  /** 标签显示的世界平移结果（即当前生效 T）。 */
  readonly displayTranslation: Cartesian3
  readonly guide: TranslateGuideWorld
  readonly labelAnchorWorld: Cartesian3
}

/* -------------------------------- rotate --------------------------------- */

/** 旋转拖拽的纯绘制载荷。 */
export interface RotateOverlayState {
  readonly color: string
  /** 单圈显示角（弧度），扇形与标签共用。 */
  readonly displayAngle: number
  readonly ringWorld: WorldPolyline
  readonly sectorWorld: WorldPolygon
  readonly axisGuideWorld: WorldSegment | null
  readonly normalGuideWorld: WorldSegment | null
  readonly labelAnchorWorld: Cartesian3
}

/* --------------------------------- scale --------------------------------- */

/** 缩放拖拽的纯绘制载荷。 */
export interface ScaleOverlayState {
  readonly color: string
  /** Controller 已选定的倍率读数。 */
  readonly displayFactor: number
  readonly axisGuideWorld: WorldSegment | null
  readonly movementArrowWorld: WorldSegment | null
  readonly labelAnchorWorld: Cartesian3
}

export type DragOverlayState =
  | TranslateOverlayState
  | RotateOverlayState
  | ScaleOverlayState
