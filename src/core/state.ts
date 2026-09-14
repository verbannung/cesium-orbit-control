import type { Cartesian3, Quaternion } from '@cesium/engine'
import type {
  ControlSnapshot,
  WorldPolygon,
  WorldPolyline,
  WorldSegment,
} from './snapshots'
import type { HandleDescriptor } from './types'

/** Controller 已完成语义计算、专供 Overlay 绘制的当前拖拽数据。 */
export interface BaseDragOverlayState {
  readonly handle: HandleDescriptor
}

/** 一次拖拽计算唯一跨越 Controller/RenderSystem 边界的结果。 */
export interface DragComputeResult {
  /** Geometry、宿主模型与下一帧控制计算使用的实际 TRS。 */
  readonly effectiveControl: ControlSnapshot
  /** Overlay 需要的已解析世界空间图元与显示语义。 */
  readonly overlay: DragOverlayState
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

export interface TranslateOverlayState extends BaseDragOverlayState {
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

export interface RotateOverlayState extends BaseDragOverlayState {
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

export interface ScaleOverlayState extends BaseDragOverlayState {
  readonly mode: 'scale'
  readonly transform: ScaleTransformState
  readonly spatial: ScaleSpatialState
}

export type DragOverlayState =
  | TranslateOverlayState
  | RotateOverlayState
  | ScaleOverlayState
