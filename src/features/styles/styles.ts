import type { RenderRecipe } from "../../types";
type StyleDefinition = {
  label: string;
  description: string;
  shading: "pbr" | "matte" | "toon";
  pixelated: boolean;
  binaryAlpha: boolean;
  palette?: readonly string[];
};
const define = (
  label: string,
  description: string,
  options: Partial<Omit<StyleDefinition, "label" | "description">> = {},
): StyleDefinition => ({
  label,
  description,
  shading: "pbr",
  pixelated: false,
  binaryAlpha: false,
  ...options,
});
export const styleDefinitions = {
  original: define("Original PBR", "Original materials and smooth lighting."),
  pixel: define(
    "Pixel Fantasy",
    "Chunky pixels, a stepped palette and crisp silhouettes.",
    { pixelated: true, binaryAlpha: true },
  ),
  cartoon: define(
    "Painted Cartoon",
    "Warcraft-inspired matte shading, bold colour and soft-edged outlines.",
    { shading: "toon" },
  ),
  hybrid: define(
    "Pixel Realism",
    "Fine pixels and rich surface detail between cartoon and realism.",
    { pixelated: true, shading: "matte" },
  ),
  retro: define(
    "Retro 8 Bit",
    "Large pixel blocks with a fixed 16-colour retro palette.",
    {
      pixelated: true,
      binaryAlpha: true,
      palette: [
        "#171725",
        "#343045",
        "#5b4762",
        "#855776",
        "#ba6579",
        "#ef8c80",
        "#ffbc91",
        "#f9e8b0",
        "#d5df91",
        "#8fbd73",
        "#4f856c",
        "#315761",
        "#343f70",
        "#596e9b",
        "#8cb3cb",
        "#e0e8eb",
      ],
    },
  ),
  arcade: define(
    "Arcade 16 Bit",
    "Fine retro pixels with a vivid, fixed arcade palette.",
    {
      pixelated: true,
      binaryAlpha: true,
      palette: [
        "#141329",
        "#2c2050",
        "#5b2c6f",
        "#943c81",
        "#d24e96",
        "#f681a0",
        "#ffbba6",
        "#ffe5be",
        "#f6bf50",
        "#d78335",
        "#92523e",
        "#593836",
        "#243c50",
        "#28677b",
        "#36a4b2",
        "#74d2cf",
        "#c2ede0",
        "#283e39",
        "#3b6846",
        "#63a85a",
        "#a8ce65",
        "#daf0a0",
        "#242b66",
        "#35569d",
        "#528fc9",
        "#90c3e7",
        "#d4e7fa",
        "#423f56",
        "#6a667c",
        "#9693a4",
        "#c6c2ce",
        "#f2edf2",
      ],
    },
  ),
  comic: define(
    "Comic Cel",
    "Two-band cel shading, saturated colours and heavy black contours.",
    { shading: "toon" },
  ),
  pastel: define(
    "Pastel Storybook",
    "Soft pastel colours, gentle toon shading and muted violet outlines.",
    { shading: "toon" },
  ),
};
export type SpriteStyle = keyof typeof styleDefinitions;
export const allStyles = Object.keys(styleDefinitions) as SpriteStyle[];
export const variationStyles = allStyles.filter(
  (style) => style !== "original",
);
export const defaultVariationStyles: SpriteStyle[] = [
  "pixel",
  "cartoon",
  "hybrid",
];
const defaults = (
  style: SpriteStyle,
  patch: Partial<RenderRecipe> = {},
): Partial<RenderRecipe> => ({
  style,
  pixelScale: 1,
  colorSteps: 64,
  saturation: 1,
  contrast: 1,
  dither: 0,
  toonBands: 4,
  outlineEnabled: false,
  outlineWidth: 1,
  outlineColor: "#121212",
  ...patch,
});
export const styleDefaults: Record<SpriteStyle, Partial<RenderRecipe>> = {
  original: defaults("original"),
  pixel: defaults("pixel", {
    pixelScale: 4,
    colorSteps: 8,
    saturation: 1.15,
    contrast: 1.12,
    dither: 0.2,
    outlineEnabled: true,
  }),
  cartoon: defaults("cartoon", {
    colorSteps: 32,
    saturation: 1.3,
    contrast: 1.08,
    outlineEnabled: true,
    outlineWidth: 2,
  }),
  hybrid: defaults("hybrid", {
    pixelScale: 2,
    colorSteps: 20,
    saturation: 1.12,
    contrast: 1.06,
    dither: 0.1,
    toonBands: 6,
    outlineEnabled: true,
  }),
  retro: defaults("retro", {
    pixelScale: 8,
    colorSteps: 8,
    saturation: 1.1,
    contrast: 1.2,
    dither: 0.45,
    outlineEnabled: true,
    outlineColor: "#171725",
  }),
  arcade: defaults("arcade", {
    pixelScale: 2,
    colorSteps: 16,
    saturation: 1.45,
    contrast: 1.2,
    dither: 0.25,
    outlineEnabled: true,
    outlineColor: "#141329",
  }),
  comic: defaults("comic", {
    colorSteps: 8,
    saturation: 1.5,
    contrast: 1.3,
    toonBands: 2,
    outlineEnabled: true,
    outlineWidth: 3,
  }),
  pastel: defaults("pastel", {
    colorSteps: 32,
    saturation: 0.55,
    contrast: 0.7,
    toonBands: 6,
    outlineEnabled: true,
    outlineColor: "#696581",
  }),
};
export function validateStyleSelection(input: unknown): SpriteStyle[] {
  if (
    !Array.isArray(input) ||
    input.some(
      (style) =>
        typeof style !== "string" || !Object.hasOwn(styleDefinitions, style),
    )
  )
    throw new Error("Unknown style in the selection.");
  return [...new Set(input)] as SpriteStyle[];
}
export function applyStyle(
  recipe: RenderRecipe,
  style: SpriteStyle,
): RenderRecipe {
  return { ...recipe, ...styleDefaults[style] };
}
export function effectivePixelScale(recipe: RenderRecipe) {
  return styleDefinitions[recipe.style].pixelated ? recipe.pixelScale : 1;
}
export function effectiveOutlineWidth(recipe: RenderRecipe) {
  const scale = effectivePixelScale(recipe);
  return recipe.outlineEnabled
    ? Math.ceil(recipe.outlineWidth / scale) * scale
    : 0;
}
export function styledAssetName(stem: string, style: SpriteStyle) {
  const suffix =
    style === "original"
      ? ""
      : `_${styleDefinitions[style].label.replaceAll(" ", "_")}`;
  return stem.slice(0, 80 - suffix.length) + suffix;
}
export function hexRGB(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
const palettes = new Map(
  allStyles.map((style) => [
    style,
    styleDefinitions[style].palette?.map(hexRGB),
  ]),
);
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Fixed palettes and screen-locked dithering remain deterministic across bakes. */
export function gradePixels(
  pixels: Uint8ClampedArray,
  size: number,
  recipe: RenderRecipe,
) {
  if (recipe.style === "original") return;
  const definition = styleDefinitions[recipe.style],
    palette = palettes.get(recipe.style),
    levels = recipe.colorSteps - 1;
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (!a) continue;
    const r = pixels[i] / 255,
      g = pixels[i + 1] / 255,
      b = pixels[i + 2] / 255,
      luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
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
    if (palette) {
      let best = palette[0],
        distance = Infinity;
      for (const entry of palette) {
        const d =
          2 * (entry[0] - pixels[i]) ** 2 +
          3 * (entry[1] - pixels[i + 1]) ** 2 +
          (entry[2] - pixels[i + 2]) ** 2;
        if (d < distance) {
          best = entry;
          distance = d;
        }
      }
      for (let c = 0; c < 3; c++) pixels[i + c] = best[c];
    }
    if (definition.binaryAlpha) {
      pixels[i + 3] = a >= 128 ? 255 : 0;
      if (!pixels[i + 3]) pixels.fill(0, i, i + 3);
    }
  }
}
