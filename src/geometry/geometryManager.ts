import { Matrix4, type Scene } from '@cesium/engine'
import { BaseGeometry } from './baseGeometry'
import { RotateGeometry } from './rotateGeometry'
import { TranslateGeometry } from './translateGeometry'
import { ScaleGeometry } from './scaleGeometry'
import { Mode } from './geometry'

function createGeometry(
  mode: Mode,
): BaseGeometry {
  switch (mode) {
    case 'rotate':
      return new RotateGeometry()
    case 'translate':
      return new TranslateGeometry()
    case 'scale':
      return new ScaleGeometry()
  }
}

export class GeometryManager {
  private readonly activeGeometry: BaseGeometry

  constructor(mode:Mode) {
    this.activeGeometry = createGeometry(mode)
  }

  public buildGeometry(modelMatrix: Matrix4, scene: Scene): void {
    const primitives = this.activeGeometry.buildGeometry(modelMatrix)
    primitives.forEach(p=>{
        scene.primitives.add(p)
    })
  }

  public removeGeometry(scene: Scene): void {
    this.activeGeometry.removeGeometry(scene)
  }

  public updateModelMatrix(modelMatrix: Matrix4): void {
    this.activeGeometry.updateModelMatrix(modelMatrix)
  }
}
