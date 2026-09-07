import { Cartesian3, Matrix3, Matrix4, Quaternion } from '@cesium/engine'
import type { ResolvedOptions } from '../core/options'
import type { InputSource } from '../core/ports'
import { AXES } from '../geometry/types'
import type { Triple } from '../geometry/types'
import { composeTRS, decompose, viewRotation } from '../math/matrix'

/**
 * 职责:负责计算每一帧的gizmo的信息 后续geometryManager或collision等均可从此处获得对应的数据
 */

export interface FrameContext {
  cameraPosition: Cartesian3
  pixelScale: number
  toCameraLocal: Cartesian3
  rotationWorldToLocal: Matrix3
  translation: Cartesian3 //允许controller刷入
  scale: Cartesian3 //允许controller刷入
  rotation: Quaternion //允许controller刷入
  viewRotation: Matrix3
  /** [R · s | T]，s 为屏幕均匀尺度；不含物体自身 S */
  gizmoMatrix: Matrix4
  /** [R · s · viewRotation | T] */
  viewMatrix: Matrix4
  /** gizmoMatrix · axisFlip，轴/面手柄用 */
  axisFlipMatrix: Matrix4
  modelMatrix: Matrix4
}

const MIN_FRAME_SCALE = 1e-9
const scratchToCam = new Cartesian3()
const scratchCol = new Cartesian3()
const scratchR = new Matrix3()
const scratchScaledR = new Matrix3()
const scratchViewScaledR = new Matrix3()
const scratchFlipScale = new Cartesian3()
const scratchFlipR = new Matrix4()

export class GizmoFrame {
  /** 内部副本，不写外部传入的引用 */
  private readonly modelMatrix = new Matrix4()

  private axisFactor: Triple<number> = [1, 1, 1]
  private readonly axisFlip = Matrix3.clone(Matrix3.IDENTITY, new Matrix3())
  private tripodFrozen = false
  private started = false

  private readonly frameContext: FrameContext = {
    cameraPosition: new Cartesian3(),
    pixelScale: 1,
    toCameraLocal: new Cartesian3(),
    rotationWorldToLocal: new Matrix3(),
    translation: new Cartesian3(),
    scale: new Cartesian3(1, 1, 1),
    rotation: new Quaternion(),
    viewRotation: new Matrix3(),
    gizmoMatrix: new Matrix4(),
    viewMatrix: new Matrix4(),
    axisFlipMatrix: new Matrix4(),
    modelMatrix: this.modelMatrix,
  }

  constructor(
    private readonly input: InputSource,
    private readonly options: ResolvedOptions,
    private readonly onModelMatrixChange?: (modelMatrix: Matrix4) => void,
    private readonly onFrame?: (ctx: FrameContext) => void,
  ) {}

  init(modelMatrix: Matrix4): void {
    Matrix4.clone(modelMatrix, this.modelMatrix)
    if (this.started) return
    this.started = true
    this.input.onPreRender(() => this.onPreRender())
  }

  freezeTripod(): void {
    this.tripodFrozen = true
  }

  releaseTripod(): void {
    this.tripodFrozen = false
  }

  getFrameContext(): FrameContext {
    return this.frameContext
  }

  computeModelMatrix(): Matrix4 {
    const ctx = this.frameContext
    return composeTRS(ctx.translation, ctx.rotation, ctx.scale, this.modelMatrix)
  }

  private onPreRender(): void {
    const ctx = this.frameContext
    let R: Matrix3

    if (this.tripodFrozen) {
      this.computeModelMatrix()
      this.onModelMatrixChange?.(Matrix4.clone(this.modelMatrix, new Matrix4()))
      R = Matrix3.fromQuaternion(ctx.rotation, scratchR)
      Matrix3.transpose(R, ctx.rotationWorldToLocal)
    } else {
      const d = decompose(this.modelMatrix)
      if (!d) return
      Cartesian3.clone(d.T, ctx.translation)
      Cartesian3.clone(d.S, ctx.scale)
      Quaternion.fromRotationMatrix(d.R, ctx.rotation)
      Matrix3.transpose(d.R, ctx.rotationWorldToLocal)
      R = d.R
    }

    const T = ctx.translation
    const px = this.input.getPixelScale(T)
    ctx.pixelScale = px
    const screenScale = px > 1e-12 ? this.options.gizmoPixelSize / px : MIN_FRAME_SCALE

    this.input.getCameraPosition(ctx.cameraPosition)
    Cartesian3.subtract(ctx.cameraPosition, T, scratchToCam)
    if (Cartesian3.magnitudeSquared(scratchToCam) < 1e-18) {
      Cartesian3.clone(Cartesian3.UNIT_Z, scratchToCam)
    } else {
      Cartesian3.normalize(scratchToCam, scratchToCam)
    }
    Matrix3.multiplyByVector(ctx.rotationWorldToLocal, scratchToCam, ctx.toCameraLocal)
    if (Cartesian3.magnitudeSquared(ctx.toCameraLocal) > 0) {
      Cartesian3.normalize(ctx.toCameraLocal, ctx.toCameraLocal)
    }

    viewRotation(ctx.toCameraLocal, ctx.viewRotation)

    for (let i = 0; i < 3; i++) {
      Matrix3.getColumn(R, i, scratchCol)
      Cartesian3.multiplyByScalar(scratchCol, screenScale, scratchCol)
      Matrix3.setColumn(scratchScaledR, i, scratchCol, scratchScaledR)
    }
    Matrix4.fromRotationTranslation(scratchScaledR, T, ctx.gizmoMatrix)
    Matrix3.multiply(scratchScaledR, ctx.viewRotation, scratchViewScaledR)
    Matrix4.fromRotationTranslation(scratchViewScaledR, T, ctx.viewMatrix)

    if (!this.tripodFrozen) this.recomputeTripod()
    Matrix4.multiply(
      ctx.gizmoMatrix,
      Matrix4.fromRotation(this.axisFlip, scratchFlipR),
      ctx.axisFlipMatrix,
    )

    this.onFrame?.(ctx)
  }

  private recomputeTripod(): void {
    const { toCameraLocal } = this.frameContext
    for (let i = 0; i < 3; i++) {
      const dot = Cartesian3.dot(AXES[i], toCameraLocal)
      this.axisFactor[i] = dot < 0 ? -1 : 1
    }
    scratchFlipScale.x = this.axisFactor[0]
    scratchFlipScale.y = this.axisFactor[1]
    scratchFlipScale.z = this.axisFactor[2]
    Matrix3.fromScale(scratchFlipScale, this.axisFlip)
  }

  destroy(): void {
    this.input.removePreRender()
    this.started = false
  }
}
