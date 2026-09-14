import {
  Cartesian2,
  Cartesian3,
  Matrix4,
  OrthographicFrustum,
  PerspectiveFrustum,
  Ray,
  SceneTransforms,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Camera,
  type Scene,
} from '@cesium/engine'
import { NO_MODIFIERS, type PointerInput, type PointerModifiers } from '../core/pointer'
import type { InputSource, PointerHandlers } from '../core/ports'
import type { CameraSnapshot, ViewportSnapshot } from '../core/snapshots'

/**
 * 职责: 把 DOM / Cesium 事件归一化为 PointerInput，并提供相机、视口与投影快照。
 * 这是整个库唯一接触 Scene / Camera 的地方。
 */
export class CesiumInputSource implements InputSource {
  private removePreRenderCallback?: () => void
  private modifiers: PointerModifiers = NO_MODIFIERS
  private activePointerId = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scene: Scene,
    private readonly camera: Camera,
  ) {}

  bindEvents(handlers: PointerHandlers): () => void {
    const sse = new ScreenSpaceEventHandler(this.canvas)

    sse.setInputAction(
      (e: ScreenSpaceEventHandler.PositionedEvent) => {
        const input = this.toPointerInput(e.position)
        if (input) handlers.onDown(input)
      },
      ScreenSpaceEventType.LEFT_DOWN,
    )
    sse.setInputAction(
      (e: ScreenSpaceEventHandler.MotionEvent) => {
        const input = this.toPointerInput(e.endPosition)
        if (input) handlers.onMove(input)
      },
      ScreenSpaceEventType.MOUSE_MOVE,
    )
    sse.setInputAction(
      (e: ScreenSpaceEventHandler.PositionedEvent) => handlers.onUp(this.toPointerInput(e.position)),
      ScreenSpaceEventType.LEFT_UP,
    )

    let capturedPointerId: number | null = null
    const trackPointer = (e: PointerEvent): void => {
      this.activePointerId = e.pointerId
      this.modifiers = {
        shift: e.shiftKey,
        alt: e.altKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
      }
    }
    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 0 || capturedPointerId !== null) return
      trackPointer(e)
      try {
        this.canvas.setPointerCapture(e.pointerId)
        capturedPointerId = e.pointerId
      } catch {
        // capture 不可用时仍允许 Cesium 处理当前事件。
      }
    }
    const onPointerUp = (e: PointerEvent): void => {
      trackPointer(e)
      if (e.pointerId !== capturedPointerId) return
      try {
        this.canvas.releasePointerCapture(e.pointerId)
      } catch {
        // 指针已经释放，忽略。
      }
      capturedPointerId = null
    }
    this.canvas.addEventListener('pointermove', trackPointer)
    this.canvas.addEventListener('pointerdown', onPointerDown)
    this.canvas.addEventListener('pointerup', onPointerUp)

    return () => {
      this.canvas.removeEventListener('pointermove', trackPointer)
      this.canvas.removeEventListener('pointerdown', onPointerDown)
      this.canvas.removeEventListener('pointerup', onPointerUp)
      if (capturedPointerId !== null) {
        try {
          this.canvas.releasePointerCapture(capturedPointerId)
        } catch {
          // 指针已经释放，忽略。
        }
        capturedPointerId = null
      }
      if (!sse.isDestroyed()) sse.destroy()
    }
  }

  /** 射线不可用时返回 null，上层因此永远拿不到半成品输入。 */
  private toPointerInput(screenPosition: Cartesian2): PointerInput | null {
    const rayWorld = this.camera.getPickRay(screenPosition, new Ray())
    if (!rayWorld) return null
    return {
      pointerId: this.activePointerId,
      screenPosition: Cartesian2.clone(screenPosition, new Cartesian2()),
      rayWorld,
      modifiers: this.modifiers,
      timestamp: Date.now(),
    }
  }

  onPreRender(cb: () => void): void {
    this.removePreRenderCallback?.()
    this.removePreRenderCallback = this.scene.preRender.addEventListener(cb)
  }

  removePreRender(): void {
    this.removePreRenderCallback?.()
    this.removePreRenderCallback = undefined
  }

  getCameraPosition(result = new Cartesian3()): Cartesian3 {
    return Cartesian3.clone(this.camera.positionWC, result)
  }

  getCameraSnapshot(): CameraSnapshot {
    return {
      positionWorld: Cartesian3.clone(this.camera.positionWC, new Cartesian3()),
      directionWorld: Cartesian3.clone(this.camera.directionWC, new Cartesian3()),
      upWorld: Cartesian3.clone(this.camera.upWC, new Cartesian3()),
      rightWorld: Cartesian3.clone(this.camera.rightWC, new Cartesian3()),
      viewMatrix: Matrix4.clone(this.camera.viewMatrix, new Matrix4()),
      projectionMatrix: Matrix4.clone(
        this.camera.frustum.projectionMatrix,
        new Matrix4(),
      ),
    }
  }

  getViewport(): ViewportSnapshot {
    const requestedRatio =
      this.canvas.ownerDocument?.defaultView?.devicePixelRatio ??
      globalThis.devicePixelRatio ??
      1
    return {
      widthCss: Math.max(0, this.canvas.clientWidth),
      heightCss: Math.max(0, this.canvas.clientHeight),
      pixelRatio: Number.isFinite(requestedRatio) && requestedRatio > 0 ? requestedRatio : 1,
    }
  }

  getCameraEnabled(): boolean {
    return this.scene.screenSpaceCameraController.enableInputs
  }

  setCameraEnabled(enabled: boolean): void {
    this.scene.screenSpaceCameraController.enableInputs = enabled
  }

  getPixelScale(worldPosition: Cartesian3): number {
    const height = Math.max(this.canvas.clientHeight, 1)
    const frustum = this.camera.frustum
    if (frustum instanceof PerspectiveFrustum) {
      const fovy = frustum.fovy ?? frustum.fov ?? 0
      const dist = Math.max(Cartesian3.distance(worldPosition, this.camera.positionWC), 1e-9)
      const worldHeight = 2 * Math.tan(fovy * 0.5) * dist
      return worldHeight > 0 ? height / worldHeight : 0
    }
    //正摄投影
    if (frustum instanceof OrthographicFrustum && frustum.width && frustum.aspectRatio) {
      const frustumHeight = frustum.width / frustum.aspectRatio
      return frustumHeight > 0 ? height / frustumHeight : 0
    }
    return 0
  }

  worldToWindow(worldPosition: Cartesian3, result?: Cartesian2): Cartesian2 | null {
    return SceneTransforms.worldToWindowCoordinates(this.scene, worldPosition, result) ?? null
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }
}
