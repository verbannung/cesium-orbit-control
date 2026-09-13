import { Cartesian3, IntersectionTests, Matrix4, Ray } from '@cesium/engine'
import type { GeometryFrameContext } from '../core/frame'
import type { HandleId } from '../core/types'
import { hitsBoundingSphere } from '../math/ray'
import { matrixForHandle, toCameraLocal } from './handleFrame'
import type { Handle, MeshData } from './types'

/** 拾取优先级： view = uniform > axis > plane */
const PICK_PRIORITY: Record<HandleId, number> = {
  'translate-xy': 1,
  'translate-yz': 1,
  'translate-zx': 1,
  'translate-x': 2,
  'translate-y': 2,
  'translate-z': 2,
  'rotate-x': 2,
  'rotate-y': 2,
  'rotate-z': 2,
  'scale-x': 2,
  'scale-y': 2,
  'scale-z': 2,
  'translate-view': 3,
  'rotate-view': 3,
  'scale-uniform': 3,
}

const scratchInv = new Matrix4()
const scratchCamera = new Cartesian3()
const meshRay = new Ray(new Cartesian3(), new Cartesian3())

/**
 * 对当前手柄列表做射线拾取，返回命中的 Handle。
 * 使用与绘制完全相同的矩阵规则（见 matrixForHandle）。
 */
export function pickHandle(
  worldRay: Ray,
  handles: readonly Handle[],
  frame: GeometryFrameContext,
): Handle | null {
  const ordered = sortHandle(handles)
  const cameraLocal = toCameraLocal(frame, scratchCamera)
  let best: Handle | null = null
  let bestT = Infinity
  let bestPri = -1

  for (const handle of ordered) {
    const localRay = toHandleLocalRay(worldRay, handle, frame, meshRay)
    const t = intersectMeshes(localRay, handle.meshes, cameraLocal, cullBackFaces(handle.id))
    if (t === null) continue

    const pri = PICK_PRIORITY[handle.id]
    if (pri > bestPri || (pri === bestPri && t < bestT)) {
      bestPri = pri
      bestT = t
      best = handle
    }
  }

  return best
}

export function sortHandle(handles: readonly Handle[]): Handle[] {
  return handles.slice().sort((a, b) => PICK_PRIORITY[b.id] - PICK_PRIORITY[a.id])
}

function toHandleLocalRay(
  worldRay: Ray,
  handle: Handle,
  frame: GeometryFrameContext,
  result: Ray,
): Ray {
  Matrix4.inverse(matrixForHandle(handle, frame), scratchInv)
  Matrix4.multiplyByPoint(scratchInv, worldRay.origin, result.origin)
  Matrix4.multiplyByPointAsVector(scratchInv, worldRay.direction, result.direction)
  return result
}

function intersectMeshes(
  localRay: Ray,
  meshes: readonly MeshData[],
  cameraLocal: Cartesian3,
  cullBackface = false,
): number | null {
  let best = Infinity

  for (const mesh of meshes) {
    if (!hitsBoundingSphere(localRay, mesh.boundingRadius)) continue

    for (let i = 0; i < mesh.indices.length; i += 3) {
      const t = IntersectionTests.rayTriangleParametric(
        localRay,
        mesh.positions[mesh.indices[i]],
        mesh.positions[mesh.indices[i + 1]],
        mesh.positions[mesh.indices[i + 2]],
        true,
      )

      if (t === undefined || t <= 0 || t >= best) continue
      best = t
    }
  }

  const hit = best < Infinity ? best : null
  if (cullBackface && hit !== null) {
    const hitPointLocal = Ray.getPoint(localRay, hit, new Cartesian3())
    if (Cartesian3.dot(hitPointLocal, cameraLocal) < 0) return null
  }

  return hit
}

/** 旋转环单面剔除；方片与其余双面 */
function cullBackFaces(id: HandleId): boolean {
  return id === 'rotate-x' || id === 'rotate-y' || id === 'rotate-z'
}
