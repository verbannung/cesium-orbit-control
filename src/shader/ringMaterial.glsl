czm_material czm_getMaterial(czm_materialInput materialInput)
{
  czm_material material = czm_getDefaultMaterial(materialInput);

  material.diffuse = u_color.rgb;
  material.alpha = u_color.a;

  return material;
}
