import { Matrix4 } from '@cesium/engine'
import { cloneControl, identityControl } from '../controller/controllerUtil'
import type {
  ControllerFrameContext,
  FrameEnvironment,
  GeometryFrameContext,
  RenderSystemSinks,
} from './types'
import type { CameraSnapshot, InputSource } from '../input/types'
import type {
  ControlSnapshot,
  DragComputeResult,
  SessionStartSnapshot,
} from '../controller/types'
import type { ResolvedOptions } from '../types'
import { GizmoFrame } from './gizmoFrame'
import { composeTRS } from '../util/matrix'

/*
提交与拖动当前值的缓冲带、
TODO 为undo redo 作为准备
 */
export class RenderSystem {
  private readonly gizmoFrame: GizmoFrame
  private committedControl: ControlSnapshot = identityControl()
  /** 最新一次拖拽计算结果；在 preRender 中作为唯一分发来源。 */
  private pendingResult: DragComputeResult | null = null
  private isBind = false //是否绑定了外部模型

  private readonly modelMatrix = new Matrix4()

  constructor(
    private readonly input: InputSource,
    options: ResolvedOptions,
    private readonly sinks: RenderSystemSinks,
  ) {
    this.gizmoFrame = new GizmoFrame(input, options)
  }

  /** 用外部 modelMatrix 分解出的 TRS 作为初始已提交状态，并接上渲染循环。 */
  bind(control: ControlSnapshot): void {
    this.committedControl = cloneControl(control)
    if (this.isBind) return
    this.isBind = true
    this.input.onPreRender(() => this.render())
  }




  /** 会话起始的不可变冻结快照。 */
  captureSessionStart(): SessionStartSnapshot {
    return {
      control: cloneControl(this.committedControl),
      camera: this.input.getCameraSnapshot(),
      viewport: this.input.getViewport(),
    }
  }


  publishInteraction(result: DragComputeResult): void {
    this.pendingResult = result
  }

  /** 把最新生效状态提交为已提交状态。 */
  commitInteraction(): void {
    const result = this.pendingResult
    if (!result) return
    this.committedControl = cloneControl(result.effectiveControl)
  }

  /** 丢弃未提交状态（end 清理与 cancel 都走这里）。 */
  clearInteraction(): void {
    if (!this.pendingResult) return
    this.pendingResult = null
  }

  render(): void {
    this.cachedCameraSnapshot = null

    const effectiveControl = this.pendingResult?.effectiveControl ?? this.committedControl
    const dragging = this.pendingResult !== null

    this.gizmoFrame.update(effectiveControl, dragging)

    this.sinks.onGeometryFrame(this.createGeometryFrame(effectiveControl))
    this.sinks.onOverlayFrame(this.pendingResult?.overlay ?? null)
    this.emitModelMatrix(effectiveControl)
  }

  createControllerFrame(): ControllerFrameContext {
    const gizmo = this.gizmoFrame
    const gizmoMatrix = Matrix4.clone(gizmo.gizmoMatrix, new Matrix4())
    return {
      environment: this.createEnvironment(),
      gizmoMatrix,
      viewMatrix: Matrix4.clone(gizmo.viewMatrix, new Matrix4()),
      axisFlipMatrix: Matrix4.clone(gizmo.axisFlipMatrix, new Matrix4()),
    }
  }

  private createGeometryFrame(effectiveControl: ControlSnapshot): GeometryFrameContext {
    const gizmo = this.gizmoFrame
    return {
      environment: this.createEnvironment(),
      effectiveControl,
      gizmoMatrix: gizmo.gizmoMatrix,
      viewMatrix: gizmo.viewMatrix,
      axisFlipMatrix: gizmo.axisFlipMatrix,
    }
  }

  private createEnvironment(): FrameEnvironment {
    return {
      camera: this.cachedCamera(),
      viewport: this.input.getViewport(),
      pixelScale: this.gizmoFrame.pixelScale,
    }
  }

  private cachedCameraSnapshot: CameraSnapshot | null = null

  /** 同一帧内多个切片共用一份相机快照，避免重复克隆矩阵。 */
  private cachedCamera(): CameraSnapshot {
    return (this.cachedCameraSnapshot ??= this.input.getCameraSnapshot())
  }

  private emitModelMatrix(control: ControlSnapshot): void {
    composeTRS(control.translation, control.rotation, control.scale, this.modelMatrix)

    this.sinks.onModelMatrix(this.modelMatrix)
  }

  destroy(): void {
    this.input.removePreRender()
    this.pendingResult = null
    this.cachedCameraSnapshot = null
    this.isBind = false
  }
}
