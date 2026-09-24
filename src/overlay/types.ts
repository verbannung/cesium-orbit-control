import type { Cartesian3, Quaternion } from '@cesium/engine'
import type { HandleDescriptor } from '../geometry/types'
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

/**
 * @deprecated 兼容保留的历史公开名，不参与任何在用状态的继承链。
 * Overlay 绘制状态现由 Translate/Rotate/Scale 各自完整声明。
 */
export interface BaseDragOverlayState {
  readonly handle: HandleDescriptor
}

/** 当前在用的共享绘制字段，D-006 会逐项收敛为各状态自有的最终绘制数据。 */
interface ActiveDragOverlayStateBase {
  readonly handle: HandleDescriptor
}

/* ------------------------------- translate ------------------------------- */

export interface TranslateTransformState {
  /** 约束和吸附之前的局部位移。 */
  readonly rawDeltaLocal: Cartesian3
  /** 约束和吸附之后的局部位移。 */
  readonly appliedDeltaLocal: Cartesian3
  /** 最终应用的世界空间位移。 */
  readonly appliedDeltaWorld: Cartesian3
  readonly resultingTranslation: Cartesian3
}

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

export interface TranslateSpatialState {
  readonly startPointWorld: Cartesian3
  readonly currentPointWorld: Cartesian3
  readonly guide: TranslateGuideWorld
  readonly labelAnchorWorld: Cartesian3
}

export interface TranslateOverlayState extends ActiveDragOverlayStateBase {
  readonly mode: 'translate'
  readonly transform: TranslateTransformState
  readonly spatial: TranslateSpatialState
}

/* -------------------------------- rotate --------------------------------- */

export interface RotateTransformState {
  /** atan2 得到的单圈角度，∈ (−π, π]。 */
  readonly rawAngle: number
  /** 解包后的累计角度，可以超过 ±2π。 */
  readonly accumulatedAngle: number
  /** 明确交给 Overlay 显示的角度。 */
  readonly displayAngle: number
  readonly axisWorld: Cartesian3
  readonly deltaRotation: Quaternion
  readonly resultingRotation: Quaternion
}

export interface RotateSpatialState {
  readonly centerWorld: Cartesian3
  readonly startPointWorld: Cartesian3
  readonly currentPointWorld: Cartesian3
  /** Controller 已生成的世界坐标圆环点。 */
  readonly ringWorld: WorldPolyline
  /** center + arc boundary 构成的世界坐标扇区。 */
  readonly sectorWorld: WorldPolygon
  readonly axisGuideWorld: WorldSegment | null
  readonly normalGuideWorld: WorldSegment | null
  readonly labelAnchorWorld: Cartesian3
}

export interface RotateOverlayState extends ActiveDragOverlayStateBase {
  readonly mode: 'rotate'
  readonly transform: RotateTransformState
  readonly spatial: RotateSpatialState
}

/* --------------------------------- scale --------------------------------- */

export interface ScaleTransformState {
  /** 指针几何直接求出的原始比例。 */
  readonly rawRatio: number
  /** 经过 snap 后的比例。 */
  readonly snappedRatio: number
  /**
   * 经过 minScale 等限制后实际施加到三个轴的比例。
   * uniform=true 时，发生逐轴 clamp 后也可能不完全相等。
   */
  readonly appliedFactor: Cartesian3
  readonly resultingScale: Cartesian3
  readonly uniform: boolean
}

export interface ScaleSpatialState {
  readonly startPointWorld: Cartesian3
  readonly currentPointWorld: Cartesian3
  readonly axisGuideWorld: WorldSegment | null
  readonly movementArrowWorld: WorldSegment | null
  readonly labelAnchorWorld: Cartesian3
}

export interface ScaleOverlayState extends ActiveDragOverlayStateBase {
  readonly mode: 'scale'
  readonly transform: ScaleTransformState
  readonly spatial: ScaleSpatialState
}

export type DragOverlayState =
  | TranslateOverlayState
  | RotateOverlayState
  | ScaleOverlayState
