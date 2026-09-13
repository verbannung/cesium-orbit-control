import type { Cartesian2, Ray } from '@cesium/engine'

export interface PointerModifiers {
  readonly shift: boolean
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
}

/**
 * 输入适配层把 DOM/Cesium 事件归一化成 PointerInput，
 * Controller 因此不依赖 DOM Event，也不自己求射线。
 */
export interface PointerInput {
  readonly pointerId: number
  readonly screenPosition: Cartesian2
  readonly rayWorld: Ray
  readonly modifiers: PointerModifiers
  readonly timestamp: number
}

export const NO_MODIFIERS: PointerModifiers = {
  shift: false,
  alt: false,
  ctrl: false,
  meta: false,
}
