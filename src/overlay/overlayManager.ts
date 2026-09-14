import type { OverlayFrameContext } from '../core/frame'
import type { ResolvedOptions } from '../core/options'
import type { InputSource } from '../core/ports'
import type { DragOverlayState } from '../core/state'
import type { ControlMode } from '../core/types'
import type { Overlay } from './overlay'
import { RotateOverlay } from './rotateOverlay'
import { ScaleOverlay } from './scaleOverlay'
import { TranslateOverlay } from './translateOverlay'

const OVERLAY_CLASS_NAME = 'cesium-orbit-control-overlay'

/**
 * 持有唯一的临时 Canvas 图层，并按 DragOverlayState.mode 把状态路由给具体 Overlay。
 * 类型通过 mode 判别收窄，不使用断言（架构 6.7）。
 */
export class OverlayManager {
  readonly overlayCanvas: HTMLCanvasElement

  private readonly sourceCanvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private readonly translate: TranslateOverlay
  private readonly rotate: RotateOverlay
  private readonly scale: ScaleOverlay

  private mode: ControlMode = 'translate'
  private pixelRatio = 1
  private disposed = false
  private positionedHost: HTMLElement | null = null
  private originalHostPosition: string | null = null

  constructor(
    input: InputSource,
    private readonly options: ResolvedOptions,
  ) {
    this.sourceCanvas = input.getCanvas()
    const ownerDocument = this.sourceCanvas.ownerDocument ?? globalThis.document
    if (!ownerDocument) throw new Error('OverlayManager requires a DOM document')

    this.overlayCanvas = ownerDocument.createElement('canvas')
    this.overlayCanvas.className = OVERLAY_CLASS_NAME
    Object.assign(this.overlayCanvas.style, {
      position: 'absolute',
      pointerEvents: 'none',
      background: 'transparent',
      zIndex: '1',
    })

    const context = this.overlayCanvas.getContext('2d')
    if (!context) throw new Error('OverlayManager requires a Canvas 2D context')
    this.context = context

    this.translate = new TranslateOverlay(context)
    this.rotate = new RotateOverlay(context)
    this.scale = new ScaleOverlay(context)

    this.mountCanvas()
    this.clear()
  }

  setMode(mode: ControlMode): void {
    this.mode = mode
    this.clear()
  }

  get currentMode(): ControlMode {
    return this.mode
  }

  /** 每帧一次：先清空，再按发布状态重绘。state 为 null 表示没有活动交互。 */
  onFrame(frame: OverlayFrameContext, state: DragOverlayState | null): void {
    if (this.disposed) return

    this.mountCanvas()
    this.syncCanvasSize(frame)
    this.clear()

    if (!this.options.showOverlay || !state) return
    this.overlayFor(state).render(frame)
  }

  private overlayFor(state: DragOverlayState): OverlayRenderer {
    switch (state.mode) {
      case 'translate':
        return { render: (frame) => this.translate.render(frame, state) }
      case 'rotate':
        return { render: (frame) => this.rotate.render(frame, state) }
      case 'scale':
        return { render: (frame) => this.scale.render(frame, state) }
    }
  }

  clear(): void {
    if (this.disposed) return
    this.context.setTransform(1, 0, 0, 1, 0, 0)
    this.context.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height)
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0)
  }

  destroy(): void {
    if (this.disposed) return

    this.clear()
    for (const overlay of this.allOverlays()) overlay.destroy()
    this.disposed = true

    const parent = this.overlayCanvas.parentElement
    if (parent) parent.removeChild(this.overlayCanvas)
    if (this.positionedHost && this.originalHostPosition !== null) {
      this.positionedHost.style.position = this.originalHostPosition
    }
    this.positionedHost = null
    this.originalHostPosition = null
  }

  private allOverlays(): readonly Overlay[] {
    return [this.translate, this.rotate, this.scale]
  }

  private mountCanvas(): void {
    const host = this.sourceCanvas.parentElement
    if (!host) return
    if (!host.style.position && !this.positionedHost) {
      this.positionedHost = host
      this.originalHostPosition = host.style.position
      host.style.position = 'relative'
    }
    if (this.overlayCanvas.parentElement !== host) host.appendChild(this.overlayCanvas)
  }

  private syncCanvasSize(frame: OverlayFrameContext): void {
    const { widthCss, heightCss } = frame.viewport
    const pixelRatio = frame.pixelRatio > 0 ? frame.pixelRatio : 1
    const backingWidth = Math.round(widthCss * pixelRatio)
    const backingHeight = Math.round(heightCss * pixelRatio)

    this.overlayCanvas.style.left = `${this.sourceCanvas.offsetLeft || 0}px`
    this.overlayCanvas.style.top = `${this.sourceCanvas.offsetTop || 0}px`
    this.overlayCanvas.style.width = `${widthCss}px`
    this.overlayCanvas.style.height = `${heightCss}px`

    if (this.overlayCanvas.width !== backingWidth) this.overlayCanvas.width = backingWidth
    if (this.overlayCanvas.height !== backingHeight) this.overlayCanvas.height = backingHeight
    this.pixelRatio = pixelRatio
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  }
}

interface OverlayRenderer {
  render(frame: OverlayFrameContext): void
}
