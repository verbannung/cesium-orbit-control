import type { Cartesian2 } from '@cesium/engine'
import { TranslateController } from '../controller/translateController'
import { RotateController } from '../controller/rotateController'
import { ScaleController } from '../controller/scaleController'
import type { BaseController } from '../controller/baseController'
import type { FrameContext } from '../frame/gizmoFrame'
import type { GeometryManager } from '../geometry/geometryManager'
import type { InputSource } from '../core/ports'
import type { ResolvedOptions } from '../core/options'
import type { Mode } from '../geometry/types'

export class EventManager {
  private controller: BaseController
  private dragging = false
  private cameraEnabledBackup = true
  private unbind: (() => void) | null = null

  constructor(
    private readonly input: InputSource,
    private readonly frameContext: FrameContext,
    private readonly geometry: GeometryManager,
    private readonly options: ResolvedOptions,
  ) {
    this.controller = new TranslateController(options)
  }

  init(): void {
    this.unbind = this.input.bindEvents({
      onDown: (pos) => this.onDown(pos),
      onMove: (pos) => this.onMove(pos),
      onUp: () => this.onUp(),
    })
  }

  setMode(mode: Mode): void {
    if (this.dragging) this.forceEnd()
    this.controller = createController(mode, this.options)
  }

  private onDown(screenPos: Cartesian2): void {
    const ray = this.input.getPickRay(screenPos)
    if (!ray) return

    const handleId = this.geometry.pick(ray)
    if (!handleId) return

    const handle = this.geometry.getHandle(handleId)
    if (!handle) return

    const ctx = this.frameContext
    ctx.tripodFrozen = true

    if (!this.controller.begin(handle, ray, ctx)) {
      ctx.tripodFrozen = false
      return
    }

    this.dragging = true
    this.cameraEnabledBackup = this.input.getCameraEnabled()
    this.input.setCameraEnabled(false)
    this.geometry.highlight(handleId)
  }

  private onMove(screenPos: Cartesian2): void {
    const ray = this.input.getPickRay(screenPos)
    if (!ray) return

    if (this.dragging) {
      this.controller.compute(ray)
    } else {
      const handleId = this.geometry.pick(ray)
      this.geometry.highlight(handleId)
    }
  }

  private onUp(): void {
    this.forceEnd()
  }

  private forceEnd(): void {
    if (!this.dragging) return
    this.controller.end()
    this.frameContext.tripodFrozen = false
    this.input.setCameraEnabled(this.cameraEnabledBackup)
    this.geometry.highlight(null)
    this.dragging = false
  }

  destroy(): void {
    this.forceEnd()
    this.unbind?.()
    this.unbind = null
  }
}

function createController(mode: Mode, options: ResolvedOptions): BaseController {
  switch (mode) {
    case 'translate': return new TranslateController(options)
    case 'rotate':    return new RotateController(options)
    case 'scale':     return new ScaleController(options)
  }
}
