import type { ControlMode, ResolvedOptions } from '../types'
import type { OverlayInputSource } from '../input/types'
import type { DragOverlayState, Overlay } from './types'
import { RotateOverlay } from './rotateOverlay'
import { ScaleOverlay } from './scaleOverlay'
import { TranslateOverlay } from './translateOverlay'

const OVERLAY_CLASS_NAME = 'cesium-gizmo-controls-overlay'

/**
 * 持有 overlay canvas；会话画笔由 EventManager activate/deactivate 绑定。
 * onFrame 以 activeOverlay != null 为门闩，空闲帧不做挂载/同步/绘制。
 */
export class OverlayManager {
  readonly overlayCanvas: HTMLCanvasElement

  private readonly sourceCanvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private activeOverlay: Overlay | null = null

  private pixelRatio = 1
  private positionedHost: HTMLElement | null = null
  private originalHostPosition: string | null = null

  constructor(
    private readonly input: OverlayInputSource,
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
  }

  /** 拖拽会话开始：按 mode 绑定画笔并挂上 canvas。 */
  activate(mode: ControlMode): void {
    switch (mode) {
      case 'translate':
        this.activeOverlay = new TranslateOverlay(this.context)
        break
      case 'rotate':
        this.activeOverlay = new RotateOverlay(this.context)
        break
      case 'scale':
        this.activeOverlay = new ScaleOverlay(this.context)
        break
    }
    this.mountCanvas()
  }

  /** 拖拽会话结束或修改模式后：清空末帧并释放画笔。 */
  deactivate(): void {
    this.activeOverlay = null
    this.clear()
  }


  /**
   * 每帧一次。无 active 时早退；有会话时同步画布并交给 activeOverlay 绘制。
   * 不在此释放会话——由 EventManager deactivate。
   */
  onFrame(state: DragOverlayState | null): void {
    if (!this.activeOverlay) return

    this.mountCanvas()
    this.syncCanvasSize()
    this.clear()

    if (!this.options.showOverlay || !state) return
    this.activeOverlay.render(this.input, state)
  }

  clear(): void {
    this.context.setTransform(1, 0, 0, 1, 0, 0)
    this.context.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height)
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0)
  }

  destroy(): void {
    this.deactivate()

    const parent = this.overlayCanvas.parentElement
    if (parent) parent.removeChild(this.overlayCanvas)
    if (this.positionedHost && this.originalHostPosition !== null) {
      this.positionedHost.style.position = this.originalHostPosition
    }
    this.positionedHost = null
    this.originalHostPosition = null
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

  private syncCanvasSize(): void {
    const { widthCss, heightCss, pixelRatio: requestedPixelRatio } = this.input.getViewport()
    const pixelRatio = requestedPixelRatio > 0 ? requestedPixelRatio : 1
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
