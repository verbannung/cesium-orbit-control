import { Matrix3, Matrix4 } from '@cesium/engine'
import { expect, test } from 'vitest'
import { rotate } from '../../src/utils/mathUtil'

test('rotate: 单位 Matrix3 得到单位旋转 Matrix4', () => {
  const m = rotate(Matrix3.IDENTITY)
  expect(Matrix4.equalsEpsilon(m, Matrix4.IDENTITY, 1e-10)).toBe(true)
})

test('rotate: 等价于 Matrix4.fromRotation，并写入 result', () => {
  const rotation = Matrix3.fromRotationY(-Math.PI / 2)
  const result = new Matrix4()
  const m = rotate(rotation, result)
  expect(m).toBe(result)
  expect(Matrix4.equalsEpsilon(m, Matrix4.fromRotation(rotation), 1e-10)).toBe(true)
})
