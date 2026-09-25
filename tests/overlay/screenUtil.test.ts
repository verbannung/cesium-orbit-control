import { Cartesian2 } from '@cesium/engine'
import { describe, expect, it } from 'vitest'
import { arrowHeadPoints, viewportClip } from '../../src/overlay/screenUtil'

const EPS = 1e-6
const W = 800
const H = 600

function pt(x: number, y: number): Cartesian2 {
  return new Cartesian2(x, y)
}

function expectPointClose(actual: Cartesian2, expected: Cartesian2): void {
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.y).toBeCloseTo(expected.y, 6)
}

/** 点在闭矩形内。 */
function expectInside(p: Cartesian2, width: number, height: number): void {
  expect(p.x).toBeGreaterThanOrEqual(-EPS)
  expect(p.x).toBeLessThanOrEqual(width + EPS)
  expect(p.y).toBeGreaterThanOrEqual(-EPS)
  expect(p.y).toBeLessThanOrEqual(height + EPS)
}

/** 点贴至少一条边（角点算两边都贴）。 */
function expectOnBoundary(p: Cartesian2, width: number, height: number): void {
  const onEdge =
    Math.abs(p.x) < EPS ||
    Math.abs(p.x - width) < EPS ||
    Math.abs(p.y) < EPS ||
    Math.abs(p.y - height) < EPS
  expect(onEdge).toBe(true)
}

/** p 落在 a→b 的直线上；且沿参数方向 t(p0) ≤ t(p1)。 */
function expectColinearOrdered(
  a: Cartesian2,
  b: Cartesian2,
  p0: Cartesian2,
  p1: Cartesian2,
): void {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const cross0 = dx * (p0.y - a.y) - dy * (p0.x - a.x)
  const cross1 = dx * (p1.y - a.y) - dy * (p1.x - a.x)
  expect(Math.abs(cross0)).toBeLessThan(EPS)
  expect(Math.abs(cross1)).toBeLessThan(EPS)

  const len2 = dx * dx + dy * dy
  const t0 = ((p0.x - a.x) * dx + (p0.y - a.y) * dy) / len2
  const t1 = ((p1.x - a.x) * dx + (p1.y - a.y) * dy) / len2
  expect(t0).toBeLessThanOrEqual(t1 + EPS)
}

function expectValidClip(
  a: Cartesian2,
  b: Cartesian2,
  width: number,
  height: number,
  result: readonly [Cartesian2, Cartesian2],
): void {
  const [p0, p1] = result
  expectInside(p0, width, height)
  expectInside(p1, width, height)
  expectOnBoundary(p0, width, height)
  expectOnBoundary(p1, width, height)
  expectColinearOrdered(a, b, p0, p1)
}

describe('viewportClip', () => {
  it('穿过视口的水平线应得左右交点', () => {
    const a = pt(100, 300)
    const b = pt(700, 300)
    const result = viewportClip(a, b, W, H)
    expect(result).not.toBeNull()
    expectPointClose(result![0], pt(0, 300))
    expectPointClose(result![1], pt(W, 300))
    expectValidClip(a, b, W, H, result!)
  })

  it('穿过视口的垂直线应得上下交点', () => {
    const a = pt(400, 100)
    const b = pt(400, 500)
    const result = viewportClip(a, b, W, H)
    expect(result).not.toBeNull()
    expectPointClose(result![0], pt(400, 0))
    expectPointClose(result![1], pt(400, H))
    expectValidClip(a, b, W, H, result!)
  })

  it('两端都在视口内仍延长到边框', () => {
    const a = pt(200, 200)
    const b = pt(600, 400)
    const result = viewportClip(a, b, W, H)
    expect(result).not.toBeNull()
    expectValidClip(a, b, W, H, result!)
  })

  it('两端都在视口外但直线穿过仍有交点', () => {
    const a = pt(-100, 300)
    const b = pt(-50, 300)
    const result = viewportClip(a, b, W, H)
    expect(result).not.toBeNull()
    expectPointClose(result![0], pt(0, 300))
    expectPointClose(result![1], pt(W, 300))
    expectValidClip(a, b, W, H, result!)
  })

  it('与视口平行且在外侧 → null', () => {
    expect(viewportClip(pt(-10, -20), pt(100, -20), W, H)).toBeNull()
    expect(viewportClip(pt(W + 10, 0), pt(W + 10, H), W, H)).toBeNull()
  })

  it('斜线完全错过视口 → null', () => {
    // 在左上角外斜切，不进入 [0,W]×[0,H]
    expect(viewportClip(pt(-100, 50), pt(-50, -100), W, H)).toBeNull()
  })

  it('零长度退化 → null', () => {
    expect(viewportClip(pt(100, 100), pt(100, 100), W, H)).toBeNull()
    expect(viewportClip(pt(100, 100), pt(100 + 1e-8, 100), W, H)).toBeNull()
  })

  it('与底边重合 → 返回底边两端', () => {
    const a = pt(100, 0)
    const b = pt(700, 0)
    const result = viewportClip(a, b, W, H)
    expect(result).not.toBeNull()
    expectPointClose(result![0], pt(0, 0))
    expectPointClose(result![1], pt(W, 0))
    expectValidClip(a, b, W, H, result!)
  })

  it('过角点的对角线满足边框不变量', () => {
    const a = pt(-100, -100)
    const b = pt(100, 100)
    const result = viewportClip(a, b, W, H)
    expect(result).not.toBeNull()
    expectPointClose(result![0], pt(0, 0))
    expectValidClip(a, b, W, H, result!)
  })
})

describe('arrowHeadPoints', () => {
  it('退化线段 → null', () => {
    expect(arrowHeadPoints(pt(10, 10), pt(10, 10))).toBeNull()
    expect(arrowHeadPoints(pt(0, 0), pt(1e-8, 0))).toBeNull()
  })

  it('轴对齐箭头：尖端在终点，两翼距离与夹角正确', () => {
    const from = pt(0, 0)
    const to = pt(100, 0)
    const size = 9
    const points = arrowHeadPoints(from, to, size)
    expect(points).not.toBeNull()
    const [tip, wingA, wingB] = points!

    expectPointClose(tip, to)

    const distA = Math.hypot(wingA.x - tip.x, wingA.y - tip.y)
    const distB = Math.hypot(wingB.x - tip.x, wingB.y - tip.y)
    expect(distA).toBeCloseTo(size, 6)
    expect(distB).toBeCloseTo(size, 6)

    // 相对 from→to 反向各偏 ±π/6，两翼夹角应为 π/3
    const angleA = Math.atan2(wingA.y - tip.y, wingA.x - tip.x)
    const angleB = Math.atan2(wingB.y - tip.y, wingB.x - tip.x)
    let spread = Math.abs(angleA - angleB)
    if (spread > Math.PI) spread = 2 * Math.PI - spread
    expect(spread).toBeCloseTo(Math.PI / 3, 6)
  })

  it('自定义 size 线性缩放', () => {
    const from = pt(0, 0)
    const to = pt(50, 50)
    const small = arrowHeadPoints(from, to, 5)!
    const large = arrowHeadPoints(from, to, 10)!
    const dist = (wing: Cartesian2, tip: Cartesian2) =>
      Math.hypot(wing.x - tip.x, wing.y - tip.y)
    expect(dist(small[1], small[0])).toBeCloseTo(5, 6)
    expect(dist(large[1], large[0])).toBeCloseTo(10, 6)
  })
})
