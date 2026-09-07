import type { Camera, Matrix4, Scene } from '@cesium/engine'
import { Context } from './centerController'
import { resolveOptions, type OrbitControlOptions } from './core/options'
import type { Mode } from './core/types'
import { CesiumInputSource } from './input/cesiumInputSource'

export class OrbitControl {
  private readonly ctx: Context

  constructor(
    canvas: HTMLCanvasElement,
    scene: Scene,
    camera: Camera,
    options?: OrbitControlOptions,
  ) {
    const input = new CesiumInputSource(canvas, scene, camera)
    this.ctx = new Context(input, scene, resolveOptions(options))
  }

  /** modelMatrix 必须可分解为 T·R·S（无剪切、R 正交），否则抛错 */
  bind(modelMatrix: Matrix4, mode: Mode = 'translate'): void {
    this.ctx.bind(modelMatrix, mode)
  }

  setMode(mode: Mode): void {
    this.ctx.updateMode(mode)
  }

  get currentMode(): Mode {
    return this.ctx.mode
  }

  destroy(): void {
    this.ctx.destroy()
  }
}

export type { Mode, Handle, HandleId } from './core/types'
export type { OrbitControlOptions, ResolvedOptions } from './core/options'
// export { HANDLES } from './geometry/handles' — 已停用，见 geometryUtil / *Geometry
