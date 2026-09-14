import type { Camera, Matrix4, Scene } from '@cesium/engine'
import { CenterController } from './centerController'
import { resolveOptions, type OrbitControlOptions } from './core/options'
import type { ControlMode } from './core/types'
import { CesiumInputSource } from './input/cesiumInputSource'

export class OrbitControl {
  private readonly ctx: CenterController

  constructor(
    canvas: HTMLCanvasElement,
    scene: Scene,
    camera: Camera,
    options?: OrbitControlOptions,
  ) {
    const input = new CesiumInputSource(canvas, scene, camera)
    this.ctx = new CenterController(input, scene, resolveOptions(options))
  }

  /** modelMatrix 必须可分解为 T·R·S（无剪切、R 正交），否则抛错 */
  bind(modelMatrix: Matrix4, mode: ControlMode = 'translate'): void {
    this.ctx.bind(modelMatrix, mode)
  }

  setMode(mode: ControlMode): void {
    this.ctx.setMode(mode)
  }

  get currentMode(): ControlMode {
    return this.ctx.mode
  }

  destroy(): void {
    this.ctx.destroy()
  }
}

export { CenterController } from './centerController'
export type { OrbitControlOptions, ResolvedOptions } from './core/options'
export type { InputSource, PointerHandlers } from './core/ports'
export type { PointerInput, PointerModifiers } from './core/pointer'

export type {
  ControlMode,
  HandleDescriptor,
  HandleFrameKind,
  HandleId,
  HandleVisualDescriptor,
  ResolvedConstraint,
} from './core/types'

export type {
  CameraSnapshot,
  ControlSnapshot,
  ControlSnapshot,
  SessionContext,
  SessionId,
  SessionStartSnapshot,
  ViewportSnapshot,
  WorldPolygon,
  WorldPolyline,
  WorldSegment,
} from './core/snapshots'

export type {
  ControllerFrameContext,
  FrameEnvironment,
  GeometryFrameContext,
  OverlayFrameContext,
} from './core/frame'

export type {
  BaseTransformFrameState,
  RotateFrameState,
  RotateSpatialState,
  RotateTransformState,
  ScaleFrameState,
  ScaleSpatialState,
  ScaleTransformState,
  TransformFrameState,
  TranslateFrameState,
  TranslateGuideWorld,
  TranslateSpatialState,
  TranslateTransformState,
} from './core/state'

export type { Overlay } from './overlay/overlay'

/** @deprecated 使用 ControlMode。 */
export type Mode = ControlMode
