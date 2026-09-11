import { Cartesian3, IntersectionTests, Matrix4, Ray } from '@cesium/engine'
import type { FrameContext } from './frame/gizmoFrame'
import type { Handle, HandleId, MeshData } from './geometry/types'
import { hitsBoundingSphere } from './math/ray'

/** 拾取优先级： view = uniform >axis>plane */
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
const meshRay = new Ray(new Cartesian3(), new Cartesian3())

/**
 * 对当前手柄列表做射线拾取，返回命中的 HandleId。
 * 矩阵与绘制一致，按 handleId 选择。
 */
export function getHandleId(
  worldRay: Ray,
  handles: readonly Handle[],
  frame: FrameContext,
): HandleId | null {
  const ordered = sortHandle(handles)
  let bestId: HandleId | null = null
  let bestT = Infinity
  let bestPri = -1

  for (const handle of ordered) {
    const localRay = toHandleLocalRay(worldRay, handle, frame, meshRay)
    const t = intersectMeshes(localRay, handle.meshes,frame.toCameraLocal ,cullBackFaces(handle.id))
    if (t === null) continue

    const pri = PICK_PRIORITY[handle.id]
    if (pri > bestPri || (pri === bestPri && t < bestT)) {
      bestPri = pri
      bestT = t
      bestId = handle.id
    }
  }
    console.log(bestId)

  return bestId
}

export function sortHandle(handles: readonly Handle[]): Handle[] {
  return handles.slice().sort((a, b) => PICK_PRIORITY[b.id] - PICK_PRIORITY[a.id])
}

function toHandleLocalRay(
  worldRay: Ray,
  handle: Handle,
  frame: FrameContext,
  result: Ray,
): Ray {
  Matrix4.inverse(matrixForHandleId(handle.id, frame), scratchInv)
  Matrix4.multiplyByPoint(scratchInv, worldRay.origin, result.origin)
  Matrix4.multiplyByPointAsVector(scratchInv, worldRay.direction, result.direction)
  return result
}

/** 与绘制选矩阵规则一致：view 用手系视平面，旋转环 / 均匀缩放用 gizmo，其余跟轴翻转 */
function matrixForHandleId(id: HandleId, frame: FrameContext): Matrix4 {
  if (id === 'translate-view' || id === 'rotate-view'||id === 'scale-uniform') return frame.viewMatrix
  if ( id === 'rotate-x' || id === 'rotate-y' || id === 'rotate-z') {
    return frame.gizmoMatrix
  }
  return frame.axisFlipMatrix
}

function intersectMeshes(
  localRay: Ray,
  meshes: readonly MeshData[],
  toCameraLocal:Cartesian3,
  cullBackface = false
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
  const hit=best < Infinity ? best : null
  if(cullBackface&&hit){
      const hitPointLocal=Ray.getPoint(localRay, hit, new Cartesian3())
      if (Cartesian3.dot(hitPointLocal,toCameraLocal)<0){
          return null;
      }
  }

  return hit;
}

/** 旋转环单面剔除；方片与其余双面 */
function cullBackFaces(id: HandleId): boolean {
  return id === 'rotate-x' || id === 'rotate-y' || id === 'rotate-z'
}
