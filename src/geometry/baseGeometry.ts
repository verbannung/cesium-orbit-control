import { type Scene } from '@cesium/engine'
import { Handle } from './types'

export abstract class BaseGeometry {
  protected assets: Handle[] = []

  constructor(protected readonly scene: Scene) {}

  abstract build(): void

  getAssets(): Handle[] {
    return this.assets
  }

  destroy(): void {
    for (const handle of this.assets) {
      for (const p of handle.primitives) {
        this.scene.primitives.remove(p)
        if (!p.isDestroyed()) p.destroy()
      }
    }
    this.assets = []
  }
}
