import type { RenderRecipe } from "../../types";
export type SpriteStyle = "original" | "pixel" | "cartoon" | "hybrid";
export const styleDefinitions = {
  original: {
    label: "Original PBR",
    description: "Original materials and smooth lighting.",
  },
  pixel: {
    label: "Pixel Fantasy",
    description: "Chunky pixels, a stepped palette and crisp silhouettes.",
  },
  cartoon: {
    label: "Painted Cartoon",
    description:
      "Warcraft-inspired matte shading, bold colour and soft-edged outlines.",
  },
  hybrid: {
    label: "Pixel Realism",
    description:
      "Fine pixels and rich surface detail between cartoon and realism.",
  },
} as const;
export const variationStyles = ["pixel", "cartoon", "hybrid"] as const;
export const styleDefaults: Record<SpriteStyle, Partial<RenderRecipe>> = {
  original: {
    style: "original",
    pixelScale: 1,
    colorSteps: 64,
    saturation: 1,
    contrast: 1,
    dither: 0,
    toonBands: 4,
    outlineEnabled: false,
    outlineWidth: 1,
  },
  pixel: {
    style: "pixel",
    pixelScale: 4,
    colorSteps: 8,
    saturation: 1.15,
    contrast: 1.12,
    dither: 0.2,
    toonBands: 4,
    outlineEnabled: true,
    outlineWidth: 1,
  },
  cartoon: {
    style: "cartoon",
    pixelScale: 1,
    colorSteps: 32,
    saturation: 1.3,
    contrast: 1.08,
    dither: 0,
    toonBands: 4,
    outlineEnabled: true,
    outlineWidth: 2,
  },
  hybrid: {
    style: "hybrid",
    pixelScale: 2,
    colorSteps: 20,
    saturation: 1.12,
    contrast: 1.06,
    dither: 0.1,
    toonBands: 6,
    outlineEnabled: true,
    outlineWidth: 1,
  },
};
export function applyStyle(
  recipe: RenderRecipe,
  style: SpriteStyle,
): RenderRecipe {
  return { ...recipe, ...styleDefaults[style] };
}
export function effectivePixelScale(recipe: RenderRecipe) {
  return recipe.style === "pixel" || recipe.style === "hybrid"
    ? recipe.pixelScale
    : 1;
}
export function effectiveOutlineWidth(recipe: RenderRecipe) {
  const scale = effectivePixelScale(recipe);
  return recipe.outlineEnabled
    ? Math.ceil(recipe.outlineWidth / scale) * scale
    : 0;
}
export function styledAssetName(stem: string, style: SpriteStyle) {
  // Keep the complete suffix even for maximum-length source filenames (UE parser caps at 80).
  const suffix =
    style === "original"
      ? ""
      : `_${styleDefinitions[style].label.replaceAll(" ", "_")}`;
  return stem.slice(0, 80 - suffix.length) + suffix;
}
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Frame-independent colour quantisation: no changing per-frame palette or random noise. */
export function gradePixels(
  pixels: Uint8ClampedArray,
  size: number,
  recipe: RenderRecipe,
) {
  if (recipe.style === "original") return;
  const levels = recipe.colorSteps - 1;
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (!a) continue;
    const r = pixels[i] / 255,
      g = pixels[i + 1] / 255,
      b = pixels[i + 2] / 255;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const index = i / 4,
      x = index % size,
      y = Math.floor(index / size);
    const threshold =
      ((bayer[(y % 4) * 4 + (x % 4)] / 16 - 0.46875) * recipe.dither) / levels;
    for (let c = 0; c < 3; c++) {
      const channel = luma + (pixels[i + c] / 255 - luma) * recipe.saturation;
      const graded = Math.max(
        0,
        Math.min(1, (channel - 0.5) * recipe.contrast + 0.5 + threshold),
      );
      pixels[i + c] = (Math.round(graded * levels) / levels) * 255;
    }
    // Pixel Fantasy uses binary alpha; hybrid retains authored translucency.
    if (recipe.style === "pixel") {
      pixels[i + 3] = a >= 128 ? 255 : 0;
      if (!pixels[i + 3]) pixels.fill(0, i, i + 3);
    }
  }
}
