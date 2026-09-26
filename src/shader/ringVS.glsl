in vec3 position3DHigh;
in vec3 position3DLow;
in vec3 tangentMC;
in float side;
in float batchId;

uniform float u_halfWidthPx;

out float v_frontness;
out float v_side;

void main(){
    // czm_computePosition() 返回仍在模型空间轴向下，把原点挪到相机后的顶点位置，类似于return vertexMC - cameraMC;  
    // 必须再左乘 czm_modelViewRelativeToEye 才进入相机空间，否则丢掉整个视图旋转。
    vec4 p = czm_computePosition();

    vec4 posEC = czm_modelViewRelativeToEye * p; 
    vec4 clipPos = czm_projection * posEC;  

    vec3 tangentEC = mat3(czm_modelView) * tangentMC;
    vec4 clipTangent = czm_projection * vec4(tangentEC, 0.0);

   
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

   
    vec3 radialMC = position3DHigh + position3DLow;
    vec3 eyeDirMC = (czm_inverseModelView * vec4(0.0, 0.0, 1.0, 0.0)).xyz;
    v_frontness = dot(radialMC, normalize(eyeDirMC));
    v_side = side;
    czm_vertexLogDepth();
}
