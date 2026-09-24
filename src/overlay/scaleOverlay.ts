import { Cartesian3, type Cartesian2 } from '@cesium/engine'
import type { OverlayInputSource } from '../input/types'
import type { WorldSegment } from '../types'
import type { Overlay, ScaleOverlayState } from './types'
import {
  drawArrowHead,
  drawLabel,
  extendLineToViewport,
  projectPoint,
  projectSegment,
  strokeSegment,
} from './screen'

const DASH_PATTERN = [7, 5]

/** 画一次缩放拖拽的轴引导、移动箭头与比例读数。 */
export class ScaleOverlay implements Overlay<ScaleOverlayState> {
  constructor(private readonly context: CanvasRenderingContext2D) {}

  render(input: OverlayInputSource, state: ScaleOverlayState): void {
    const context = this.context
    const color = state.handle.color.toCssColorString()
    const spatial = state.spatial

    context.save()
    context.strokeStyle = color
    context.fillStyle = color
    context.lineWidth = 2
    context.lineCap = 'round'

    if (spatial.axisGuideWorld) this.drawAxisGuide(input, spatial.axisGuideWorld)
    if (spatial.movementArrowWorld) this.drawArrow(input, spatial.movementArrowWorld)

    // 显示 Controller 实际施加的比例，不用 current/start 反推（会丢掉 snap 与 clamp）。
    const anchor = projectPoint(input, spatial.labelAnchorWorld)
    if (anchor) {
      drawLabel(context, anchor, `Scale ${displayFactor(state).toFixed(3)}×`)
    }

    context.setLineDash([])
    context.restore()
  }

  private drawAxisGuide(input: OverlayInputSource, guide: WorldSegment): void {
    const projected = projectSegment(input, guide)
    if (!projected) return
    const extended = extendLineToViewport(projected[0], projected[1], input.getViewport())
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

/**
 * appliedFactor 的三个分量中只有被拖的轴会偏离 1（uniform 时三个一起变）。
 * 选一个分量显示是排版决定，不是对缩放语义的二次推导。
 */
function displayFactor(state: ScaleOverlayState): number {
  const factor = state.transform.appliedFactor
  if (state.transform.uniform) return factor.x
  const components: readonly (keyof Pick<Cartesian3, 'x' | 'y' | 'z'>)[] = ['x', 'y', 'z']
  let best = factor.x
  for (const key of components) {
    if (Math.abs(factor[key] - 1) > Math.abs(best - 1)) best = factor[key]
  }
  return best
}
