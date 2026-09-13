import type { Cartesian2 } from '@cesium/engine'
import type { OverlayFrameContext } from '../core/frame'
import type { WorldSegment } from '../core/snapshots'
import type { RotateFrameState } from '../core/state'
import type { Overlay } from './overlay'
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

/** 屏幕上两点重合到这个距离内就认为该方向投影退化成一个点。 */
const DEGENERATE_PX_SQUARED = 16

/** 画 Controller 已生成的旋转圆环、扇区与轴向引导。 */
export class RotateOverlay implements Overlay<RotateFrameState> {
  constructor(private readonly context: CanvasRenderingContext2D) {}

  render(frame: OverlayFrameContext, state: RotateFrameState): void {
    const context = this.context
    const color = state.handle.color.toCssColorString()
    const spatial = state.spatial

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = color
    context.fillStyle = color

    const ring = projectPolyline(frame, spatial.ringWorld)
    if (ring) {
      context.setLineDash([])
      context.globalAlpha = 0.75
      context.lineWidth = 2
      strokePolyline(context, ring)
    }

    const sector = projectPolygon(frame, spatial.sectorWorld)
    if (sector) {
      context.setLineDash([])
      context.globalAlpha = 0.2
      fillPolygon(context, sector)

      context.globalAlpha = 1
      context.lineWidth = 2.5
      strokePolyline(context, [...sector, sector[0]])
    }

    if (spatial.axisGuideWorld) {
      this.drawAxisGuide(frame, spatial.axisGuideWorld)
    }
    if (spatial.normalGuideWorld) {
      this.drawNormalGuide(frame, spatial.normalGuideWorld)
    }

    // displayAngle 已由 Controller 决定，这里只做单位换算。
    const anchor = projectPoint(frame, spatial.labelAnchorWorld)
    if (anchor) {
      const degrees = (state.transform.displayAngle * 180) / Math.PI
      const displayed = Math.abs(degrees) < 0.05 ? 0 : degrees
      context.globalAlpha = 1
      drawLabel(context, anchor, `${displayed.toFixed(1)}°`)
    }

    context.restore()
  }

  private drawAxisGuide(frame: OverlayFrameContext, guide: WorldSegment): void {
    const projected = projectSegment(frame, guide)
    if (!projected) return

    const context = this.context
    context.globalAlpha = 0.65
    context.lineWidth = 1.5

    if (distanceSquared(projected[0], projected[1]) < DEGENERATE_PX_SQUARED) {
      this.drawProjectedAxisMarker(projected[0])
      return
    }

    const extended = extendLineToViewport(projected[0], projected[1], frame.viewport)
    const [start, end]: readonly [Cartesian2, Cartesian2] = extended ?? projected
    context.setLineDash([8, 5])
    strokeSegment(context, start, end)
    context.setLineDash([])
  }

  private drawNormalGuide(frame: OverlayFrameContext, guide: WorldSegment): void {
    const projected = projectSegment(frame, guide)
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

  clear(): void {
    // 画布由 OverlayManager 统一清除。
  }

  destroy(): void {
    this.clear()
  }
}
