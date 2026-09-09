import {
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Vector3,
} from "three";
import type { RenderRecipe } from "../../types";
export function lighting(recipe: RenderRecipe) {
  const group = new Group();
  const key = new DirectionalLight(0xfff1df, recipe.lightIntensity);
  const az = MathUtils.degToRad(recipe.lightAzimuth),
    el = MathUtils.degToRad(recipe.lightElevation);
  key.position.copy(
    new Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      Math.cos(az) * Math.cos(el),
    ).multiplyScalar(10),
  );
  group.add(
    key,
    new HemisphereLight(0xdce8ff, 0x827469, recipe.ambientIntensity),
  );
  return group;
}
