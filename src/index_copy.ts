import {
  CallbackProperty,
  Camera,
  Cartesian2,
  Cartesian3,
  Clock,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  Entity,
  EntityCollection,
  IntersectionTests,
  Matrix3,
  Matrix4,
  Plane,
  Ray,
  Scene,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from '@cesium/engine'

type AxisName = 'x' | 'y' | 'z'

type AxisDefinition = {
  readonly name: AxisName
  readonly direction: Cartesian3
  readonly color: Color
}

type DragState = {
  readonly axis: AxisName
  readonly plane: Plane
  readonly startPoint: Cartesian3
  readonly initialMatrix: Matrix4
  readonly initialPosition: Cartesian3
  readonly initialCameraRotate: boolean
}

/** Minimal scene host — works with CesiumWidget + DataSourceDisplay (no @cesium/widgets). */
export type CesiumOrbitControlHost = {
  readonly canvas: HTMLCanvasElement
  readonly scene: Scene
  readonly camera: Camera
  readonly clock: Clock
  readonly entities: EntityCollection
}

const AXIS_LENGTH_METERS = 100_000
const AXIS_PICK_WIDTH_PIXELS = 12
const AXIS_RENDER_WIDTH_PIXELS = 6

const AXES: readonly AxisDefinition[] = [
  { name: 'x', direction: Cartesian3.UNIT_X, color: Color.RED },
  { name: 'y', direction: Cartesian3.UNIT_Y, color: Color.GREEN },
  { name: 'z', direction: Cartesian3.UNIT_Z, color: Color.BLUE },
] as const

export class CesiumOrbitControl {
  private readonly host: CesiumOrbitControlHost
  private readonly handler: ScreenSpaceEventHandler
  private readonly gizmoEntities = new Map<AxisName, Entity>()
  private attachedEntity: Entity | undefined
  private dragState: DragState | undefined

  constructor(host: CesiumOrbitControlHost) {
    this.host = host
    this.handler = new ScreenSpaceEventHandler(host.canvas)
    this.handler.setInputAction(
      (event: ScreenSpaceEventHandler.PositionedEvent) => this.handleDown(event),
      ScreenSpaceEventType.LEFT_DOWN,
    )
    this.handler.setInputAction(
      (event: ScreenSpaceEventHandler.MotionEvent) => this.handleMove(event),
      ScreenSpaceEventType.MOUSE_MOVE,
    )
    this.handler.setInputAction(
      (event: ScreenSpaceEventHandler.PositionedEvent) => this.handleUp(event),
      ScreenSpaceEventType.LEFT_UP,
    )
  }

  attachObject(entity: Entity): void {
    this.attachedEntity = entity

    if (this.gizmoEntities.size === 0) {
      this.createTranslateGizmo()
    }
  }

  createTranslateGizmo(): void {
    for (const axis of AXES) {
      if (this.gizmoEntities.has(axis.name)) {
        continue
      }

      const gizmoEntity = this.host.entities.add({
        name: `CesiumOrbitControl translate ${axis.name.toUpperCase()} axis`,
        polyline: {
          positions: new CallbackProperty(() => this.getAxisPositions(axis), false),
          width: AXIS_RENDER_WIDTH_PIXELS,
          material: new ColorMaterialProperty(axis.color),
          clampToGround: false,
        },
      })

      this.gizmoEntities.set(axis.name, gizmoEntity)
    }
  }

  handleDown(event: ScreenSpaceEventHandler.PositionedEvent): void {
    const axis = this.pickAxis(event.position)
    const attachedEntity = this.attachedEntity
    if (axis === undefined || attachedEntity === undefined) {
      return
    }

    const initialMatrix = this.getModelMatrix(attachedEntity)
    if (initialMatrix === undefined) {
      return
    }

    const plane = this.createDragPlane(axis, initialMatrix)
    const startPoint = this.intersectPlane(event.position, plane)
    if (startPoint === undefined) {
      return
    }

    const initialPosition = Matrix4.getTranslation(initialMatrix, new Cartesian3())
    const controller = this.host.scene.screenSpaceCameraController
    this.dragState = {
      axis,
      plane,
      startPoint: Cartesian3.clone(startPoint, new Cartesian3()),
      initialMatrix: Matrix4.clone(initialMatrix, new Matrix4()),
      initialPosition,
      initialCameraRotate: controller.enableRotate,
    }
    controller.enableRotate = false
  }

  handleMove(event: ScreenSpaceEventHandler.MotionEvent): void {
    const dragState = this.dragState
    const attachedEntity = this.attachedEntity
    if (dragState === undefined || attachedEntity === undefined) {
      return
    }

    const currentPoint = this.intersectPlane(event.endPosition, dragState.plane)
    if (currentPoint === undefined) {
      return
    }

    const rotation = Matrix4.getRotation(dragState.initialMatrix, new Matrix3())
    const inverseRotation = Matrix3.transpose(rotation, new Matrix3())
    const worldDelta = Cartesian3.subtract(currentPoint, dragState.startPoint, new Cartesian3())
    const localDelta = Matrix3.multiplyByVector(inverseRotation, worldDelta, new Cartesian3())
    const projectedLocalDelta = this.projectLocalDelta(localDelta, dragState.axis)
    const projectedWorldDelta = Matrix3.multiplyByVector(rotation, projectedLocalDelta, new Cartesian3())
    const nextPosition = Cartesian3.add(dragState.initialPosition, projectedWorldDelta, new Cartesian3())

    attachedEntity.position = new ConstantPositionProperty(nextPosition)
    this.host.scene.requestRender()
  }

  handleUp(_event: ScreenSpaceEventHandler.PositionedEvent): void {
    const dragState = this.dragState
    if (dragState === undefined) {
      return
    }

    this.host.scene.screenSpaceCameraController.enableRotate = dragState.initialCameraRotate
    this.dragState = undefined
  }

  destroy(): void {
    if (this.dragState !== undefined) {
      this.host.scene.screenSpaceCameraController.enableRotate = this.dragState.initialCameraRotate
      this.dragState = undefined
    }

    this.handler.destroy()

    for (const entity of this.gizmoEntities.values()) {
      this.host.entities.remove(entity)
    }
    this.gizmoEntities.clear()
    this.attachedEntity = undefined
  }

  private pickAxis(position: Cartesian2): AxisName | undefined {
    const picked = this.host.scene.pick(position, AXIS_PICK_WIDTH_PIXELS, AXIS_PICK_WIDTH_PIXELS)
    const pickedEntity = getPickedEntity(picked)
    if (pickedEntity === undefined) {
      return undefined
    }

    for (const [axis, entity] of this.gizmoEntities) {
      if (entity === pickedEntity) {
        return axis
      }
    }

    return undefined
  }

  private createDragPlane(axis: AxisName, modelMatrix: Matrix4): Plane {
    const rotation = Matrix4.getRotation(modelMatrix, new Matrix3())
    const translation = Matrix4.getTranslation(modelMatrix, new Cartesian3())
    const localAxis = getAxisDirection(axis)
    const worldAxis = Matrix3.multiplyByVector(rotation, localAxis, new Cartesian3())
    Cartesian3.normalize(worldAxis, worldAxis)

    const eye = Cartesian3.subtract(this.host.camera.positionWC, translation, new Cartesian3())
    Cartesian3.normalize(eye, eye)

    const binormal = Cartesian3.cross(eye, worldAxis, new Cartesian3())
    if (Cartesian3.magnitudeSquared(binormal) === 0) {
      const fallbackAxis = axis === 'z' ? Cartesian3.UNIT_X : Cartesian3.UNIT_Z
      Cartesian3.cross(fallbackAxis, worldAxis, binormal)
    }
    Cartesian3.normalize(binormal, binormal)

    const normal = Cartesian3.cross(worldAxis, binormal, new Cartesian3())
    Cartesian3.normalize(normal, normal)

    return Plane.fromPointNormal(translation, normal)
  }

  private intersectPlane(position: Cartesian2, plane: Plane): Cartesian3 | undefined {
    const ray = this.host.camera.getPickRay(position, new Ray())
    if (ray === undefined) {
      return undefined
    }

    return IntersectionTests.rayPlane(ray, plane, new Cartesian3())
  }

  private getAxisPositions(axis: AxisDefinition): readonly Cartesian3[] {
    const attachedEntity = this.attachedEntity
    if (attachedEntity === undefined) {
      return []
    }

    const modelMatrix = this.getModelMatrix(attachedEntity)
    if (modelMatrix === undefined) {
      return []
    }

    const rotation = Matrix4.getRotation(modelMatrix, new Matrix3())
    const origin = Matrix4.getTranslation(modelMatrix, new Cartesian3())
    const worldDirection = Matrix3.multiplyByVector(rotation, axis.direction, new Cartesian3())
    Cartesian3.normalize(worldDirection, worldDirection)

    const axisEndOffset = Cartesian3.multiplyByScalar(worldDirection, AXIS_LENGTH_METERS, new Cartesian3())
    const end = Cartesian3.add(origin, axisEndOffset, new Cartesian3())

    return [origin, end]
  }

  private getModelMatrix(entity: Entity): Matrix4 | undefined {
    const modelMatrix = entity.computeModelMatrix(this.host.clock.currentTime, new Matrix4())
    if (modelMatrix !== undefined) {
      return modelMatrix
    }

    const position = entity.position?.getValue(this.host.clock.currentTime, new Cartesian3())
    if (position === undefined) {
      return undefined
    }

    return Matrix4.fromRotationTranslation(Matrix3.IDENTITY, position, new Matrix4())
  }

  private projectLocalDelta(localDelta: Cartesian3, axis: AxisName): Cartesian3 {
    switch (axis) {
      case 'x':
        return new Cartesian3(localDelta.x, 0, 0)
      case 'y':
        return new Cartesian3(0, localDelta.y, 0)
      case 'z':
        return new Cartesian3(0, 0, localDelta.z)
    }
  }
}

function getAxisDirection(axis: AxisName): Cartesian3 {
  switch (axis) {
    case 'x':
      return Cartesian3.UNIT_X
    case 'y':
      return Cartesian3.UNIT_Y
    case 'z':
      return Cartesian3.UNIT_Z
  }
}

function getPickedEntity(picked: unknown): Entity | undefined {
  if (typeof picked !== 'object' || picked === null || !('id' in picked)) {
    return undefined
  }

  return picked.id instanceof Entity ? picked.id : undefined
}
