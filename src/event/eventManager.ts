import type { ResolvedOptions } from '../types'
import type { InputSource, PointerInput } from '../input/types'
import type { ControllerInputParam } from '../controller/types'
import type { ControlMode } from '../types'
import { RotateController } from '../controller/rotateController'
import { ScaleController } from '../controller/scaleController'
import { TranslateController } from '../controller/translateController'
import type { DragSessionPort } from '../controller/types'
import type { GeometryManager } from '../geometry/geometryManager'
import type { OverlayManager } from '../overlay/overlayManager'
import type { RenderSystem } from '../render/renderSystem'

/**
 * 把输入事件组织成 DragSession 的 begin / compute / end / cancel，并把
 * 单一 DragComputeResult 发布给 RenderSystem。
 *
 * 不计算角度、位移、缩放，也不生成 Overlay 图元；
 * 但负责与 Geometry 对称地 activate / deactivate Overlay 会话画笔。
 */
export class EventManager {
  private active: DragSessionPort | null = null
  private cameraEnabledBackup = true
  private unbind: (() => void) | null = null
  constructor(
    private readonly input: InputSource,
    private readonly render: RenderSystem,
    private readonly geometry: GeometryManager,
    private readonly overlay: OverlayManager,
    private readonly options: ResolvedOptions,
    private readonly modeProvider: Readonly<{ readonly mode: ControlMode }>,
  ) {}

  init(): void {
    this.unbind = this.input.bindEvents({
      onDown: (input) => this.onPointerDown(input),
      onMove: (input) => this.onPointerMove(input),
      onUp: () => this.onPointerUp(),
    })
  }

  changeMode(): void {
    if (this.active) this.cancel()
  }

  private onPointerDown(input: PointerInput): void {
    if (this.active) return
    const mode = this.modeProvider.mode
    const handle = this.geometry.pick(input.rayWorld)
    if (!handle) return

    const param: ControllerInputParam = {
      input,
      handle,
      start: this.render.captureSessionStart(),
      frame: this.render.createControllerFrame(),
    }

    const drag = createDragSession(mode, this.options)
    const result = drag.begin(param)
    if (!result) return

    this.active = drag
    this.render.publishInteraction(result)
    this.geometry.activate(handle)
    this.overlay.activate(mode)
    this.cameraEnabledBackup = this.input.getCameraEnabled()
    this.input.setCameraEnabled(false)
  }

  private onPointerMove(input: PointerInput): void {
    const active = this.active
    if (!active) {
      this.geometry.highlight(this.geometry.pick(input.rayWorld)?.id ?? null)
      return
    }

    const result = active.compute(input, this.render.createControllerFrame())
    if (!result) return
    this.render.publishInteraction(result)
  }

  private onPointerUp(): void {
    const active = this.active
    if (!active) return
    this.active = null

    this.render.commitInteraction()
    try {
      active.end()
    } finally {
      this.render.clearInteraction()
      this.teardown()
    }
  }

  /** cancel 不提交最新状态，恢复会话起始控制状态后走与 end 相同的清理。 */
  cancel(): void {
    const active = this.active
    if (!active) return
    this.active = null

    try {
      active.cancel()
    } finally {
      this.render.clearInteraction()
      this.teardown()
    }
  }

  private teardown(): void {
    this.input.setCameraEnabled(this.cameraEnabledBackup)
    this.geometry.deactivate()
    this.overlay.deactivate()
  }

  destroy(): void {
    try {
      this.cancel()
    } finally {
      this.unbind?.()
      this.unbind = null
    }
  }
}

function createDragSession(mode: ControlMode, options: ResolvedOptions): DragSessionPort {
  switch (mode) {
    case 'translate':
      return new TranslateController(options)
    case 'rotate':
      return new RotateController(options)
    case 'scale':
      return new ScaleController(options)
  }
}
