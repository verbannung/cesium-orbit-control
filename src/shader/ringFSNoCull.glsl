in float v_frontness;
in float v_side;

// 不含半圈剔除的变体，供 view 环（视轴旋转）使用。
// billboard 环的 radialMC 恒垂直于 eyeDirMC，v_frontness ≈ 0，
// 符号完全由浮点噪声决定，若在此 discard 会把整圈随机丢一半，闪成麻点。
void main() {
  czm_materialInput materialInput;
  czm_material material = czm_getMaterial(materialInput);

  out_FragColor = vec4(material.diffuse, material.alpha);
  czm_writeLogDepth();
}
