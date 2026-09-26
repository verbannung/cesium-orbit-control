import type { ControllerFrameContext } from '../render/types'
import type { PointerInput } from '../input/types'
import type {
  ControllerInputParam,
  DragComputeResult,
  DragFrameOutcome,
  DragSessionPort,
} from './types'


/**
 * 一次拖拽会话的生命周期持有者。
 *
 * begin() 从 ControllerInputParam 解析出整次拖拽锁定不变的 TSessionContext
 * 与初始跨帧结果 TDetail；每帧 computeFrame() 读取锁定上下文与当前 TDetail，
 * 并仅在 control 与 overlay 都可得时返回下一帧 TDetail 与 DragComputeResult。
 *
 * 计算失败不推进 TDetail：失败的 begin 重置全部状态，失败的 compute 只返回 null。
 */
export abstract class DragSession<TSessionContext, TDetail> implements DragSessionPort {
  protected context: TSessionContext | null = null
  protected detail: TDetail | null = null

  begin(param: ControllerInputParam): DragComputeResult | null {
    this.reset()
    const context = this.createSessionContext(param)
    if (!context) return null

    this.context = context
    this.detail = this.createInitialDetail(context)

    const state = this.produce(param.input, param.frame)
    if (!state) this.reset()
    return state
  }

  compute(input: PointerInput, frame: ControllerFrameContext): DragComputeResult | null {
    if (!this.context || !this.detail) return null
    return this.produce(input, frame)
  }

  end(): void {
    this.reset()
  }

  cancel(): void {
    this.reset()
  }

  private produce(
    input: PointerInput,
    frame: ControllerFrameContext,
  ): DragComputeResult | null {
    const context = this.context
    const detail = this.detail
    if (!context || !detail) return null

    const outcome = this.computeFrame(input, context, detail, frame)
    if (!outcome) return null

    // 只有成功计算才推进跨帧结果。
    this.detail = outcome.detail
    return outcome.result
  }

  private reset(): void {
    this.context = null
    this.detail = null
  }

  /** 冻结会话数据。退化视角、无交点等情况返回 null，会话不成立。 */
  protected abstract createSessionContext(param: ControllerInputParam): TSessionContext | null

  /** begin 成功后的初始跨帧结果。 */
  protected abstract createInitialDetail(context: TSessionContext): TDetail

  /** 子类只在完整的 control 与 overlay 都可得时发布结果与下一帧跨帧结果。 */
  protected abstract computeFrame(
    input: PointerInput,
    context: TSessionContext,
    detail: TDetail,
    frame: ControllerFrameContext,
  ): DragFrameOutcome<TDetail> | null
}
