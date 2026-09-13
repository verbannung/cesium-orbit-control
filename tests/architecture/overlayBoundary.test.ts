import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const OVERLAY_DIR = join(process.cwd(), 'src/overlay')

function overlaySources(): readonly { name: string; source: string }[] {
  return readdirSync(OVERLAY_DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, source: readFileSync(join(OVERLAY_DIR, name), 'utf8') }))
}

/**
 * 架构不变量 3/4/5：Overlay 只消费世界图元与受限投影能力。
 * 这些检查用来挡住"Overlay 又开始自己算三维"的回归。
 */
describe('overlay screen-space boundary', () => {
  const FORBIDDEN: readonly { pattern: RegExp; reason: string }[] = [
    { pattern: /Matrix4\.inverse/, reason: '不得求 Gizmo 矩阵的逆' },
    { pattern: /multiplyByPoint(AsVector)?\b/, reason: '不得做局部/世界坐标转换' },
    { pattern: /Cartesian3\.(cross|dot)\b/, reason: '不得用点积/叉积反推交互语义' },
    { pattern: /rotateAroundAxis/, reason: '不得重新生成三维旋转圆弧' },
    { pattern: /gizmoMatrix|axisFlipMatrix|basisLocal/, reason: '不得获得 Gizmo 局部能力' },
    { pattern: /from '\.\.\/controller\//, reason: '不得读取 Controller 私有 Detail/Runtime' },
    { pattern: /from '\.\.\/frame\//, reason: '不得依赖 GizmoFrame' },
  ]

  for (const { pattern, reason } of FORBIDDEN) {
    it(`never uses ${pattern.source} (${reason})`, () => {
      const offenders = overlaySources()
        .filter(({ source }) => pattern.test(source))
        .map(({ name }) => name)
      expect(offenders).toEqual([])
    })
  }

  it('only ever projects through OverlayFrameContext.worldToScreen', () => {
    for (const { name, source } of overlaySources()) {
      if (!source.includes('worldToScreen')) continue
      expect(source, name).not.toContain('worldToWindow')
    }
  })
})
