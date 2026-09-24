import type { Cartesian2 } from '@cesium/engine'
import type { OverlayInputSource } from '../input/types'
import type { WorldSegment } from '../types'
import type { Overlay, RotateOverlayState } from './types'
import {
  distanceSquared,
  drawArrowHead,
  drawLabel,
  extendLineToViewport,
  fillPolygon,
  projectPoint,
  projectPolygon,
  projectPolyline,
  projectSegment,
  strokePolyline,
  strokeSegment,
} from './screen'

const DEGENERATE_PX_SQUARED = 16

export class RotateOverlay implements Overlay<RotateOverlayState> {
  constructor(private readonly context: CanvasRenderingContext2D) {}

  render(input: OverlayInputSource, state: RotateOverlayState): void {
    const context = this.context
    const color = state.handle.color.toCssColorString()
    const spatial = state.spatial

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = color
    context.fillStyle = color

    const ring = projectPolyline(input, spatial.ringWorld)
    if (ring) {
      context.setLineDash([])
      context.globalAlpha = 0.75
      context.lineWidth = 2
      strokePolyline(context, ring)
    }

    const sector = projectPolygon(input, spatial.sectorWorld)
    if (sector) {
      context.setLineDash([])
      context.globalAlpha = 0.2
      fillPolygon(context, sector)

      context.globalAlpha = 1
      context.lineWidth = 2.5
      strokePolyline(context, [...sector, sector[0]])
    }

    if (spatial.axisGuideWorld) {
      this.drawAxisGuide(input, spatial.axisGuideWorld)
    }
    if (spatial.normalGuideWorld) {
      this.drawNormalGuide(input, spatial.normalGuideWorld)
    }

    // displayAngle 已由 Controller 决定，这里只做单位换算。
    const anchor = projectPoint(input, spatial.labelAnchorWorld)
    if (anchor) {
      const degrees = (state.transform.displayAngle * 180) / Math.PI
      const displayed = Math.abs(degrees) < 0.05 ? 0 : degrees
      context.globalAlpha = 1
      drawLabel(context, anchor, `${displayed.toFixed(1)}°`)
    }

    context.restore()
  }

  private drawAxisGuide(input: OverlayInputSource, guide: WorldSegment): void {
    const projected = projectSegment(input, guide)
    if (!projected) return

    const context = this.context
    context.globalAlpha = 0.65
    context.lineWidth = 1.5

    if (distanceSquared(projected[0], projected[1]) < DEGENERATE_PX_SQUARED) {
      this.drawProjectedAxisMarker(projected[0])
      return
    }

    const extended = extendLineToViewport(projected[0], projected[1], input.getViewport())
    const [start, end]: readonly [Cartesian2, Cartesian2] = extended ?? projected
    context.setLineDash([8, 5])
    strokeSegment(context, start, end)
    context.setLineDash([])
  }

  private drawNormalGuide(input: OverlayInputSource, guide: WorldSegment): void {
    const projected = projectSegment(input, guide)
    if (!projected) return
    const [origin, end] = projected

    const context = this.context
    context.globalAlpha = 1
    context.lineWidth = 3
    context.setLineDash([])

    // origin 与 end 在屏幕上重合时改画标记，否则箭头方向无意义。
    if (distanceSquared(origin, end) < DEGENERATE_PX_SQUARED) {
      this.drawProjectedAxisMarker(origin)
      return
    }

    strokeSegment(context, origin, end)
    drawArrowHead(context, origin, end, 8)
  }

  private drawProjectedAxisMarker(center: Cartesian2): void {
    const context = this.context
    context.setLineDash([])
    context.beginPath()
    context.arc(center.x, center.y, 5, 0, Math.PI * 2)
    context.stroke()
    context.fillText('N', center.x + 8, center.y - 8)
  }
}
