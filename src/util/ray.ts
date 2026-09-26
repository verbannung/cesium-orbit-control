import {
  BoundingSphere,
  Cartesian3,
  IntersectionTests,
  Interval,
  Plane,
  type Ray,
} from '@cesium/engine'

const scratchPlane = new Plane(Cartesian3.UNIT_Z, 0)
const scratchSphere = new BoundingSphere(Cartesian3.ZERO, 0)
const scratchInterval = new Interval()


export function intersectPlane(
  ray: Ray,
  planeOrigin: Cartesian3,
  planeNormal: Cartesian3,
  result = new Cartesian3(),
): Cartesian3 | null {
  const plane = Plane.fromPointNormal(planeOrigin, planeNormal, scratchPlane)
  return IntersectionTests.rayPlane(ray, plane, result) ?? null
}


export function hitsBoundingSphere(ray: Ray, radius: number): boolean {
  scratchSphere.radius = radius
  return IntersectionTests.raySphere(ray, scratchSphere, scratchInterval) !== undefined
}
