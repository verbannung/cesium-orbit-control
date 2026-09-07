import { Color, Matrix4, type Scene } from '@cesium/engine'
import type { FrameContext } from '../frame/gizmoFrame'
import type { BaseGeometry } from './baseGeometry'
import { applyHandleColor } from './geometryUtil'
import type { HandleId, Mode } from './types'
import { RotateGeometry } from './rotateGeometry'
import { ScaleGeometry } from './scaleGeometry'
import { TranslateGeometry } from './translateGeometry'

const HIGHLIGHT_BRIGHTEN = 0.35
// const INACTIVE_ALPHA = 0.35

export class GeometryManager {
  activeGeometry: BaseGeometry | null = null

  constructor(
    private readonly scene: Scene,
  ) {}

  setMode(mode: Mode): void {
    this.activeGeometry?.destroy()
    this.activeGeometry = createGeometry(mode, this.scene)
    this.activeGeometry.build()
  }

  //每一帧率更新
  updateMatrix(frameContext: FrameContext): void {
    if (!this.activeGeometry) return
    const assets = this.activeGeometry.getAssets()
    if (!assets) return
    for (const handle of assets) {
      for (const p of handle.primitives) {
        if (handle.handleType==='axis') {
                      p.modelMatrix = Matrix4.clone(frameContext.axisFlipMatrix, new Matrix4())

        }

        if (handle.handleType === 'view') {
          p.modelMatrix = Matrix4.clone(frameContext.viewMatrix, new Matrix4())
        }
        else if (handle.handleType === 'plane'||handle.handleType === 'uniform') {
          p.modelMatrix = Matrix4.clone(frameContext.gizmoMatrix, new Matrix4())
        }
      }
    }
  }


  highlight(handleId: HandleId | null): void {
    const assets = this.activeGeometry?.getAssets()
    if (!assets) return

 

    for (const handle of assets) {
      if (handle.id !== handleId) continue
      applyHandleColor(handle, highlightColor(handle.color))
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
