in vec3 position3DHigh;
in vec3 position3DLow;
in vec3 tangentMC;
in float side;
in float batchId;

uniform float u_halfWidthPx;

out float v_frontness;
out float v_side;

void main(){
    // czm_computePosition() 返回的是模型空间中相对相机的位置（GPU RTE），不是相机空间。
    // 必须再左乘 czm_modelViewRelativeToEye 才进入相机空间，否则丢掉整个视图旋转。
    vec4 p = czm_computePosition();
    vec4 posEC = czm_modelViewRelativeToEye * p;
    vec4 clipPos = czm_projection * posEC;

    //切线方向：方向量 w=0，modelView 与其 RTE 版本等价
    vec3 tangentEC = mat3(czm_modelView) * tangentMC;
    vec4 clipTangent = czm_projection * vec4(tangentEC, 0.0);

    // 对 NDC 坐标 clip.xy / clip.w 求导，再转换为窗口像素方向。
    float clipW2 = max(clipPos.w * clipPos.w, 1.0e-12);
    vec2 screenTangent = (clipTangent.xy * clipPos.w - clipPos.xy * clipTangent.w)
        / clipW2
        * czm_viewport.zw
        * 0.5;
    float screenTangentLength = length(screenTangent);
    vec2 tangentDir = screenTangentLength > 1.0e-6 ? screenTangent / screenTangentLength : vec2(1.0, 0.0);
    vec2 screenNormal = vec2(-tangentDir.y, tangentDir.x);  //逆时针旋转90度

    //像素 -> NDC：x/y 各除以对应视口边长，否则非正方形视口下线宽会被拉偏
    vec2 offsetNdc = screenNormal * side * u_halfWidthPx * 2.0 / czm_viewport.zw;
    gl_Position = clipPos;
    gl_Position.xy += offsetNdc * clipPos.w;

    // GeometryInstance.modelMatrix 为单位矩阵时，position3DHigh+Low 即模型坐标，
    // 单位圆上它同时就是径向；用它判前/背半环，不受屏幕展宽影响。
    vec3 radialMC = position3DHigh + position3DLow;
    //相机 z 轴单位向量在模型空间的表达，基变换
    vec3 eyeDirMC = (czm_inverseModelView * vec4(0.0, 0.0, 1.0, 0.0)).xyz;
    v_frontness = dot(radialMC, normalize(eyeDirMC));
    v_side = side;
    czm_vertexLogDepth();
}
