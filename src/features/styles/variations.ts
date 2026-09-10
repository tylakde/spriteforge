import type { AssetSource, Generation, RenderRecipe } from "../../types";
import { disposeGeneration, renderSequence } from "../generation/generate";
import {
  applyStyle,
  effectiveOutlineWidth,
  styleDefinitions,
  variationStyles,
} from "./styles";
export async function renderVariationSets(
  source: AssetSource,
  recipe: RenderRecipe,
  clipIndex: number | null,
  onProgress: (value: number, label: string) => void,
  signal: AbortSignal,
) {
  const recipes = variationStyles.map((style) => applyStyle(recipe, style));
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
