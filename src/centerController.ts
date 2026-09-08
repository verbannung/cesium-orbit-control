import { Matrix4, type Scene } from '@cesium/engine'
import { GizmoFrame } from './frame/gizmoFrame'
import { GeometryManager } from './geometry/geometryManager'
import { EventManager } from './event/eventManager'
import type { InputSource } from './core/ports'
import type { ResolvedOptions } from './core/options'
import type { Mode } from './geometry/types'
import { decompose, DECOMPOSE_ERROR } from './math/matrix'

export class CenterController {
  private readonly frame: GizmoFrame
  private readonly geometryManager: GeometryManager
  private readonly eventManager: EventManager
  private target: Matrix4 | null = null

  mode: Mode = 'translate'

  constructor(
    input: InputSource,
    scene: Scene,
    private readonly options: ResolvedOptions,
  ) {
    this.frame = new GizmoFrame(
      input,
      options,
      (m) => this.emitModelMatrix(m),
      () => this.geometryManager.updateMatrix(),
    )
    const frameContext = this.frame.getFrameContext()
    this.geometryManager = new GeometryManager(scene, frameContext)
    this.eventManager = new EventManager(input, frameContext, this.geometryManager, options)
    this.eventManager.init()
  }

  bind(modelMatrix: Matrix4, mode: Mode): void {
    if (!decompose(modelMatrix)) throw new Error(DECOMPOSE_ERROR)
    this.target = modelMatrix
    this.frame.init(modelMatrix)
    this.setMode(mode)
  }

  setMode(mode: Mode): void {
    this.mode = mode
    this.geometryManager.setMode(mode)
    this.eventManager.setMode(mode)
  }

  private emitModelMatrix(m: Matrix4): void {
    if (this.target) Matrix4.clone(m, this.target)
    this.options.onChange?.(m)
  }

  destroy(): void {
    this.eventManager.destroy()
    this.geometryManager.destroy()
    this.frame.destroy()
  }
}
