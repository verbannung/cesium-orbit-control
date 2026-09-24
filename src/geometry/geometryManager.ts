import { Matrix4, type Ray, type Scene } from '@cesium/engine'
import type { GeometryFrameContext } from '../render/types'
import type { HandleDescriptor, HandleId } from './types'
import type { ControlMode } from '../types'
import type { BaseGeometry } from './baseGeometry'
import { pickHandle } from './collision'
import { applyHandlePick } from './geometryUtil'
import { matrixForHandle } from './handleFrame'
import { RotateGeometry } from './rotateGeometry'
import { ScaleGeometry } from './scaleGeometry'
import { TranslateGeometry } from './translateGeometry'

/**
 * 当前模式下的 Gizmo 几何体、拾取与高亮。
 * 只读取 GeometryFrameContext，不修改任何交互状态（架构 4.5）。
 */
export class GeometryManager {
  private activeGeometry: BaseGeometry | null = null
  private activeHandleId: HandleId | null = null
  private lastFrame: GeometryFrameContext | null = null

  constructor(private readonly scene: Scene) {}

  setMode(mode: ControlMode): void {
    this.deactivate()
    this.activeGeometry?.destroy()
    this.activeGeometry = createGeometry(mode, this.scene)
    this.activeGeometry.build()
  }

  /** 拾取返回完整 HandleDescriptor，约束已在 Handle 创建时解析。 */
  pick(worldRay: Ray): HandleDescriptor | null {
    const assets = this.activeGeometry?.getAssets()
    const frame = this.lastFrame
    if (!assets?.length || !frame) return null
    return pickHandle(worldRay, assets, frame)?.descriptor ?? null
  }

  /** 进入拖拽：只显示被拖的手柄，并高亮它。 */
  activate(handle: HandleDescriptor): void {
    this.activeHandleId = handle.id
    this.applyVisibility()
    this.highlight(handle.id)
  }

  deactivate(): void {
    this.activeHandleId = null
    this.applyVisibility()
    this.highlight(null)
  }

  onFrame(frame: GeometryFrameContext): void {
    this.lastFrame = frame
    const assets = this.activeGeometry?.getAssets()
    if (!assets) return

    for (const handle of assets) {
      const matrix = matrixForHandle(handle, frame)
      for (const primitive of handle.primitives) {
        primitive.modelMatrix = Matrix4.clone(matrix, new Matrix4())
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

  private applyVisibility(): void {
    const assets = this.activeGeometry?.getAssets()
    if (!assets) return

    const dragging = this.activeHandleId !== null
    for (const handle of assets) {
      const isActive = dragging && handle.id === this.activeHandleId
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

  destroy(): void {
    this.activeGeometry?.destroy()
    this.activeGeometry = null
    this.lastFrame = null
    this.activeHandleId = null
  }
}

export function createGeometry(mode: ControlMode, scene: Scene): BaseGeometry {
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
