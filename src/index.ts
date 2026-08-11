import {
  ArcType,
  Cartesian2,
  Cartesian3,
  CesiumWidget,
  Color,
  ColorGeometryInstanceAttribute,
  CylinderGeometry,
  GeometryInstance,
  IntersectionTests,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  PerInstanceColorAppearance,
  Plane,
  PolylineColorAppearance,
  PolylineGeometry,
  Primitive,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Quaternion,
} from "@cesium/engine";

class CesiumOrbitControl {
  private widget: CesiumWidget;
  private plane: Plane;
  private modelMatrix!: Matrix4;
  private eventHandler: ScreenSpaceEventHandler;

  // 坐标轴：三条线 / 三个箭头各合进一个 Primitive，共用 this.modelMatrix
  private _axisLines!: Primitive;
  private _axisArrows!: Primitive;
  private _rotateAxis!: Primitive;
  // 拖拽状态
  private _dragging = false;
  private _axis: string | null = null;
  private _P1: Cartesian3 | null = null;
  private _R0: Matrix3 | null = null;  
  private _T0: Cartesian3 | null = null;
  private mode: "translate" | "rotate" | "scale" = "translate";

  constructor(widget: CesiumWidget) {
    this.widget = widget;
    this.plane = this.initPlane();
    this.eventHandler = new ScreenSpaceEventHandler(widget.canvas);
  }

  public attachObject(modelMatrix: Matrix4,mode: "translate" | "rotate" | "scale"="rotate") {
    this.modelMatrix = modelMatrix;
    this.mode = mode; 
    if(mode === "rotate"){
      this.initRotateAxis();
    }else{
      this.initAxis();
    }
    this.initEvents();
   
  }

  private initEvents(): void {
    this.eventHandler.setInputAction(
      this.handleMouseDown.bind(this),
      ScreenSpaceEventType.LEFT_DOWN,
    );
    this.eventHandler.setInputAction(
      this.handleMouseUp.bind(this),
      ScreenSpaceEventType.LEFT_UP,
    );
    this.eventHandler.setInputAction(
      this.handleMouseMove.bind(this),
      ScreenSpaceEventType.MOUSE_MOVE,
    );
  }

  private handleMouseDown(event: ScreenSpaceEventHandler.PositionedEvent): void {
    // 判断命中的是哪一个轴
    const picked = this.widget.scene.pick(event.position);
    
    if (picked?.id) {
      const { axis, type } = picked.id;
      
      // T0: 物体世界位置
      const T0 = Matrix4.getTranslation(this.modelMatrix, new Cartesian3());
      // R0: 物体旋转矩阵
      const R0 = Matrix4.getMatrix3(this.modelMatrix, new Matrix3());

      // 世界轴方向（归一化）
      const X_w = Cartesian3.normalize(Matrix3.getColumn(R0, 0, new Cartesian3()), new Cartesian3());
      const Y_w = Cartesian3.normalize(Matrix3.getColumn(R0, 1, new Cartesian3()), new Cartesian3());
      const Z_w = Cartesian3.normalize(Matrix3.getColumn(R0, 2, new Cartesian3()), new Cartesian3());

      // E = normalize(camera - T0)
      const cameraPos = this.widget.scene.camera.position;
      const E = Cartesian3.normalize(Cartesian3.subtract(cameraPos, T0, new Cartesian3()), new Cartesian3());

      if (type === "rotate") {
        // 旋转模式：平面垂直于旋转轴
        if (axis === "X") {
          this.plane = Plane.fromPointNormal(T0, X_w);
        } else if (axis === "Y") {
          this.plane = Plane.fromPointNormal(T0, Y_w);
        } else if (axis === "Z") {
          this.plane = Plane.fromPointNormal(T0, Z_w);
        }
      } else {
        //TODO A和eye平行？？？
        //选择eye因为此时他指向相机，eye和A平行的时候，其实本质上这个轴也拖不动
        // 计算单轴拖拽平面法线：N = normalize(A x (E x A))
        const computeAxisNormal = (A: Cartesian3): Cartesian3 => {
          const B = Cartesian3.cross(E, A, new Cartesian3());
          return Cartesian3.normalize(Cartesian3.cross(A, B, new Cartesian3()), new Cartesian3());
        };

        if (axis === "X") {
          this.plane = Plane.fromPointNormal(T0, computeAxisNormal(X_w));
        } else if (axis === "Y") {
          this.plane = Plane.fromPointNormal(T0, computeAxisNormal(Y_w));
        } else if (axis === "Z") {
          this.plane = Plane.fromPointNormal(T0, computeAxisNormal(Z_w));
        } else if (axis === "XY") {
          this.plane = Plane.fromPointNormal(T0, Z_w);
        } else if (axis === "YZ") {
          this.plane = Plane.fromPointNormal(T0, X_w);
        } else if (axis === "XZ") {
          this.plane = Plane.fromPointNormal(T0, Y_w);
        }
      }

      // 计算 P1：鼠标射线与平面的初始交点
      const ray = this.widget.scene.camera.getPickRay(event.position);
      if (!ray) return;
      const P1 = IntersectionTests.rayPlane(ray, this.plane, new Cartesian3());
      if (!P1) return;

      this._dragging = true;
      this._axis = axis;
      this._P1 = P1;
      this._R0 = R0;
      this._T0 = T0;

      // 锁定镜头视角，禁止移动
// 保持相机当前与目标的相对位置
      this.widget.scene.screenSpaceCameraController.enableRotate = false;
      this.widget.scene.screenSpaceCameraController.enableTranslate = false;
      this.widget.scene.screenSpaceCameraController.enableZoom = false;
      this.widget.scene.screenSpaceCameraController.enableTilt = false;
      this.widget.scene.screenSpaceCameraController.enableLook = false;
    }
  }

