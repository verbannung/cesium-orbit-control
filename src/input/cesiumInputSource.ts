import {
  Cartesian3,
  OrthographicFrustum,
  PerspectiveFrustum,
  Ray,
  SceneTransforms,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Camera,
  type Cartesian2,
  type Scene,
} from '@cesium/engine'
import type { InputSource, PointerHandlers } from '../core/ports'
/**
 * 职责: 负责处理统一的输入事件 将输入事件转化为cesium操作事件
 */
export class CesiumInputSource implements InputSource {
  private removePreRenderCallback?: () => void

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scene: Scene,
    private readonly camera: Camera,
  ) {}

  bindEvents(handlers: PointerHandlers): () => void {
    const sse = new ScreenSpaceEventHandler(this.canvas)
    sse.setInputAction(
      (e: ScreenSpaceEventHandler.PositionedEvent) => handlers.onDown(e.position),
      ScreenSpaceEventType.LEFT_DOWN,
    )
    sse.setInputAction(
      (e: ScreenSpaceEventHandler.MotionEvent) => handlers.onMove(e.endPosition),
      ScreenSpaceEventType.MOUSE_MOVE,
    )
    sse.setInputAction(() => handlers.onUp(), ScreenSpaceEventType.LEFT_UP)


    let pointerId: number | null = null
    const onPointerDown = (e: PointerEvent): void => {
      pointerId = e.pointerId
      try {
        this.canvas.setPointerCapture(e.pointerId)
      } catch {
        pointerId = null
      }
    }
    this.canvas.addEventListener('pointerdown', onPointerDown)

    return () => {
      this.canvas.removeEventListener('pointerdown', onPointerDown)
      if (pointerId !== null) {
        try {
          this.canvas.releasePointerCapture(pointerId)
        } catch {
        }
      }
      if (!sse.isDestroyed()) sse.destroy()
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

  getPickRay(screenPos: Cartesian2, result?: Ray): Ray | null {
    return this.camera.getPickRay(screenPos, result) ?? null
  }

  getCameraPosition(result = new Cartesian3()): Cartesian3 {
    return Cartesian3.clone(this.camera.positionWC, result)
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
