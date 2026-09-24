import type { Cartesian2 } from '@cesium/engine'
import type { OverlayInputSource } from '../input/types'
import type { WorldSegment } from '../types'
import type { Overlay, TranslateOverlayState } from './types'
import {
  drawArrowHead,
  drawLabel,
  extendLineToViewport,
  projectPoint,
  projectPolygon,
  projectPolyline,
  projectSegment,
  strokePolyline,
  strokeSegment,
} from './screen'

const DASH_PATTERN = [7, 5]

/** 画一次位移拖拽的轴 / 面 / 视平面引导与读数。 */
export class TranslateOverlay implements Overlay<TranslateOverlayState> {
  constructor(private readonly context: CanvasRenderingContext2D) {}

  render(input: OverlayInputSource, state: TranslateOverlayState): void {
    const context = this.context
    const color = state.handle.color.toCssColorString()

    context.save()
    context.strokeStyle = color
    context.fillStyle = color
    context.lineWidth = 2
    context.lineCap = 'round'
    context.lineJoin = 'round'

    const guide = state.spatial.guide
    if (guide.kind === 'axis') {
      this.drawAxisGuide(input, guide.line)
    } else if (guide.kind === 'plane') {
      const polygon = projectPolygon(input, guide.polygon)
      if (polygon) {
        context.setLineDash([])
        strokePolyline(context, [...polygon, polygon[0]])
      }
    } else {
      const ring = projectPolyline(input, guide.ring)
      if (ring) {
        context.setLineDash([])
        strokePolyline(context, ring)
      }
      this.drawDashedArrow(input, guide.movementArrow)
    }

    // 直接显示 Controller 发布的结果位移，不由起终点反推。
    const t = state.transform.resultingTranslation
    const anchor = projectPoint(input, state.spatial.labelAnchorWorld)
    if (anchor) {
      drawLabel(
        context,
        anchor,
        [t.x, t.y, t.z].map((value) => value.toFixed(2)).join(', '),
      )
    }

    context.setLineDash([])
    context.restore()
  }

  /** 轴引导是一条直线，延长到视口边界，避免短线段随距离忽长忽短。 */
  private drawAxisGuide(
    input: OverlayInputSource,
    line: WorldSegment,
  ): void {
    const projected = projectSegment(input, line)
    if (!projected) return
    const extended = extendLineToViewport(projected[0], projected[1], input.getViewport())
    const [start, end]: readonly [Cartesian2, Cartesian2] = extended ?? projected
    this.context.setLineDash([])
    strokeSegment(this.context, start, end)
  }

  private drawDashedArrow(
    input: OverlayInputSource,
    segment: WorldSegment,
  ): void {
    const projected = projectSegment(input, segment)
    if (!projected) return
    const [start, end] = projected
    const context = this.context
    context.setLineDash(DASH_PATTERN)
    strokeSegment(context, start, end)
    context.setLineDash([])
    drawArrowHead(context, start, end, 11)
  }
}