  private handleMouseUp(_event: ScreenSpaceEventHandler.PositionedEvent): void {
    this._dragging = false;
    this._axis = null;
    this._P1 = null;
    this._R0 = null;
    this._T0 = null;
    this.widget.scene.screenSpaceCameraController.enableRotate = true;
    this.widget.scene.screenSpaceCameraController.enableTranslate = true;
    this.widget.scene.screenSpaceCameraController.enableZoom = true;
    this.widget.scene.screenSpaceCameraController.enableTilt = true;
    this.widget.scene.screenSpaceCameraController.enableLook = true;


  }

  private handleMouseMove(event: ScreenSpaceEventHandler.MotionEvent): void {
    if (!this._dragging || !this._axis || !this._P1 || !this._R0 || !this._T0) return;

    const endPos: Cartesian2 = event.endPosition;
    const ray = this.widget.scene.camera.getPickRay(endPos);
    if (!ray) return;
    const P2 = IntersectionTests.rayPlane(ray, this.plane, new Cartesian3());
    if (!P2) return;

    if (this.mode === "rotate") {
      let axis_local: Cartesian3;
      if (this._axis === "X") {
        axis_local = Cartesian3.UNIT_X;
      } else if (this._axis === "Y") {
        axis_local = Cartesian3.UNIT_Y;
      } else if (this._axis === "Z") {
        axis_local = Cartesian3.UNIT_Z;
      } else {
        return;
      }
      
      const axis_w = Matrix3.multiplyByVector(this._R0, axis_local, new Cartesian3());
      
      const V1 = Cartesian3.subtract(this._P1, this._T0, new Cartesian3());
      const V2 = Cartesian3.subtract(P2, this._T0, new Cartesian3());
      
      const proj1 = Cartesian3.subtract(
        V1,
        Cartesian3.multiplyByScalar(axis_w, Cartesian3.dot(V1, axis_w), new Cartesian3()),
        new Cartesian3()
      );
      const proj2 = Cartesian3.subtract(
        V2,
        Cartesian3.multiplyByScalar(axis_w, Cartesian3.dot(V2, axis_w), new Cartesian3()),
        new Cartesian3()
      );
      
      const proj1_norm = Cartesian3.normalize(proj1, new Cartesian3());
      const proj2_norm = Cartesian3.normalize(proj2, new Cartesian3());
      
      const dotProduct = Cartesian3.dot(proj1_norm, proj2_norm);
      const angle = Math.acos(CesiumMath.clamp(dotProduct, -1.0, 1.0));
      
      const cross = Cartesian3.cross(proj1_norm, proj2_norm, new Cartesian3());
      const direction = Cartesian3.dot(cross, axis_w);
      const finalAngle = direction >= 0 ? angle : -angle;
      
      const q = Quaternion.fromAxisAngle(axis_local, finalAngle, new Quaternion());
      const R_delta = Matrix3.fromQuaternion(q, new Matrix3());
      
      const R_new = Matrix3.multiply(this._R0, R_delta, new Matrix3());
      
      this.modelMatrix = Matrix4.fromRotationTranslation(R_new, this._T0, this.modelMatrix);
      
      Matrix4.clone(this.modelMatrix, this._rotateAxis.modelMatrix);
    } else {
      const deltaW = Cartesian3.subtract(P2, this._P1, new Cartesian3());

      const R0T = Matrix3.transpose(this._R0, new Matrix3());
      const deltaL = Matrix3.multiplyByVector(R0T, deltaW, new Cartesian3());

      const axis = this._axis;
      const projL = new Cartesian3(
        axis === "X" || axis === "XY" || axis === "XZ" ? deltaL.x : 0,
        axis === "Y" || axis === "XY" || axis === "YZ" ? deltaL.y : 0,
        axis === "Z" || axis === "YZ" || axis === "XZ" ? deltaL.z : 0,
      );

      const deltaWPrime = Matrix3.multiplyByVector(this._R0, projL, new Cartesian3());

      const T1 = Cartesian3.add(this._T0, deltaWPrime, new Cartesian3());
      Matrix4.setTranslation(this.modelMatrix, T1, this.modelMatrix);

      Matrix4.clone(this.modelMatrix, this._axisLines.modelMatrix);
      Matrix4.clone(this.modelMatrix, this._axisArrows.modelMatrix);
    }
  }


