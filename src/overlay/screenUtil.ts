import { Cartesian2, type Cartesian3 } from '@cesium/engine'
import type { OverlayInputSource } from '../input/types'
import type { WorldPolygon, WorldPolyline, WorldSegment } from '../types'

/**
 * Overlay 屏幕空间工具包：投影、纯 2D 点运算与 Canvas 绘制。
 */

/* -------------------------------- 投影 --------------------------------- */

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
  if (polygon.points.length < 3) return null
  return projectPoints(input, polygon.points)
}

export function projectSegment(
  input: OverlayInputSource,
  segment: WorldSegment,
): readonly [Cartesian2, Cartesian2] | null {
  const start = projectPoint(input, segment.start)
  const end = projectPoint(input, segment.end)
  return start && end ? [start, end] : null
}

/* ------------------------------ 纯 2D 运算 ------------------------------ */

/** 两点距离的平方，避免开方。 */
export function distanceSquared(a: Cartesian2, b: Cartesian2): number {
  const x = a.x - b.x
  const y = a.y - b.y
  return x * x + y * y
}

/**
 * 把两点确定的直线延长到矩形视口边框，返回边框上的两个交点。
 * Liang–Barsky算法 二维直线裁剪。
 */
export function viewportClip(
  a: Cartesian2,
  b: Cartesian2,
  width: number,
  height: number,
): readonly [Cartesian2, Cartesian2] | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx * dx + dy * dy < 1e-9) return null

  let tMin = -Infinity
  let tMax = Infinity
  const limits: readonly [number, number][] = [
    [-dx, a.x],
    [dx, width - a.x],
    [-dy, a.y],
    [dy, height - a.y],
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

/**
 * 屏幕线段方向的箭头三角形三点（tip + 两翼）。
 * 退化线段返回 null。
 */
export function arrowHeadPoints(
  from: Cartesian2,
  to: Cartesian2,
  size = 9,
): readonly [Cartesian2, Cartesian2, Cartesian2] | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx * dx + dy * dy < 1e-9) return null
  const angle = Math.atan2(dy, dx)
  const spread = Math.PI / 6
  return [
    new Cartesian2(to.x, to.y),
    new Cartesian2(
      to.x - size * Math.cos(angle - spread),
      to.y - size * Math.sin(angle - spread),
    ),
    new Cartesian2(
      to.x - size * Math.cos(angle + spread),
      to.y - size * Math.sin(angle + spread),
    ),
  ]
}

/* ------------------------------ Canvas 绘制 ----------------------------- */

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
  const points = arrowHeadPoints(from, to, size)
  if (!points) return
  fillPolygon(context, points)
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
