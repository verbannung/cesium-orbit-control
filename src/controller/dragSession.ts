import type { ControllerFrameContext } from '../core/frame'
import type { PointerInput } from '../core/pointer'
import type { SessionContext } from '../core/snapshots'
import type { DragComputeResult } from '../core/state'
import type { BaseInteractionDetail } from './details'


/** EventManager 可持有的拖拽会话边界；具体模式细节不穿出会话。 */
export interface DragSessionPort {
  begin(
    input: PointerInput,
    session: SessionContext,
    frame: ControllerFrameContext,
  ): DragComputeResult | null
  compute(input: PointerInput, frame: ControllerFrameContext): DragComputeResult | null
  end(): void
  cancel(): void
  readonly active: boolean
}

/**
 * 一次拖拽会话的生命周期持有者。
 *
 * 每个模式 Controller 在 computeFrame() 内完成自身三维计算，并仅在
 * control 与 overlay 都可得时返回 DragComputeResult。
 */
export abstract class DragSession<TDetail extends BaseInteractionDetail> implements DragSessionPort {
  protected detail: TDetail | null = null
  protected session: SessionContext | null = null

  begin(
    input: PointerInput,
    session: SessionContext,
    frame: ControllerFrameContext,
  ): DragComputeResult | null {
    this.reset()
    const detail = this.createDetail(input, session, frame)
    if (!detail) return null

    this.detail = detail
    this.session = session
    this.onBegin(detail)

    const state = this.produce(input, frame)
    if (!state) this.reset()
    return state
  }

  compute(input: PointerInput, frame: ControllerFrameContext): DragComputeResult | null {
    if (!this.detail || !this.session) return null
    return this.produce(input, frame)
  }

  end(): void {
    this.reset()
  }

  cancel(): void {
    this.reset()
  }

  get active(): boolean {
    return this.detail !== null
  }

  private produce(
    input: PointerInput,
    frame: ControllerFrameContext,
  ): DragComputeResult | null {
    const detail = this.detail
    const session = this.session
    if (!detail || !session) return null

    return this.computeFrame(input, detail, session, frame)
  }

  private reset(): void {
    this.detail = null
    this.session = null
    this.onReset()
  }

  /** 冻结会话数据。退化视角、无交点等情况返回 null，会话不成立。 */
  protected abstract createDetail(
    input: PointerInput,
    session: SessionContext,
    frame: ControllerFrameContext,
  ): TDetail | null

  /** 子类只在完整的 control 与 overlay 都可得时发布结果。 */
  protected abstract computeFrame(
    input: PointerInput,
    detail: TDetail,
    session: SessionContext,
    frame: ControllerFrameContext,
  ): DragComputeResult | null

  /** 供带有模式私有运行态的 Controller 初始化状态。 */
  protected onBegin(_detail: TDetail): void {}

  /** end、cancel 和失败 begin 都会调用。 */
  protected onReset(): void {}
}
