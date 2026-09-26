import { Cartesian3, Matrix4, Quaternion, type Scene } from '@cesium/engine'
import type { ResolvedOptions } from './types'
import type { InputSource } from './input/types'
import type { ControlSnapshot } from './controller/types'
import type { ControlMode } from './types'
import { EventManager } from './event/eventManager'
import { GeometryManager } from './geometry/geometryManager'
import { decompose, DECOMPOSE_ERROR } from './util/matrix'
import { OverlayManager } from './overlay/overlayManager'
import { RenderSystem } from './render/renderSystem'

/**
 * 组合根：创建并销毁各子系统，并保证模式切换时 Event / Geometry / Overlay
 * 使用同一个 ControlMode。不参与任何交互数学计算。
 */
export class CenterController {
  private readonly renderSystem: RenderSystem
  private readonly geometryManager: GeometryManager
  private readonly overlayManager: OverlayManager
  private readonly eventManager: EventManager
  private target: Matrix4 | null = null

  mode: ControlMode = 'translate'

  constructor(
    input: InputSource,
    scene: Scene,
    private readonly options: ResolvedOptions,
  ) {
    this.geometryManager = new GeometryManager(scene)
    this.overlayManager = new OverlayManager(input, options)
    this.renderSystem = new RenderSystem(input, options, {
      onGeometryFrame: (frame) => this.geometryManager.onFrame(frame),
      onOverlayFrame: (state) => this.overlayManager.onFrame(state),
      onModelMatrix: (matrix) => this.emitModelMatrix(matrix),
    })
    this.eventManager = new EventManager(
      input,
      this.renderSystem,
      this.geometryManager,
      this.overlayManager,
      options,
      this,
    )
    this.eventManager.init()
    this.geometryManager.changeMode(this.mode)
  }

  /** modelMatrix 必须可分解为 T·R·S（无剪切、R 正交），否则抛错 */
  bind(modelMatrix: Matrix4, mode: ControlMode): void {
    const decomposed = decompose(modelMatrix)
    if (!decomposed) throw new Error(DECOMPOSE_ERROR)

    this.target = modelMatrix
    const control: ControlSnapshot = {
      translation: Cartesian3.clone(decomposed.T, new Cartesian3()),
      rotation: Quaternion.fromRotationMatrix(decomposed.R, new Quaternion()),
      scale: Cartesian3.clone(decomposed.S, new Cartesian3()),
    }
    this.eventManager.changeMode()
    this.renderSystem.bind(control)
    this.setMode(mode)
  }

  setMode(mode: ControlMode): void {
    if (mode === this.mode) return

    this.eventManager.changeMode()
    this.mode = mode
    this.geometryManager.changeMode(mode)
    this.overlayManager.deactivate()
  }

  private emitModelMatrix(modelMatrix: Matrix4): void {
    if (this.target) Matrix4.clone(modelMatrix, this.target)
    // 对外只给拷贝：RenderSystem 内部那份每帧复用。
    this.options.onChange?.(Matrix4.clone(modelMatrix, new Matrix4()))
  }

  destroy(): void {
    this.eventManager.destroy()
    this.overlayManager.destroy()
    this.geometryManager.destroy()
    this.renderSystem.destroy()
    this.target = null
  }
}
