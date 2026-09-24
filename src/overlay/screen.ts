import { Cartesian2, type Cartesian3 } from '@cesium/engine'
import type { OverlayInputSource, ViewportSnapshot } from '../input/types'
import type { WorldPolygon, WorldPolyline, WorldSegment } from '../types'

/**
 * Overlay 共用的屏幕空间工具：投影、二维裁剪与 Canvas 绘制。
 * 这里只有像素运算，没有任何三维语义推导。
 */

export function projectPoint(
  input: OverlayInputSource,
  point: Cartesian3,
): Cartesian2 | null {
  return input.worldToWindow(point, new Cartesian2())
}

/** 任一点投影失败即整体放弃，避免画出穿过相机的错误折线。 */
export function projectPoints(
  input: OverlayInputSource,
  points: readonly Cartesian3[],
): Cartesian2[] | null {
  const screen: Cartesian2[] = []
  for (const point of points) {
    const projected = projectPoint(input, point)
    if (!projected) return null
    screen.push(projected)
  }
  return screen
}

export function projectPolyline(
  input: OverlayInputSource,
  polyline: WorldPolyline,
): Cartesian2[] | null {
  const points = projectPoints(input, polyline.points)
  if (!points || points.length < 2) return null
  if (polyline.closed) points.push(points[0])
  return points
}

export function projectPolygon(
  input: OverlayInputSource,
  polygon: WorldPolygon,
): Cartesian2[] | null {
  const points = projectPoints(input, polygon.points)
  return points && points.length >= 3 ? points : null
}

export function projectSegment(
  input: OverlayInputSource,
  segment: WorldSegment,
): readonly [Cartesian2, Cartesian2] | null {
  const start = projectPoint(input, segment.start)
  const end = projectPoint(input, segment.end)
  return start && end ? [start, end] : null
}

export function distanceSquared(a: Cartesian2, b: Cartesian2): number {
  const x = a.x - b.x
  const y = a.y - b.y
  return x * x + y * y
}

/**
 * 把两点确定的直线延长到视口边框，返回边框上的两个交点。
 * 这是屏幕空间的二维直线裁剪，不涉及三维推导。
 */
export function extendLineToViewport(
  a: Cartesian2,
  b: Cartesian2,
  viewport: ViewportSnapshot,
): readonly [Cartesian2, Cartesian2] | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx * dx + dy * dy < 1e-9) return null

  // Liang–Barsky：求参数区间 [tMin, tMax] 使点落在视口内。
  let tMin = -Infinity
  let tMax = Infinity
  const limits: readonly [number, number][] = [
    [-dx, a.x],
    [dx, viewport.widthCss - a.x],
    [-dy, a.y],
    [dy, viewport.heightCss - a.y],
  ]

  for (const [p, q] of limits) {
    if (p === 0) {
      if (q < 0) return null
      continue
    }
    const t = q / p
    if (p < 0) tMin = Math.max(tMin, t)
    else tMax = Math.min(tMax, t)
  }

  if (tMin > tMax) return null
  return [
    new Cartesian2(a.x + dx * tMin, a.y + dy * tMin),
    new Cartesian2(a.x + dx * tMax, a.y + dy * tMax),
  ]
}

export function strokePolyline(
  context: CanvasRenderingContext2D,
  points: readonly Cartesian2[],
): void {
  if (points.length < 2) return
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y)
  context.stroke()
}

export function strokeSegment(
  context: CanvasRenderingContext2D,
  start: Cartesian2,
  end: Cartesian2,
): void {
  context.beginPath()
  context.moveTo(start.x, start.y)
  context.lineTo(end.x, end.y)
  context.stroke()
}

export function fillPolygon(
  context: CanvasRenderingContext2D,
  points: readonly Cartesian2[],
): void {
  if (points.length < 3) return
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y)
  context.closePath()
  context.fill()
}

/** 屏幕线段方向的二维箭头。atan2 在这里表示像素方向，不是交互角度。 */
export function drawArrowHead(
  context: CanvasRenderingContext2D,
  from: Cartesian2,
  to: Cartesian2,
  size = 9,
): void {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx * dx + dy * dy < 1e-9) return
  const angle = Math.atan2(dy, dx)
  const spread = Math.PI / 6
  context.beginPath()
  context.moveTo(to.x, to.y)
  context.lineTo(to.x - size * Math.cos(angle - spread), to.y - size * Math.sin(angle - spread))
  context.lineTo(to.x - size * Math.cos(angle + spread), to.y - size * Math.sin(angle + spread))
  context.closePath()
  context.fill()
}

export function drawLabel(
  context: CanvasRenderingContext2D,
  anchor: Cartesian2,
  text: string,
): void {
  context.font = '12px sans-serif'
  context.textAlign = 'left'
  context.textBaseline = 'bottom'
  context.fillText(text, anchor.x + 10, anchor.y - 10)
}
