import type { Cartesian3, Color } from '@cesium/engine'
import type { ControlMode } from '../types'

/**
 * Geometry 模块协议：手柄标识、交互约束、手柄描述与网格数据。
 * 本文件只允许出现类型，不得导出任何运行时值；
 * Handle 运行时类见 geometry/handle.ts。
 */

/** 每个轴/手柄唯一标识 */
export type HandleId =
  | 'translate-x'
  | 'translate-y'
  | 'translate-z'
  | 'translate-xy'
  | 'translate-yz'
  | 'translate-zx'
  | 'translate-view'
  | 'rotate-x'
  | 'rotate-y'
  | 'rotate-z'
  | 'rotate-view'
  | 'scale-x'
  | 'scale-y'
  | 'scale-z'
  | 'scale-uniform'


/**
 * 约束
 */
export type ResolvedConstraint =
  | {
      readonly kind: 'axis'
      /** 单位向量。translate/scale 为自由轴，rotate 为旋转轴。 */
      readonly axisLocal: Cartesian3
    }
  | {
      readonly kind: 'plane'
      /** 单位向量，面法线（零自由度方向）。 */
      readonly normalLocal: Cartesian3
    }
  | {
      readonly kind: 'view'
    }
  | {
      readonly kind: 'uniform'
    }

/** Controller 能看到的完整 Handle 信息。 */
export interface HandleDescriptor {
  readonly id: HandleId
  readonly mode: ControlMode
  readonly constraint: ResolvedConstraint
  readonly color: Color
}

/**
 * 纯渲染/拾取关注点：该 handle 的图元挂在哪个矩阵下。
 * 与 constraint 分离，避免绘制规则反向决定交互语义。
 */
export type HandleFrameKind = 'gizmo' | 'view' | 'axisFlip'

export interface MeshData {
  positions: Cartesian3[]
  indices: Uint32Array
  boundingRadius: number
}
