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

/** rotate-view 环半径。比轴环稍大，形成层次。 */
export const OUTER_VIEW_AXIS_RADIUS = 1.2

/** rotate XYZ 轴环半径。Geometry 绘制，Controller 按同一半径换算 overlay。 */
export const OUTER_AXIS_RADIUS = 1.0

/** 平移/缩放视平面环半径。Geometry 与默认 buildViewRing 共享。 */
export const INNER_VIEW_AXIS_RADIUS = 0.22
