import { Color, Matrix4, type Ray, type Scene } from '@cesium/engine'
import type { FrameContext } from '../frame/gizmoFrame'
import type { BaseGeometry } from './baseGeometry'
import { applyHandleColor } from './geometryUtil'
import type { Handle, HandleId, Mode } from './types'
import { RotateGeometry } from './rotateGeometry'
import { ScaleGeometry } from './scaleGeometry'
import { TranslateGeometry } from './translateGeometry'
import { getHandleId } from '../collision'

const HIGHLIGHT_BRIGHTEN = 0.35
// const INACTIVE_ALPHA = 0.35

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

  //TODO 修改
  setRotateRingDragging(dragging: boolean): void {
    const assets = this.activeGeometry?.getAssets()
    if (!assets) return

    for (const handle of assets) {
      if (!isRotateAxis(handle.id)) continue
      for (const primitive of handle.primitives) {
        const uniforms = (primitive.appearance as {
          uniforms?: Record<string, unknown>
        }).uniforms
        if (uniforms && 'u_cullBackHalf' in uniforms) {
          uniforms.u_cullBackHalf = dragging ? 0 : 1
        }
      }
    }
  }


  highlight(handleId: HandleId | null): void {
    const assets = this.activeGeometry?.getAssets()
    if (!assets) return

    for (const handle of assets) {
      applyHandleColor(
        handle,
        handle.id === handleId ? highlightColor(handle.color) : handle.color,
      )
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

function highlightColor(base: Color): Color {
  return new Color(
    Math.min(1, base.red + HIGHLIGHT_BRIGHTEN),
    Math.min(1, base.green + HIGHLIGHT_BRIGHTEN),
    Math.min(1, base.blue + HIGHLIGHT_BRIGHTEN),
    base.alpha,
  )
}

function isRotateAxis(id: HandleId): boolean {
  return id === 'rotate-x' || id === 'rotate-y' || id === 'rotate-z'
}
