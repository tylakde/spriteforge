import {
  DataTexture,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
} from "three";
import { styleDefinitions } from "./styles";
import type { RenderRecipe } from "../../types";
/** Only the freshly loaded bake scene is modified. Inspection/source materials stay intact. */
export function prepareStyleMaterials(
  root: Group,
  recipe: RenderRecipe,
): () => void {
  const shading = styleDefinitions[recipe.style].shading;
  if (shading === "pbr") return () => {};
  if (shading === "matte") {
    root.traverse((object) => {
      if (object instanceof Mesh) {
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          if (material instanceof MeshStandardMaterial) {
            material.roughness = Math.max(material.roughness, 0.7);
            material.metalness *= 0.4;
          }
        }
      }
    });
    return () => {};
  }
  const ramp = new Uint8Array(recipe.toonBands);
  for (let i = 0; i < ramp.length; i++)
    ramp[i] = Math.round(255 * (0.18 + (0.82 * i) / (ramp.length - 1)));
  const gradient = new DataTexture(ramp, ramp.length, 1, RedFormat);
  gradient.minFilter = gradient.magFilter = NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  const replacements = new Map<Material, MeshToonMaterial>();
  const convert = (material: Material) => {
    if (replacements.has(material)) return replacements.get(material)!;
    const toon = new MeshToonMaterial();
    // Copy only shared supported properties, preserving UV maps, alpha and emissive details.
    for (const key of [
      "color",
      "map",
      "alphaMap",
      "alphaTest",
      "opacity",
      "transparent",
      "side",
      "depthWrite",
      "depthTest",
      "vertexColors",
      "emissive",
      "emissiveMap",
      "emissiveIntensity",
      "normalMap",
      "normalMapType",
      "normalScale",
      "bumpMap",
      "bumpScale",
      "aoMap",
      "aoMapIntensity",
      "lightMap",
      "lightMapIntensity",
      "displacementMap",
      "displacementScale",
      "displacementBias",
      "polygonOffset",
      "polygonOffsetFactor",
      "polygonOffsetUnits",
      "visible",
      "blending",
      "premultipliedAlpha",
    ]) {
      if (key in material)
        Object.assign(toon, { [key]: Reflect.get(material, key) });
    }
    toon.gradientMap = gradient;
    toon.name = material.name + ` (${styleDefinitions[recipe.style].label})`;
    replacements.set(material, toon);
    return toon;
  };
  root.traverse((object) => {
    if (object instanceof Mesh)
      object.material = Array.isArray(object.material)
        ? object.material.map(convert)
        : convert(object.material);
  });
  // Restore before asset.dispose(): it still owns all original maps, including PBR-only textures.
  return () => {
    const inverse = new Map<Material, Material>(
      Array.from(replacements, ([original, toon]) => [toon, original]),
    );
    root.traverse((object) => {
      if (object instanceof Mesh) {
        const restore = (m: Material) => inverse.get(m) ?? m;
        object.material = Array.isArray(object.material)
          ? object.material.map(restore)
          : restore(object.material);
      }
    });
    replacements.forEach((material) => material.dispose());
    gradient.dispose();
  };
}
