import type { Cartesian3 } from '@cesium/engine'
import type { ControllerFrameContext } from '../core/frame'
import type { PointerInput } from '../core/pointer'
import type { ControlSnapshot, SessionContext } from '../core/snapshots'
import type { BaseTransformFrameState, TransformFrameState } from '../core/state'
import type { BaseControllerRuntime, BaseInteractionDetail } from './details'

/** 一次成功计算的结果：实际应用的变换语义 + 生效 TRS + 本帧指针交点。 */
export interface TransformResult<TTransform> {
  readonly transform: TTransform
  readonly control: ControlSnapshot
  /** 本帧射线与冻结平面的交点，世界系。spatial 构造用。 */
  readonly pointerWorld: Cartesian3
}

/**
 * EventManager 看到的非泛型 Controller 接口：只关心会话编排，不关心模式细节。
 */
export interface SessionController {
  begin(
    input: PointerInput,
    session: SessionContext,
    frame: ControllerFrameContext,
  ): TransformFrameState | null
  compute(input: PointerInput, frame: ControllerFrameContext): TransformFrameState | null
  refreshSpatial(frame: ControllerFrameContext): TransformFrameState | null
  end(): void
  cancel(): void
  readonly active: boolean
}

/**
 * 一次拖拽会话中全部三维计算的持有者。
 *
 * 时序保证（架构 7.1）：先算出 transform，再算出 world spatial，
 * 最后一次性构造完整 TransformFrameState，不存在半发布状态。
 */
export abstract class InteractionController<
  TDetail extends BaseInteractionDetail,
  TRuntime extends BaseControllerRuntime,
  TTransform,
  TSpatial,
  TState extends TransformFrameState,
> {
  protected detail: TDetail | null = null
  protected runtime: TRuntime | null = null
  protected session: SessionContext | null = null

  /** 最近一次成功结果，refreshSpatial 据此重建世界图元而不重新解释输入。 */
  private lastResult: TransformResult<TTransform> | null = null

  begin(
    input: PointerInput,
    session: SessionContext,
    frame: ControllerFrameContext,
  ): TState | null {
    this.reset()
    const detail = this.createDetail(input, session, frame)
    if (!detail) return null

    this.detail = detail
    this.runtime = this.createRuntime(detail)
    this.session = session

    const state = this.produce(input, frame)
    if (!state) this.reset()
    return state
  }

  compute(input: PointerInput, frame: ControllerFrameContext): TState | null {
    if (!this.detail || !this.runtime || !this.session) return null
    return this.produce(input, frame)
  }

  /** 环境（viewport / DPR / 相机）变化后重建世界图元，不重新解释指针。 */
  refreshSpatial(frame: ControllerFrameContext): TState | null {
    const detail = this.detail
    const runtime = this.runtime
    const session = this.session
    const result = this.lastResult
    if (!detail || !runtime || !session || !result) return null

    const spatial = this.buildWorldSpatialState(result, detail, frame)
    return this.assemble(session, runtime, result, spatial)
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
  ): TState | null {
    const detail = this.detail
    const runtime = this.runtime
    const session = this.session
    if (!detail || !runtime || !session) return null

    // 失败时返回 null：不推进 runtime，不发布部分结果（架构不变量 7）。
    const result = this.computeTransform(input, detail, runtime, frame)
    if (!result) return null

    this.lastResult = result
    const spatial = this.buildWorldSpatialState(result, detail, frame)
    return this.assemble(session, runtime, result, spatial)
  }

  private assemble(
    session: SessionContext,
    runtime: TRuntime,
    result: TransformResult<TTransform>,
    spatial: TSpatial,
  ): TState {
    const base: BaseTransformFrameState = {
      sessionId: session.id,
      revision: runtime.revision++,
      handle: session.handle.visual,
      effectiveControl: result.control,
    }
    return this.createFrameState(base, result.transform, spatial)
  }

  private reset(): void {
    this.detail = null
    this.runtime = null
    this.session = null
    this.lastResult = null
  }

  /** 冻结会话数据。退化视角、无交点等情况返回 null，会话不成立。 */
  protected abstract createDetail(
    input: PointerInput,
    session: SessionContext,
    frame: ControllerFrameContext,
  ): TDetail | null

  protected abstract createRuntime(detail: TDetail): TRuntime

  protected abstract computeTransform(
    input: PointerInput,
    detail: TDetail,
    runtime: TRuntime,
    frame: ControllerFrameContext,
  ): TransformResult<TTransform> | null

  /** 用同一次计算结果生成 Overlay 所需的世界空间图元。 */
  protected abstract buildWorldSpatialState(
    result: TransformResult<TTransform>,
    detail: TDetail,
    frame: ControllerFrameContext,
  ): TSpatial

  protected abstract createFrameState(
    base: BaseTransformFrameState,
    transform: TTransform,
    spatial: TSpatial,
  ): TState
}
