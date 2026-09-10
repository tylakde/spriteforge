import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  baseRecipe,
  builtins,
  validateRecipe,
  stylePresets,
  migrateStoredRecipe,
  isRetiredBuiltin,
} from "../features/recipes/recipes";
import type { RenderRecipe } from "../types";
import {
  defaultVariationStyles,
  allStyles,
  validateStyleSelection,
  type SpriteStyle,
} from "../features/styles/styles";
interface State {
  styleCatalogVersion: number;
  styleSelection: SpriteStyle[];
  selectStyles: (styles: SpriteStyle[]) => void;
  recipe: RenderRecipe;
  presets: RenderRecipe[];
  grid: boolean;
  previewBackground: "checker" | "solid";
  outputMode: "all" | "atlas" | "frames";
  update: (patch: Partial<RenderRecipe>) => void;
  setRecipe: (recipe: RenderRecipe) => void;
  savePreset: (name: string) => void;
  renamePreset: (name: string) => void;
  deletePreset: (name: string) => void;
  reset: () => void;
  preferences: (
    patch: Partial<Pick<State, "grid" | "previewBackground" | "outputMode">>,
  ) => void;
}
export const useStore = create<State>()(
  persist(
    (set, get) => ({
      styleCatalogVersion: 3,
      styleSelection: [...defaultVariationStyles],
      selectStyles: (styles) =>
        set({ styleSelection: validateStyleSelection(styles) }),
      recipe: { ...baseRecipe },
      presets: builtins.map((x) => ({ ...x })),
      grid: true,
      previewBackground: "checker",
      outputMode: "all",
      update: (patch) =>
        set({ recipe: validateRecipe({ ...get().recipe, ...patch }) }),
      setRecipe: (recipe) => set({ recipe: validateRecipe(recipe) }),
      savePreset: (name) => {
        const recipe = validateRecipe({ ...get().recipe, name: name.trim() });
        set({
          recipe,
          presets: [
            ...get().presets.filter((p) => p.name !== recipe.name),
            recipe,
          ],
        });
      },
      renamePreset: (name) => {
        const previous = get().recipe.name;
        const recipe = validateRecipe({ ...get().recipe, name: name.trim() });
        set({
          recipe,
          presets: [
            ...get().presets.filter(
              (p) => p.name !== previous && p.name !== recipe.name,
            ),
            recipe,
          ],
        });
      },
      deletePreset: (name) =>
        set({ presets: get().presets.filter((p) => p.name !== name) }),
      reset: () => set({ presets: [...builtins], recipe: { ...baseRecipe } }),
      preferences: (patch) => set(patch),
    }),
    {
      name: "spriteforge-v1",
      partialize: ({
        recipe,
        presets,
        grid,
        previewBackground,
        outputMode,
        styleSelection,
        styleCatalogVersion,
      }) => ({
        recipe,
        presets,
        grid,
        previewBackground,
        outputMode,
        styleSelection,
        styleCatalogVersion,
      }),
      merge: (saved, current) => {
        try {
          const s = saved as State;
          const remainingPresets = s.presets
            .filter((p) => !isRetiredBuiltin(p))
            .map(migrateStoredRecipe);
          const selection = Array.isArray(s.styleSelection)
            ? s.styleSelection.filter((style) => allStyles.includes(style))
            : [...defaultVariationStyles];
          return {
            ...current,
            recipe: migrateStoredRecipe(s.recipe),
            styleSelection:
              selection.length === 0 && s.styleSelection?.length > 0
                ? [...defaultVariationStyles]
                : validateStyleSelection(selection),
            presets: [
              ...remainingPresets,
              ...(s.styleCatalogVersion !== 3
                ? stylePresets.filter(
                    (p) =>
                      !remainingPresets.some((saved) => saved.name === p.name),
                  )
                : []),
            ],
            grid: typeof s.grid === "boolean" ? s.grid : true,
            previewBackground:
              s.previewBackground === "solid" ? "solid" : "checker",
            outputMode: ["all", "atlas", "frames"].includes(s.outputMode)
              ? s.outputMode
              : "all",
          } as State;
        } catch {
          return current;
        }
      },
    },
  ),
);
