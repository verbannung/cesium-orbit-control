import type { Cartesian3, Matrix4 } from '@cesium/engine'
import type { ControlSnapshot } from '../core/snapshots'

/**
 * Controller 私有的会话冻结数据。begin() 时产生，会话内不可变，
 * 永远不向 Overlay 暴露（架构不变量 3）。
 */
export interface BaseInteractionDetail {
  readonly startPointWorld: Cartesian3
  readonly planeOriginWorld: Cartesian3
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
  readonly radiusWorld: number
  /** view 手柄：环恒定正对相机，且不画三维轴向引导。 */
  readonly viewAligned: boolean
}

export interface ScaleDetail extends BaseInteractionDetail {
  readonly mode: 'scale'
  readonly constraint:
    | {
        readonly kind: 'axis'
        readonly axisIndex: 0 | 1 | 2
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
