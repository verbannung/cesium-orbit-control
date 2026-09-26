czm_material czm_getMaterial(czm_materialInput materialInput)
{
  czm_material material = czm_getDefaultMaterial(materialInput);

  material.diffuse = min(vec3(1.0), u_color.rgb + vec3(0.35) * u_pick);
  material.alpha = u_color.a;

  return material;
}
