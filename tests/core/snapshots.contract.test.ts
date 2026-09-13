import { Cartesian3, Quaternion } from '@cesium/engine'
import { describe, expect, it } from 'vitest'
import type {
  ControlSnapshot,
  SessionId,
  WorldPolygon,
  WorldPolyline,
  WorldSegment,
} from 'cesium-orbit-control'

/**
 * 架构文档 6.1：坐标/向量/四元数/矩阵直接使用 Cesium 类型，
 * 不再重复定义 Vec2/Vec3/Quaternion/Matrix 快照。
 */
describe('world geometry snapshots', () => {
  it('builds world primitives directly on Cesium math types', () => {
    const sessionId: SessionId = 'session-1'
    const start = new Cartesian3(1, 2, 3)
    const end = new Cartesian3(4, 5, 6)

    const segment: WorldSegment = { start, end }
    const openPolyline: WorldPolyline = { points: [start, end], closed: false }
    const closedPolyline: WorldPolyline = { points: [start, end, start], closed: true }
    const polygon: WorldPolygon = { points: [start, end, start] }

    expect(sessionId).toBe('session-1')
    expect(segment.start).toBeInstanceOf(Cartesian3)
    expect(openPolyline.closed).toBe(false)
    expect(closedPolyline.points).toHaveLength(3)
    expect(polygon.points[0]).toBe(start)
  })

  it('describes a control state as translation, rotation and scale', () => {
    const control: ControlSnapshot = {
      translation: new Cartesian3(1, 2, 3),
      rotation: Quaternion.clone(Quaternion.IDENTITY, new Quaternion()),
      scale: new Cartesian3(1, 1, 1),
    }

    expect(control.translation.x).toBe(1)
    expect(control.rotation.w).toBe(1)
    expect(control.scale.z).toBe(1)
  })
})

const frozenSegment: WorldSegment = {
  start: new Cartesian3(),
  end: new Cartesian3(),
}

if (false) {
  // @ts-expect-error 已发布的世界图元不可替换端点。
  frozenSegment.start = new Cartesian3(1, 0, 0)
}
void frozenSegment
