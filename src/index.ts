import {
  ArcType,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  CylinderGeometry,
  GeometryInstance,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  PerInstanceColorAppearance,
  Plane,
  PolylineColorAppearance,
  PolylineGeometry,
  Primitive,
  Viewer,
} from "@cesium/engine";

class CesiumOrbitControl {
  private viewer: Viewer;
  private plane: Plane;
  private modelMatrix!: Matrix4;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.plane = this.initPlane();
  }

  public attachObject(modelMatrix: Matrix4) {
    this.modelMatrix = modelMatrix;
    this.initAxis();
  }

  private initPlane(): Plane {
    return Plane.ORIGIN_XY_PLANE;
  }

  private initAxis(): void {
    const length = 1.0;
    const arrowLen = 0.15;

    const createLineGeometry = () =>
      new PolylineGeometry({
        positions: [Cartesian3.ZERO, new Cartesian3(length, 0, 0)],
        width: 4,
        vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
        arcType: ArcType.NONE,
      });

    const createArrowGeometry = () =>
      new CylinderGeometry({
        length: arrowLen,
        topRadius: 0,
        bottomRadius: 0.04,
        vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
      });

    const arrowLocalX = Matrix4.multiply(
      Matrix4.fromTranslation(new Cartesian3(length - arrowLen / 2, 0, 0)),
      Matrix4.fromRotation(
        Matrix3.fromRotationY(CesiumMath.toRadians(90)),
      ),
      new Matrix4(),
    );

    const rotX = Matrix4.IDENTITY;
    const rotY = Matrix4.fromRotation(
      Matrix3.fromRotationZ(CesiumMath.toRadians(90)),
    );
    const rotZ = Matrix4.fromRotation(
      Matrix3.fromRotationY(CesiumMath.toRadians(-90)),
    );

    const makeAxis = (axis: "X" | "Y" | "Z", color: Color, rot: Matrix4) => {
      const line = new Primitive({
        geometryInstances: new GeometryInstance({
          geometry: createLineGeometry(),
          modelMatrix: Matrix4.clone(rot),
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(color),
          },
          id: { axis, type: "translate" },
        }),
        appearance: new PolylineColorAppearance({ translucent: true }),
        asynchronous: false,
        modelMatrix: this.modelMatrix,
      });

      const arrow = new Primitive({
        geometryInstances: new GeometryInstance({
          geometry: createArrowGeometry(),
          modelMatrix: Matrix4.multiply(rot, arrowLocalX, new Matrix4()),
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(color),
          },
          id: { axis, type: "translate" },
        }),
        appearance: new PerInstanceColorAppearance({
          flat: true,
          translucent: true,
        }),
        asynchronous: false,
        modelMatrix: this.modelMatrix,
      });

      this.viewer.scene.primitives.add(line);
      this.viewer.scene.primitives.add(arrow);
      return { line, arrow };
    };

    const axisX = makeAxis("X", Color.RED, rotX);
    const axisY = makeAxis("Y", Color.GREEN, rotY);
    const axisZ = makeAxis("Z", Color.BLUE, rotZ);

    void axisX;
    void axisY;
    void axisZ;
  }
}


export { CesiumOrbitControl };
