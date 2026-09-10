import type { RenderRecipe } from "../../types";
import {
  applyStyle,
  styleDefinitions,
  variationStyles,
} from "../styles/styles";
export const baseRecipe: RenderRecipe = {
  name: "Environment Prop",
  style: "original",
  pixelScale: 1,
  colorSteps: 64,
  saturation: 1,
  contrast: 1,
  dither: 0,
  toonBands: 4,
  framingOutlineWidth: 0,
  cellSize: 256,
  projection: "orthographic",
  perspectiveFov: 35,
  cameraElevation: 15,
  frontDirection: 0,
  directionCount: 8,
  lightAzimuth: 315,
  lightElevation: 55,
  lightIntensity: 2.5,
  ambientIntensity: 1.5,
  background: "transparent",
  backgroundColor: "#252934",
  paddingPercent: 10,
  outlineEnabled: false,
  outlineWidth: 1,
  anchor: "ground",
  fps: 12,
  atlasLayout: "grid",
  atlasPadding: 2,
  powerOfTwo: false,
};
export const builtins: RenderRecipe[] = [
  {
    ...baseRecipe,
    name: "Inventory Item",
    cellSize: 512,
    projection: "perspective",
    directionCount: 1,
    cameraElevation: 25,
    frontDirection: 35,
    anchor: "center",
  },
  baseRecipe,
  { ...baseRecipe, name: "Character Impostor", cameraElevation: 5 },
  { ...baseRecipe, name: "Monster Impostor", cameraElevation: 10 },
  {
    ...baseRecipe,
    name: "Map Asset",
    cameraElevation: 70,
    directionCount: 4,
    anchor: "center",
  },
];
export const stylePresets = variationStyles.map((style) => ({
  ...applyStyle(baseRecipe, style),
  name: styleDefinitions[style].label,
}));
builtins.push(...stylePresets);
const ranges: Partial<Record<keyof RenderRecipe, [number, number]>> = {
  colorSteps: [2, 64],
  saturation: [0, 2],
  contrast: [0.5, 1.75],
  dither: [0, 1],
  toonBands: [2, 8],
  framingOutlineWidth: [0, 8],
  perspectiveFov: [10, 100],
  cameraElevation: [-10, 89],
  frontDirection: [0, 360],
  lightAzimuth: [0, 360],
  lightElevation: [0, 90],
  lightIntensity: [0, 10],
  ambientIntensity: [0, 5],
  paddingPercent: [2, 35],
  outlineWidth: [1, 8],
  fps: [1, 60],
  atlasPadding: [0, 16],
};
export function validateRecipe(input: unknown): RenderRecipe {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Recipe must be a JSON object.");
  const obj = input as Record<string, unknown>;
  const r = { ...baseRecipe } as unknown as Record<string, unknown>;
  for (const key of Object.keys(baseRecipe)) if (key in obj) r[key] = obj[key];
  if (typeof r.name !== "string" || !r.name.trim() || r.name.length > 80)
    throw new Error("Recipe name must contain 1–80 characters.");
  for (const [key, [min, max]] of Object.entries(ranges))
    if (
      typeof r[key] !== "number" ||
      !Number.isFinite(r[key]) ||
      (r[key] as number) < min ||
      (r[key] as number) > max
    )
      throw new Error(`${key} must be between ${min} and ${max}.`);
  for (const [key, values] of Object.entries({
    style: ["original", "pixel", "cartoon", "hybrid"],
    pixelScale: [1, 2, 4, 8],
    cellSize: [64, 128, 256, 512, 1024],
    directionCount: [1, 4, 8, 16, 32],
    projection: ["orthographic", "perspective"],
    background: ["transparent", "solid"],
    anchor: ["ground", "center"],
    atlasLayout: ["grid", "strip"],
  }))
    if (!(values as unknown[]).includes(r[key]))
      throw new Error(`Invalid ${key}.`);
  for (const key of [
    "fps",
    "outlineWidth",
    "atlasPadding",
    "colorSteps",
    "toonBands",
    "framingOutlineWidth",
  ])
    if (!Number.isInteger(r[key]))
      throw new Error(`${key} must be a whole number.`);
  for (const key of ["outlineEnabled", "powerOfTwo"])
    if (typeof r[key] !== "boolean") throw new Error(`Invalid ${key}.`);
  if (
    typeof r.backgroundColor !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(r.backgroundColor)
  )
    throw new Error("Background colour must be #RRGGBB.");
  return r as unknown as RenderRecipe;
}
