import { Cartesian3, Matrix3, Matrix4 } from '@cesium/engine'
import type { ResolvedOptions } from '../core/options'
import type { InputSource } from '../core/ports'
import type { ControlSnapshot } from '../core/snapshots'
import { AXES, type Triple } from '../core/types'
import { viewRotation } from '../math/matrix'

/**
 * 职责：由一个生效 TRS 与当前相机，算出该帧的 gizmo 矩阵族。
 *
 * 这是纯计算组件，不持有交互状态、不发布事件。
 * 会话生命周期与状态发布由 RenderSystem 负责。
 */
export interface GizmoMatrices {
  /** [R · s | T]，s 为屏幕均匀尺度；不含物体自身 S */
  readonly gizmoMatrix: Matrix4
  /** [R · s · viewRotation | T] */
  readonly viewMatrix: Matrix4
  /** gizmoMatrix · axisFlip，轴/面手柄用 */
  readonly axisFlipMatrix: Matrix4
}

const MIN_FRAME_SCALE = 1e-9
const scratchToCam = new Cartesian3()
const scratchCol = new Cartesian3()
const scratchScaledR = new Matrix3()
const scratchViewScaledR = new Matrix3()
const scratchFlipScale = new Cartesian3()
const scratchFlipR = new Matrix4()

export class GizmoFrame implements GizmoMatrices {
  readonly gizmoMatrix = new Matrix4()
  readonly viewMatrix = new Matrix4()
  readonly axisFlipMatrix = new Matrix4()

  /** 相机到 gizmo 的单位方向，局部系 */
  readonly toCameraLocal = new Cartesian3()
  readonly rotationWorldToLocal = new Matrix3()
  readonly cameraPosition = new Cartesian3()
  pixelScale = 1

  private readonly rotationLocalToWorld = new Matrix3()
  private readonly viewRotationMatrix = new Matrix3()
  private readonly axisFactor: Triple<number> = [1, 1, 1]
  private readonly axisFlip = Matrix3.clone(Matrix3.IDENTITY, new Matrix3())

  constructor(
    private readonly input: InputSource,
    private readonly options: ResolvedOptions,
  ) {}

  /**
   * 重算该帧矩阵。
   * freezeTripod=true（拖拽中）时三脚架翻转保持上一次结果，
   * 避免拖拽过程中轴朝向突然跳变。
   */
  update(control: ControlSnapshot, freezeTripod: boolean): void {
    const T = control.translation
    Matrix3.fromQuaternion(control.rotation, this.rotationLocalToWorld)
    Matrix3.transpose(this.rotationLocalToWorld, this.rotationWorldToLocal)

    const px = this.input.getPixelScale(T)
    this.pixelScale = px
    const screenScale = px > 1e-12 ? this.options.gizmoPixelSize / px : MIN_FRAME_SCALE

    this.input.getCameraPosition(this.cameraPosition)
    Cartesian3.subtract(this.cameraPosition, T, scratchToCam)
    if (Cartesian3.magnitudeSquared(scratchToCam) < 1e-18) {
      Cartesian3.clone(Cartesian3.UNIT_Z, scratchToCam)
    } else {
      Cartesian3.normalize(scratchToCam, scratchToCam)
    }
    Matrix3.multiplyByVector(this.rotationWorldToLocal, scratchToCam, this.toCameraLocal)
    if (Cartesian3.magnitudeSquared(this.toCameraLocal) > 0) {
      Cartesian3.normalize(this.toCameraLocal, this.toCameraLocal)
    }

    viewRotation(this.toCameraLocal, this.viewRotationMatrix)

    for (let i = 0; i < 3; i++) {
      Matrix3.getColumn(this.rotationLocalToWorld, i, scratchCol)
      Cartesian3.multiplyByScalar(scratchCol, screenScale, scratchCol)
      Matrix3.setColumn(scratchScaledR, i, scratchCol, scratchScaledR)
    }
    Matrix4.fromRotationTranslation(scratchScaledR, T, this.gizmoMatrix)
    Matrix3.multiply(scratchScaledR, this.viewRotationMatrix, scratchViewScaledR)
    Matrix4.fromRotationTranslation(scratchViewScaledR, T, this.viewMatrix)

    if (!freezeTripod) this.recomputeTripod()
    Matrix4.multiply(
      this.gizmoMatrix,
      Matrix4.fromRotation(this.axisFlip, scratchFlipR),
      this.axisFlipMatrix,
    )
  }

  private recomputeTripod(): void {
    for (let i = 0; i < 3; i++) {
      const dot = Cartesian3.dot(AXES[i], this.toCameraLocal)
      this.axisFactor[i] = dot < 0 ? -1 : 1
    }
    scratchFlipScale.x = this.axisFactor[0]
    scratchFlipScale.y = this.axisFactor[1]
    scratchFlipScale.z = this.axisFactor[2]
    Matrix3.fromScale(scratchFlipScale, this.axisFlip)
  }
}
