import { Cartesian3, Matrix3, Matrix4, Quaternion } from '@cesium/engine'

const ORTHO_EPSILON = 1e-6
const LENGTH_EPSILON = 1e-9

export interface Decomposed {
  R: Matrix3
  T: Cartesian3
  S: Cartesian3
}


//判断是否可分解
// 缩放必须大约LENGTH_EPSILON
// 旋转矩阵必须正交(保证非裁切）且不存在镜像
export function decompose(M: Matrix4): Decomposed | null {
    const S = Matrix4.getScale(M, new Cartesian3())
    if (S.x < LENGTH_EPSILON || S.y < LENGTH_EPSILON || S.z < LENGTH_EPSILON) {
        return null
    }
    const R = Matrix4.getRotation(M,new Matrix3())

    const cols = [
      Matrix3.getColumn(R, 0, new Cartesian3()),
      Matrix3.getColumn(R, 1, new Cartesian3()),
      Matrix3.getColumn(R, 2, new Cartesian3()),
    ]


  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3
    if (Math.abs(Cartesian3.dot(cols[i], cols[j])) > ORTHO_EPSILON) return null
  }
  if(Matrix3.determinant(R)<0) return null

  return {
    R,
    T: Matrix4.getTranslation(M, new Cartesian3()),
    S,
  }
}

export function composeTRS(
  translation: Cartesian3,
  rotation: Quaternion,
  scale: Cartesian3,
  result = new Matrix4(),
): Matrix4 {
  return Matrix4.fromTranslationQuaternionRotationScale(translation, rotation, scale, result)
}

export const DECOMPOSE_ERROR =
  'cesium-orbit-control: modelMatrix 必须可分解为 T·R·S（无剪切、R 正交、无镜像、无零缩放）。'

/** 把局部 Z 对齐到 toCameraLocal，XY 环因此正对相机 */
export function viewRotation(toCameraLocal: Cartesian3, result: Matrix3): Matrix3 {
  if (!(Cartesian3.magnitudeSquared(toCameraLocal) > 1e-18)) {
    return Matrix3.clone(Matrix3.IDENTITY, result)
  }
  const z = Cartesian3.normalize(toCameraLocal, new Cartesian3())
  const hint = Math.abs(z.z) < 0.999 ? Cartesian3.UNIT_Z : Cartesian3.UNIT_X
  const x = Cartesian3.cross(hint, z, new Cartesian3())
  if (Cartesian3.magnitudeSquared(x) < 1e-18) {
    return Matrix3.clone(Matrix3.IDENTITY, result)
  }
  Cartesian3.normalize(x, x)
  const y = Cartesian3.cross(z, x, new Cartesian3())
  Matrix3.setColumn(result, 0, x, result)
  Matrix3.setColumn(result, 1, y, result)
  Matrix3.setColumn(result, 2, z, result)
  return result
}
