import type { ResolvedOptions } from '../core/options'
import type { PointerInput } from '../core/pointer'
import type { InputSource } from '../core/ports'
import type { SessionContext } from '../core/snapshots'
import type { TransformFrameState } from '../core/state'
import type { ControlMode } from '../core/types'
import { RotateController } from '../controller/rotateController'
import { ScaleController } from '../controller/scaleController'
import { TranslateController } from '../controller/translateController'
import type { SessionController } from '../controller/interactionController'
import type { GeometryManager } from '../geometry/geometryManager'
import type { RenderSystem } from '../render/renderSystem'

/**
 * 一次拖拽的全部活动状态。把 controller / session / handle 合成一个对象，
 * 避免多个 nullable 字段组合出非法状态（架构 3.1）。
 */
interface ActiveInteraction {
  readonly session: SessionContext
  readonly controller: SessionController
  latestState: TransformFrameState | null
}

/**
 * 把输入事件组织成 begin / compute / end / cancel 会话，并把 Controller
 * 产生的不可变状态原子发布给 RenderSystem。
 *
 * EventManager 不计算角度、位移、缩放，也不生成 Overlay 图元。
 */
export class EventManager {
  private controller: SessionController
  private active: ActiveInteraction | null = null //移动点击轴被激活
  private lastInput: PointerInput | null = null
  private cameraEnabledBackup = true
  private unbind: (() => void) | null = null
  private sessionCounter = 0
  private mode: ControlMode = 'translate'

  constructor(
    private readonly input: InputSource,
    private readonly render: RenderSystem,
    private readonly geometry: GeometryManager,
    private readonly options: ResolvedOptions,
  ) {
    this.controller = createController(this.mode, options)
  }

  init(): void {
    this.unbind = this.input.bindEvents({
      onDown: (input) => this.onPointerDown(input),
      onMove: (input) => this.onPointerMove(input),
      onUp: () => this.onPointerUp(),
      onCancel: () => this.cancel(),
    })
  }

  setMode(mode: ControlMode): void {
    if (this.active) this.cancel()
    this.mode = mode
    this.controller = createController(mode, this.options)
  }

  private onPointerDown(input: PointerInput): void {
    if (this.active) return
    this.lastInput = input

    const handle = this.geometry.pick(input.rayWorld)
    if (!handle) return

    const session: SessionContext = {
        //TODO 是否需要引用计数
      id: `session-${++this.sessionCounter}`,
      mode: this.mode,
      handle,
      start: this.render.captureSessionStart(),
    }

    const frame = this.render.createControllerFrame()
    const state = this.controller.begin(input, session, frame)
    if (!state) return

    this.active = {
      session,
      controller: this.controller,
      latestState: state,
    }

    this.render.publishInteraction(state)
    this.geometry.activate(handle)
    this.cameraEnabledBackup = this.input.getCameraEnabled()
    this.input.setCameraEnabled(false)
  }

  private onPointerMove(input: PointerInput): void {
    this.lastInput = input
    const active = this.active
    if (!active) {
      this.geometry.highlight(this.geometry.pick(input.rayWorld)?.id ?? null)
      return
    }

    const state = active.controller.compute(input, this.render.createControllerFrame())
    if (!state) return
    active.latestState = state
    this.render.publishInteraction(state)
  }

  private onPointerUp(): void {
    const active = this.active
    if (!active) return
    this.active = null

    this.render.commitInteraction()
    try {
      active.controller.end()
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
      active.controller.cancel()
    } finally {
      this.render.clearInteraction()
      this.teardown()
    }
  }

  /**
   * 环境（viewport / DPR / 外部相机变更）变化时重建世界图元。
   * 由 RenderSystem 在分发帧切片之前调用，保证本帧各消费者版本一致。
   */
  syncEnvironment(): void {
    const active = this.active
    if (!active) return

    const frame = this.render.createControllerFrame()
    // 优先只重建 spatial；若会话尚无成功结果，则用保留的 lastInput 重算一帧。
    const state =
      active.controller.refreshSpatial(frame) ??
      (this.lastInput ? active.controller.compute(this.lastInput, frame) : null)
    if (!state) return
    active.latestState = state
    this.render.publishInteraction(state)
  }

  private teardown(): void {
    this.input.setCameraEnabled(this.cameraEnabledBackup)
    this.geometry.deactivate()
  }

  destroy(): void {
    try {
      this.cancel()
    } finally {
      this.unbind?.()
      this.unbind = null
      this.lastInput = null
    }
  }
}

function createController(mode: ControlMode, options: ResolvedOptions): SessionController {
  switch (mode) {
    case 'translate':
      return new TranslateController(options)
    case 'rotate':
      return new RotateController(options)
    case 'scale':
      return new ScaleController(options)
  }
}
