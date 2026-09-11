import { Matrix4, type Ray, type Scene } from '@cesium/engine'
import type { FrameContext } from '../frame/gizmoFrame'
import type { BaseGeometry } from './baseGeometry'
import { applyHandlePick } from './geometryUtil'
import type { Handle, HandleId, Mode } from './types'
import { RotateGeometry } from './rotateGeometry'
import { ScaleGeometry } from './scaleGeometry'
import { TranslateGeometry } from './translateGeometry'
import { getHandleId } from '../collision'

export class GeometryManager {
  activeGeometry: BaseGeometry | null = null

  constructor(
    private readonly scene: Scene,
    private readonly frameContext: FrameContext,
  ) {}

  setMode(mode: Mode): void {
    this.activeGeometry?.destroy()
    this.activeGeometry = createGeometry(mode, this.scene)
    this.activeGeometry.build()
  }

  //每一帧率更新
  updateMatrix(): void {
    if (!this.activeGeometry) return
    const assets = this.activeGeometry.getAssets()
    if (!assets) return
    const ctx = this.frameContext
    for (const handle of assets) {
      for (const p of handle.primitives) {
        if (handle.handleType === 'axis') {
          p.modelMatrix = Matrix4.clone(ctx.axisFlipMatrix, new Matrix4())
        } else if (handle.handleType === 'view'||handle.handleType === 'uniform') {
          p.modelMatrix = Matrix4.clone(ctx.viewMatrix, new Matrix4())
        } else {
          p.modelMatrix = Matrix4.clone(ctx.gizmoMatrix, new Matrix4())
        }
      }
    }
  }

  pick(worldRay: Ray): HandleId | null {
    const assets = this.activeGeometry?.getAssets()
    if (!assets?.length) return null
    return getHandleId(worldRay, assets, this.frameContext)
  }

  getHandle(id: HandleId): Handle | null {
    const assets = this.activeGeometry?.getAssets()
    if (!assets) return null
    return assets.find(h => h.id === id) ?? null
  }


  isDragging(dragging: boolean, activeHandleId: HandleId | null): void {
    const assets = this.activeGeometry?.getAssets()
    if (!assets) return

    for (const handle of assets) {
      const isActive = dragging && handle.id === activeHandleId
      for (const primitive of handle.primitives) {
        primitive.show = !dragging || isActive
        if (!isRotateAxis(handle.id)) continue
        const uniforms = (primitive.appearance as {
          uniforms?: Record<string, unknown>
        }).uniforms
        if (uniforms && 'u_cullBackHalf' in uniforms) {
          uniforms.u_cullBackHalf = isActive ? 0 : 1
        }
      }
    }
  }


  highlight(handleId: HandleId | null): void {
    const assets = this.activeGeometry?.getAssets()
    if (!assets) return

    for (const handle of assets) {
      applyHandlePick(handle, handle.id === handleId)
    }
  }

  destroy(): void {
    this.activeGeometry?.destroy()
    this.activeGeometry = null
  }
}

export function createGeometry(mode: Mode, scene: Scene): BaseGeometry {
  switch (mode) {
    case 'translate':
      return new TranslateGeometry(scene)
    case 'rotate':
      return new RotateGeometry(scene)
    case 'scale':
      return new ScaleGeometry(scene)
  }
}

function isRotateAxis(id: HandleId): boolean {
  return id === 'rotate-x' || id === 'rotate-y' || id === 'rotate-z'
}
