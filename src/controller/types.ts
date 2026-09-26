import type { Cartesian3, Matrix4, Quaternion } from '@cesium/engine'
import type { HandleDescriptor } from '../geometry/types'
import type { CameraSnapshot, PointerInput, ViewportSnapshot } from '../input/types'
import type { DragOverlayState } from '../overlay/types'
import type { ControllerFrameContext } from '../render/types'
import type { ControlMode } from '../types'

/**
 * Controller 模块协议：受控 TRS、会话冻结快照、拖拽会话端口与逐帧计算结果。
 * 本文件只允许出现类型，不得导出任何运行时值。
 */

/* ---------------------------------- TRS ---------------------------------- */

export interface ControlSnapshot {
  readonly translation: Cartesian3
  readonly rotation: Quaternion
  readonly scale: Cartesian3
}

export interface SessionStartSnapshot {
  readonly control: ControlSnapshot
  readonly camera: CameraSnapshot
  readonly viewport: ViewportSnapshot
}

/**
 * @deprecated 兼容保留的历史公开名。begin() 的输入已收敛为 ControllerInputParam，
 * begin 后锁定的计算结果由各 Controller 自己的会话上下文表达。
 */
export interface SessionContext {
  readonly mode: ControlMode
  readonly handle: HandleDescriptor
  readonly start: SessionStartSnapshot
}

/**
 * begin() 的统一输入参数。这些字段只是输入，不因参与初始化就成为会话状态。
 */
export interface ControllerInputParam {
  /** 开始拖拽时的首个 Pointer 输入。 */
  readonly input: PointerInput
  /** 开始拖拽时 Render 提供的 Controller 帧能力。 */
  readonly frame: ControllerFrameContext
  /** Geometry 拾取得到的外部输入参数。 */
  readonly handle: HandleDescriptor
  /** 开始拖拽时的 Control、Camera 与 Viewport 快照。 */
  readonly start: SessionStartSnapshot
}

/* ------------------------- 锁定的会话几何（共用） ------------------------- */

/**
 * begin 后三种模式共用的几何锁：平面、起始交点、起始终态矩阵。
 * SessionContext 与 DragDetailSeed 都建立在此之上。
 */
export interface SessionGeometryLock {
  /** 按下时冻结的模型中心，世界坐标。 */
  readonly startCenterPointWorld: Cartesian3
  /** 鼠标射线与拖拽平面的按下交点，世界坐标。 */
  readonly startPointWorld: Cartesian3
  /** 平面中心点，世界坐标。 */
  readonly planeOriginWorld: Cartesian3
  /** 平面法向，世界坐标。 */
  readonly planeNormalWorld: Cartesian3
  readonly localToWorldAtStart: Matrix4
  readonly worldToLocalAtStart: Matrix4
  readonly startControl: ControlSnapshot
}

/** begin() 阶段由 ControllerInputParam 解析出的、三种模式共用的锁定中间结果。 */
export interface DragDetailSeed extends SessionGeometryLock {
  readonly toCameraLocal: Cartesian3
  readonly planeNormalLocal: Cartesian3
}

/* ------------------------- 锁定的会话上下文（TSessionContext） ------------------------- */

/** begin 后锁定、整次拖拽期间不变的 Translate 计算结果。 */
export interface TranslateSessionContext extends SessionGeometryLock {
  readonly mode: 'translate'
  readonly handle: HandleDescriptor
  readonly constraint:
    | {
        readonly kind: 'axis'
        readonly axisLocal: Cartesian3
        readonly axisWorld: Cartesian3
      }
    | {
        readonly kind: 'plane'
        readonly normalLocal: Cartesian3
        readonly normalWorld: Cartesian3
      }
    | {
        readonly kind: 'view'
        readonly planeNormalWorld: Cartesian3
      }
}

/** begin 后锁定、整次拖拽期间不变的 Rotate 计算结果。 */
export interface RotateSessionContext extends SessionGeometryLock {
  readonly mode: 'rotate'
  readonly handle: HandleDescriptor
  readonly axisLocal: Cartesian3
  readonly axisWorld: Cartesian3
  readonly startDirectionLocal: Cartesian3
  readonly startDirectionWorld: Cartesian3
  /** 旋转轴世界半径。 */
  readonly radiusWorld: number
  /** view 手柄：环恒定正对相机，且不画三维轴向引导。 */
  readonly viewAligned: boolean
}

/** begin 后锁定、整次拖拽期间不变的 Scale 计算结果。 */
export interface ScaleSessionContext extends SessionGeometryLock {
  readonly mode: 'scale'
  readonly handle: HandleDescriptor
  readonly constraint:
    | {
        readonly kind: 'axis'
        /** 对应分量是否为本次缩放的自由轴。 */
        readonly isXAxis: boolean
        readonly isYAxis: boolean
        readonly isZAxis: boolean
        readonly axisLocal: Cartesian3
        readonly axisWorld: Cartesian3
        readonly startComponent: number
      }
    | {
        readonly kind: 'uniform'
        readonly startRadiusWorld: number
      }
}

/* ---------------------------- 跨帧演进结果（TDetail） ---------------------------- */

/**
 * 统一泛型槽位的当前空实现。只占位，不承担输入参数、锁定会话结果或每帧输出。
 */
export type EmptyDragDetail = Readonly<Record<never, never>>

/** Rotate 的跨帧角度结果：每次成功计算后产生新值，供下一帧解包使用。 */
export interface RotateDetail {
  readonly previousRawAngle: number
  readonly completedTurns: number
}

/* ----------------------- 逐帧中间结果（buildOverlay 前） ----------------------- */

/** Translate 单帧变换中间结果。 */
export interface TranslateTransformResult {
  readonly control: ControlSnapshot
  readonly pointerWorld: Cartesian3
}

/** Rotate 单帧变换中间结果。 */
export interface RotateTransformResult {
  /** 单圈显示角；扇形与标签用。 */
  readonly displayAngle: number
  readonly control: ControlSnapshot
  readonly pointerWorld: Cartesian3
  /** 本帧计算成功后供下一帧使用的角度连续性结果。 */
  readonly nextDetail: RotateDetail
}

/** Scale 单帧变换中间结果。 */
export interface ScaleTransformResult {
  readonly displayFactor: number
  readonly control: ControlSnapshot
  readonly pointerWorld: Cartesian3
}

/* --------------------------- 对外发布与会话端口 --------------------------- */

/** 一次成功的逐帧计算：对外发布的结果，以及供下一帧使用的跨帧结果。 */
export interface DragFrameOutcome<TDetail> {
  readonly result: DragComputeResult
  readonly detail: TDetail
}

/** 一次拖拽计算唯一跨越 Controller/RenderSystem 边界的结果。 */
export interface DragComputeResult {
  /** Geometry、宿主模型与下一帧控制计算使用的实际 TRS。 */
  readonly effectiveControl: ControlSnapshot
  /** Overlay 需要的已解析世界空间图元与显示语义。 */
  readonly overlay: DragOverlayState
}

/** EventManager 可持有的拖拽会话边界；具体模式细节不穿出会话。 */
export interface DragSessionPort {
  begin(param: ControllerInputParam): DragComputeResult | null
  compute(input: PointerInput, frame: ControllerFrameContext): DragComputeResult | null
  end(): void
  cancel(): void
}