  private initPlane(): Plane {
    return Plane.ORIGIN_XY_PLANE;
  }

  private initRotateAxis():void{
    const radius = 1;

    const createCircleGeometry = () => {
      const positions: Cartesian3[] = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * CesiumMath.TWO_PI;
        positions.push(new Cartesian3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
      }
      return new PolylineGeometry({
        positions,
        width: 4,
        vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
        arcType: ArcType.NONE,
      });
    };

    const axes: Array<{ axis: "X" | "Y" | "Z"; color: Color; rot: Matrix4 }> = [
      {
        axis: "X",
        color: Color.RED,
        rot: Matrix4.fromRotation(Matrix3.fromRotationY(CesiumMath.toRadians(90))),
      },
      {
        axis: "Y",
        color: Color.GREEN,
        rot: Matrix4.fromRotation(Matrix3.fromRotationX(CesiumMath.toRadians(90))),
      },
      {
        axis: "Z",
        color: Color.BLUE,
        rot: Matrix4.IDENTITY,
      },
    ];

    this._rotateAxis = this.widget.scene.primitives.add(
      new Primitive({
        geometryInstances: axes.map(
          ({ axis, color, rot }) =>
            new GeometryInstance({
              geometry: createCircleGeometry(),
              modelMatrix: Matrix4.clone(rot),
              attributes: {
                color: ColorGeometryInstanceAttribute.fromColor(color),
              },
              id: { axis, type: "rotate" },
            }),
        ),
        appearance: new PolylineColorAppearance({ translucent: true }),
        asynchronous: false,
        modelMatrix: Matrix4.clone(this.modelMatrix),
      }),
    );
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

    const axes: Array<{ axis: "X" | "Y" | "Z"; color: Color; rot: Matrix4 }> = [
      { axis: "X", color: Color.RED, rot: Matrix4.IDENTITY },
      {
        axis: "Y",
        color: Color.GREEN,
        rot: Matrix4.fromRotation(Matrix3.fromRotationZ(CesiumMath.toRadians(90))),
      },
      {
        axis: "Z",
        color: Color.BLUE,
        rot: Matrix4.fromRotation(Matrix3.fromRotationY(CesiumMath.toRadians(-90))),
      },
    ];

    this._axisLines = this.widget.scene.primitives.add(
      new Primitive({
        geometryInstances: axes.map(
          ({ axis, color, rot }) =>
            new GeometryInstance({
              geometry: createLineGeometry(),
              modelMatrix: Matrix4.clone(rot),
              attributes: {
                color: ColorGeometryInstanceAttribute.fromColor(color),
              },
              id: { axis, type: "translate" },
            }),
        ),
        appearance: new PolylineColorAppearance({ translucent: true }),
        asynchronous: false,
        modelMatrix: Matrix4.clone(this.modelMatrix),
      }),
    );

    this._axisArrows = this.widget.scene.primitives.add(
      new Primitive({
        geometryInstances: axes.map(
          ({ axis, color, rot }) =>
            new GeometryInstance({
              geometry: createArrowGeometry(),
              modelMatrix: Matrix4.multiply(rot, arrowLocalX, new Matrix4()),
              attributes: {
                color: ColorGeometryInstanceAttribute.fromColor(color),
              },
              id: { axis, type: "translate" },
            }),
        ),
        appearance: new PerInstanceColorAppearance({
          flat: true,
          translucent: true,
        }),
        asynchronous: false,
        modelMatrix: Matrix4.clone(this.modelMatrix),
      }),
    );
  }
}


export { CesiumOrbitControl };
