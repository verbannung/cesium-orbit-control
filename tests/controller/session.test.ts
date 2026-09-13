import { Cartesian3, Quaternion } from '@cesium/engine'
import { describe, expect, it } from 'vitest'
import { RotateController } from '../../src/controller/rotateController'
import { ScaleController } from '../../src/controller/scaleController'
import { TranslateController } from '../../src/controller/translateController'
import { createFrame, handle, options, pointerAt, session } from './harness'

describe('translate session', () => {
  const descriptor = handle('translate-x', 'translate', {
    kind: 'axis',
    axisLocal: Cartesian3.UNIT_X,
  })

  it('publishes revision 0 with a zero delta on begin', () => {
    const controller = new TranslateController(options)
    const state = controller.begin(pointerAt(2, 0), session(descriptor), createFrame())

    expect(state).not.toBeNull()
    expect(state?.revision).toBe(0)
    expect(state?.mode).toBe('translate')
    expect(state?.transform.appliedDeltaWorld.x).toBeCloseTo(0)
    expect(state?.spatial.guide.kind).toBe('axis')
  })

  it('keeps only the constrained axis component and advances revision', () => {
    const controller = new TranslateController(options)
    const frame = createFrame()
    controller.begin(pointerAt(2, 0), session(descriptor), frame)

    const state = controller.compute(pointerAt(5, 3), frame)
    expect(state?.revision).toBe(1)
    expect(state?.transform.rawDeltaLocal.y).toBeCloseTo(3)
    expect(state?.transform.appliedDeltaLocal.y).toBeCloseTo(0)
    expect(state?.transform.appliedDeltaWorld.x).toBeCloseTo(3)
    expect(state?.effectiveControl.translation.x).toBeCloseTo(3)
  })

  it('rebuilds spatial without reinterpreting the pointer', () => {
    const controller = new TranslateController(options)
    const frame = createFrame()
    controller.begin(pointerAt(2, 0), session(descriptor), frame)
    const moved = controller.compute(pointerAt(5, 0), frame)
    const refreshed = controller.refreshSpatial(frame)

    expect(refreshed?.revision).toBe(2)
    expect(refreshed?.transform.appliedDeltaWorld.x).toBeCloseTo(
      moved?.transform.appliedDeltaWorld.x ?? NaN,
    )
  })

  it('stops producing state after end', () => {
    const controller = new TranslateController(options)
    const frame = createFrame()
    controller.begin(pointerAt(2, 0), session(descriptor), frame)
    controller.end()

    expect(controller.active).toBe(false)
    expect(controller.compute(pointerAt(5, 0), frame)).toBeNull()
  })
})

describe('rotate session', () => {
  const descriptor = handle('rotate-z', 'rotate', {
    kind: 'axis',
    axisLocal: Cartesian3.UNIT_Z,
  })

  it('turns a quarter circle into a 90 degree rotation about the world axis', () => {
    const controller = new RotateController(options)
    const frame = createFrame()
    const begun = controller.begin(pointerAt(1, 0), session(descriptor), frame)
    expect(begun?.transform.rawAngle).toBeCloseTo(0)

    const state = controller.compute(pointerAt(0, 1), frame)
    expect(state?.transform.rawAngle).toBeCloseTo(Math.PI / 2)
    expect(state?.transform.accumulatedAngle).toBeCloseTo(Math.PI / 2)

    const expected = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, Math.PI / 2, new Quaternion())
    expect(
      Quaternion.equalsEpsilon(
        state?.transform.resultingRotation ?? new Quaternion(),
        expected,
        1e-9,
      ),
    ).toBe(true)
  })

  it('emits a closed ring and a sector anchored at the center', () => {
    const controller = new RotateController(options)
    const frame = createFrame()
    controller.begin(pointerAt(1, 0), session(descriptor), frame)
    const state = controller.compute(pointerAt(0, 1), frame)

    expect(state?.spatial.ringWorld.closed).toBe(true)
    expect(state?.spatial.ringWorld.points.length).toBeGreaterThan(8)
    expect(state?.spatial.sectorWorld.points[0].x).toBeCloseTo(0)
    expect(state?.spatial.axisGuideWorld).not.toBeNull()
  })

  it('rejects a start point that is too close to the axis', () => {
    const controller = new RotateController(options)
    const state = controller.begin(pointerAt(0.01, 0), session(descriptor), createFrame())
    expect(state).toBeNull()
    expect(controller.active).toBe(false)
  })
})

describe('scale session', () => {
  const descriptor = handle('scale-x', 'scale', {
    kind: 'axis',
    axisLocal: Cartesian3.UNIT_X,
  })

  it('scales only the dragged axis by the pointer ratio', () => {
    const controller = new ScaleController(options)
    const frame = createFrame()
    controller.begin(pointerAt(2, 0), session(descriptor), frame)

    const state = controller.compute(pointerAt(4, 0), frame)
    expect(state?.transform.rawRatio).toBeCloseTo(2)
    expect(state?.transform.appliedFactor.x).toBeCloseTo(2)
    expect(state?.transform.appliedFactor.y).toBeCloseTo(1)
    expect(state?.effectiveControl.scale.x).toBeCloseTo(2)
    expect(state?.effectiveControl.scale.z).toBeCloseTo(1)
    expect(state?.transform.uniform).toBe(false)
  })

  it('clamps to minScale and reports the clamped factor', () => {
    const controller = new ScaleController(options)
    const frame = createFrame()
    controller.begin(pointerAt(2, 0), session(descriptor), frame)

    const state = controller.compute(pointerAt(0.0001, 0), frame)
    expect(state?.effectiveControl.scale.x).toBeCloseTo(options.minScale)
    expect(state?.transform.appliedFactor.x).toBeCloseTo(options.minScale)
  })

  it('emits an axis guide and no movement arrow for axis drags', () => {
    const controller = new ScaleController(options)
    const frame = createFrame()
    const state = controller.begin(pointerAt(2, 0), session(descriptor), frame)

    expect(state?.spatial.axisGuideWorld).not.toBeNull()
    expect(state?.spatial.movementArrowWorld).toBeNull()
  })
})
