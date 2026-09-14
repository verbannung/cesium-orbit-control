import { Cartesian3, type Color } from '@cesium/engine'

export type Triple<T> = [T, T, T]

export const AXES: Triple<Cartesian3> = [
  Cartesian3.UNIT_X,
  Cartesian3.UNIT_Y,
  Cartesian3.UNIT_Z,
]

export type ControlMode = 'translate' | 'rotate' | 'scale'

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

/** Overlay 能看到的 Handle 信息：只有身份和颜色，没有 constraint。 */
//TODO 等待删除
export interface HandleVisualDescriptor {
  readonly id: HandleId
  readonly color: Color
}

/** Controller 能看到的完整 Handle 信息。 */
export interface HandleDescriptor {
  readonly id: HandleId
  readonly mode: ControlMode
  readonly constraint: ResolvedConstraint
    readonly color:Color
  readonly visual: HandleVisualDescriptor
}

/**
 * 纯渲染/拾取关注点：该 handle 的图元挂在哪个矩阵下。
 * 与 constraint 分离，避免绘制规则反向决定交互语义。
 */
export type HandleFrameKind = 'gizmo' | 'view' | 'axisFlip'
