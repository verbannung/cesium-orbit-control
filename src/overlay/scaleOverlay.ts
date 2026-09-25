import type { Cartesian2 } from '@cesium/engine'
import type { OverlayInputSource } from '../input/types'
import type { WorldSegment } from '../types'
import type { Overlay, ScaleOverlayState } from './types'
import {
  drawArrowHead,
  drawLabel,
  projectPoint,
  projectSegment,
  strokeSegment,
  viewportClip,
} from './screenUtil'

const DASH_PATTERN = [7, 5]

/** 画一次缩放拖拽的轴引导、移动箭头与比例读数。 */
export class ScaleOverlay implements Overlay<ScaleOverlayState> {
  constructor(private readonly context: CanvasRenderingContext2D) {}

  render(input: OverlayInputSource, state: ScaleOverlayState): void {
    const context = this.context
    const color = state.color

    context.save()
    context.strokeStyle = color
    context.fillStyle = color
    context.lineWidth = 2
    context.lineCap = 'round'

    if (state.axisGuideWorld) this.drawAxisGuide(input, state.axisGuideWorld)
    if (state.movementArrowWorld) this.drawArrow(input, state.movementArrowWorld)

    const anchor = projectPoint(input, state.labelAnchorWorld)
    if (anchor) {
      drawLabel(context, anchor, `Scale ${state.displayFactor.toFixed(3)}×`)
    }

    context.setLineDash([])
    context.restore()
  }

  private drawAxisGuide(input: OverlayInputSource, guide: WorldSegment): void {
    const projected = projectSegment(input, guide)
    if (!projected) return
    const { widthCss, heightCss } = input.getViewport()
    const extended = viewportClip(projected[0], projected[1], widthCss, heightCss)
    const [start, end]: readonly [Cartesian2, Cartesian2] = extended ?? projected
    this.context.setLineDash([])
    strokeSegment(this.context, start, end)
  }

  private drawArrow(input: OverlayInputSource, segment: WorldSegment): void {
    const projected = projectSegment(input, segment)
    if (!projected) return
    const [start, end] = projected
    const context = this.context
    context.setLineDash(DASH_PATTERN)
    strokeSegment(context, start, end)
    context.setLineDash([])
    drawArrowHead(context, start, end, 10)
  }
}
