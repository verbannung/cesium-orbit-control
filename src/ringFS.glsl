in float v_frontness;
in float v_side;

void main() {
  // 仅渲染朝向相机的一半圆环
  if (v_frontness <= 0.0) {
    discard;
  }

  czm_materialInput materialInput;
  czm_material material = czm_getMaterial(materialInput);

  out_FragColor = vec4(material.diffuse, material.alpha);
  czm_writeLogDepth();
}
