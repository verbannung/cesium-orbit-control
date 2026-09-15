import type { Cartesian3, Matrix4 } from '@cesium/engine'
import type { ControlSnapshot } from '../core/snapshots'

/**
 * Controller 私有的会话冻结数据。begin() 时产生，会话内不可变，

 */
export interface BaseInteractionDetail {
  /** 按下时冻结的模型中心，世界坐标。 */
  readonly startCenterPointWorld: Cartesian3
  /** 鼠标射线与拖拽平面的按下交点，世界坐标。 */
  readonly startPointWorld: Cartesian3
    // 平面中心点世界坐标
  readonly planeOriginWorld: Cartesian3
    //平面法向世界坐标
  readonly planeNormalWorld: Cartesian3
  readonly localToWorldAtStart: Matrix4
  readonly worldToLocalAtStart: Matrix4
  readonly startControl: ControlSnapshot
}

export interface TranslateDetail extends BaseInteractionDetail {
  readonly mode: 'translate'
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

export interface RotateDetail extends BaseInteractionDetail {
  readonly mode: 'rotate'
  readonly axisLocal: Cartesian3
  readonly axisWorld: Cartesian3
  readonly startDirectionLocal: Cartesian3
  readonly startDirectionWorld: Cartesian3
  readonly radiusWorld: number //旋转轴世界半径
  /** view 手柄：环恒定正对相机，且不画三维轴向引导。 */
  readonly viewAligned: boolean
}

export interface ScaleDetail extends BaseInteractionDetail {
  readonly mode: 'scale'
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

/** RotateController 内部的可变算法记忆，不发布。 */
export interface RotateRuntime {
  previousRawAngle: number
  completedTurns: number
}
