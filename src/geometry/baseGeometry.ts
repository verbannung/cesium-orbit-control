import { Matrix4, Primitive, type Scene } from '@cesium/engine'

export abstract class BaseGeometry {
  
  protected _primitives: Primitive[] = []

  public abstract buildGeometry(modelMatrix: Matrix4): Primitive[]

  public removeGeometry(scene: Scene): void {
    this._primitives.forEach(p => {
      scene.primitives.remove(p)
      if(!p.isDestroyed()){
        p.destroy()
      }
    })
    this._primitives=[]
  }
  //不改变modelMatrix
  public updateModelMatrix(modelMatrix: Matrix4): void {
    this._primitives.forEach(p => {
      p.modelMatrix=modelMatrix.clone()
    })
  }

  public get primitives():ReadonlyArray<Primitive> {
    return this._primitives
  }

}
