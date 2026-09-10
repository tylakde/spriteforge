import type { AssetSource, Generation, RenderRecipe } from "../../types";
import { disposeGeneration, renderSequence } from "../generation/generate";
import {
  applyStyle,
  effectiveOutlineWidth,
  styleDefinitions,
  defaultVariationStyles,
  validateStyleSelection,
  type SpriteStyle,
} from "./styles";
import { loadAsset } from "../assets/loadAsset";
import { sampleTimes } from "../../lib/math";
export function validateVariationBudget(
  frames: number,
  cellSize: number,
  styles: number,
) {
  if (frames * cellSize * cellSize * styles > 128 * 1024 * 1024)
    throw new Error(
      "Style selection exceeds the 128-megapixel output budget. Reduce cell size, FPS, directions or selected styles.",
    );
}
export async function renderVariationSets(
  source: AssetSource,
  recipe: RenderRecipe,
  clipIndex: number | null,
  onProgress: (value: number, label: string) => void,
  signal: AbortSignal,
  selectedStyles: readonly SpriteStyle[] = defaultVariationStyles,
) {
  const styles = validateStyleSelection(selectedStyles);
  if (!styles.length) throw new Error("Select at least one style to bake.");
  if (signal.aborted) throw new Error("Generation cancelled.");
  onProgress(0, "Checking style selection");
  if (clipIndex !== null) {
    const asset = await loadAsset(source);
    try {
      const clip = asset.animations[clipIndex];
      if (!clip) throw new Error("Selected animation is missing.");
      validateVariationBudget(
        sampleTimes(clip.duration, recipe.fps).length * recipe.directionCount,
        recipe.cellSize,
        styles.length,
      );
    } finally {
      asset.dispose();
    }
  } else
    validateVariationBudget(
      recipe.directionCount,
      recipe.cellSize,
      styles.length,
    );
  const recipes = styles.map((style) => applyStyle(recipe, style));
  // Reserve the same silhouette margin in every set; record it so individual re-bakes reproduce the comparison.
  const framingOutlineWidth = Math.max(...recipes.map(effectiveOutlineWidth));
  const results: Generation[] = [];
  try {
    for (let i = 0; i < recipes.length; i++) {
      const variant = { ...recipes[i], framingOutlineWidth };
      results.push(
        await renderSequence(
          source,
          variant,
          clipIndex,
          (value, label) =>
            onProgress(
              (i + value) / recipes.length,
              `${styleDefinitions[variant.style].label}: ${label}`,
            ),
          signal,
        ),
      );
    }
    return results;
  } catch (error) {
    results.forEach(disposeGeneration);
    throw error;
  }
}
