import type { Camera, Matrix4, Scene } from '@cesium/engine'
import { CenterController } from './centerController'
import { resolveOptions } from './options'
import type { ControlMode, OrbitControlOptions } from './types'
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
export type {
  CameraSnapshot,
  InputSource,
  OverlayInputSource,
  PointerHandlers,
  PointerInput,
  PointerModifiers,
  ViewportSnapshot,
} from './input/types'

export type {
  ControlMode,
  OrbitControlOptions,
  ResolvedOptions,
  WorldPolygon,
  WorldPolyline,
  WorldSegment,
} from './types'

export type {
  HandleDescriptor,
  HandleFrameKind,
  HandleId,
  ResolvedConstraint,
} from './geometry/types'

export type {
  ControlSnapshot,
  DragComputeResult,
  SessionContext,
  SessionStartSnapshot,
} from './controller/types'

export type {
  ControllerFrameContext,
  FrameEnvironment,
  GeometryFrameContext,
} from './render/types'

export type {
  DragOverlayState,
  Overlay,
  RotateOverlayState,
  ScaleOverlayState,
  TranslateOverlayState,
  TranslateGuideWorld,
} from './overlay/types'

/** @deprecated 使用 ControlMode。 */
export type Mode = ControlMode
