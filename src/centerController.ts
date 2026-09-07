class CenterController {
  constructor(private readonly sourceInput) {
    
  }
  //事件循环
//如果点击事件标记事件为true 射线点击到handle 
  render{
  
  }

  //按下事件 标记为true
  begin(): {
    
  }
    
    

      //view uniform是null 是toCamera axis是 u cross v 
      getHandleNormal(handle:Handle):Cartesian3{
      }
      //事件
    end{
  
    }
    //通知geometryManager,overlayManager 更新几何绘画
    changeMode(){
    }

}



// export class Context implements MatrixSink, GizmoQuery {
//   readonly frame: GizmoFrame
//   readonly geometryManager: GeometryManager
//   readonly collisionManager: CollisionManager
//   readonly eventManager: EventManager
//   readonly overlay: OverlayLayer | null

//   mode: Mode = 'translate'

//   modelMatrix = new Matrix4()

//   private applying = false
//   private destroyed = false

//   constructor(
//     readonly input: InputSource,
//     scene: Scene,
//     readonly options: ResolvedOptions,
//   ) {
//     this.frame = new GizmoFrame(input, options)
//     this.geometryManager = new GeometryManager(this.frame, scene)
//     this.collisionManager = new CollisionManager()
//     this.overlay = options.showOverlay ? new OverlayLayer(input) : null
//     this.eventManager = new EventManager(
//       input,
//       this,
//       this.frame,
//       this,
//       options,
//       this.overlay,
//     )
//     // overlay 与几何同在 preRender 刷新，保证与 gizmo 位置同帧
//     this.frame.init((frame) => {
//       this.geometryManager.onFrameChange(frame)
//       this.overlay?.render()
//     })
//     this.eventManager.init()
//   }

//   bind(modelMatrix: Matrix4, mode: Mode): void {
//     if (!decompose(modelMatrix)) throw new Error(DECOMPOSE_ERROR)
//     this.modelMatrix = modelMatrix
//     this.updateMode(mode)
//   }

//   updateMode(mode: Mode): void {
//     this.eventManager.setMode(mode)
//     this.frame.update(this.modelMatrix)
//     this.geometryManager.setMode(mode)
//     this.collisionManager.setMode(mode)
//     this.mode = mode
//   }

//   candidates(frame: GizmoFrameSnapshot): Iterable<PickCandidate> {
//     return this.collisionManager.candidates(frame)
//   }

//   highlight(handleId: HandleId | null, dragging = false): void {
//     this.geometryManager.highlight(handleId, dragging)
//   }


//   updateModelMatrix(modelMatrix: Matrix4): void {
//     if (this.applying || this.destroyed) return
//     this.applying = true
//     try {
//       Matrix4.clone(modelMatrix, this.modelMatrix)
//       this.frame.update(this.modelMatrix)
//       this.options.onChange?.(Matrix4.clone(this.modelMatrix, new Matrix4()))
//     } finally {
//       this.applying = false
//     }
//   }

//   getModelMatrix(): Matrix4 {
//     return this.modelMatrix
//   }

//   destroy(): void {
//     this.destroyed = true
//     this.eventManager.destroy()
//     this.collisionManager.destroy()
//     this.geometryManager.destroy()
//     this.overlay?.destroy()
//     this.frame.destroy()
//   }
// }

