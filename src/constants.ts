import { Cartesian3 } from '@cesium/engine'
import type { Triple } from './types'

/**
 * 包根运行时常量：仅收口真正被多个模块共享的系统规格。
 * 仅被单一模块使用的尺寸常量保持模块私有（见 geometry/geometryUtil.ts）。
 */

export const AXES: Triple<Cartesian3> = [
  Cartesian3.UNIT_X,
  Cartesian3.UNIT_Y,
  Cartesian3.UNIT_Z,
]

/** 旋转/缩放环半径，Geometry 负责绘制，Controller 依据同一半径换算拖拽半径。 */
export const RING_RADIUS = 1.0

/** 视轴环半径，Geometry 与 Controller 共享。 */
export const VIEW_AXIS_RADIUS = 0.22
