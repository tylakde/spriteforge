import { AnimationMixer, Box3 } from "three";
import type { AssetSource, LoadedAsset, RenderRecipe } from "../../types";
import { loadAsset } from "../assets/loadAsset";
import { disposeGeneration, renderSequence } from "../generation/generate";
import { safeName, sampleTimes, yieldToUI } from "../../lib/math";
import {
  characterMetadata,
  estimateCharacter,
  validateMappings,
  type CharacterMetadata,
  type CharacterState,
  type StateMapping,
} from "./schema";
import { writeExport } from "../export/export";
export interface CharacterBuild {
  metadata: CharacterMetadata;
  atlases: Record<string, Blob>;
}
export async function buildCharacter(
  source: AssetSource,
  recipe: RenderRecipe,
  mappings: StateMapping[],
  defaultState: string,
  progress: (value: number, label: string) => void,
  signal?: AbortSignal,
  loader: () => Promise<LoadedAsset> = () => loadAsset(source),
  name = safeName(source.name),
): Promise<CharacterBuild> {
  const selected = validateMappings(mappings, defaultState);
  const fixedRecipe = {
    ...recipe,
    anchor: "ground" as const,
    background: "transparent" as const,
  };
  estimateCharacter(selected, fixedRecipe);
  const check = () => {
    if (signal?.aborted) throw new Error("Character build cancelled.");
  };
  check();
  progress(0, "Measuring all animation states");
  const asset = await loader();
  const mixer = new AnimationMixer(asset.root),
    bounds = new Box3();
  try {
    for (const [i, mapping] of selected.entries()) {
      check();
      const clip = asset.animations[mapping.clipIndex];
      if (
        !clip ||
        clip.name !== mapping.clipName ||
        Math.abs(clip.duration - mapping.duration) > 0.00001
      )
        throw new Error(
          "Animations changed. Inspect and map the character again.",
        );
      mixer.stopAllAction();
      mixer.clipAction(clip).reset().play();
      const times = sampleTimes(clip.duration, fixedRecipe.fps);
      for (let t = 0; t < times.length; t++) {
        check();
        mixer.setTime(times[t]);
        asset.root.updateMatrixWorld(true);
        bounds.union(new Box3().setFromObject(asset.root, true));
        if (t % 8 === 0) {
          progress(
            (0.1 * (i + t / times.length)) / selected.length,
            `Measuring ${mapping.name}`,
          );
          await yieldToUI();
        }
      }
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(asset.root);
    const states: CharacterState[] = [],
      atlases: Record<string, Blob> = {};
    for (const [i, mapping] of selected.entries()) {
      check();
      const generation = await renderSequence(
        source,
        fixedRecipe,
        mapping.clipIndex,
        (value, label) =>
          progress(
            0.1 + (0.9 * (i + value)) / selected.length,
            `${mapping.name}: ${label}`,
          ),
        signal,
        {
          load: async () => ({ ...asset, dispose: () => {} }),
          bounds,
          atlasOnly: true,
        },
      );
      const stem = safeName(`${safeName(name)}_${safeName(mapping.name)}`),
        folder = safeName(mapping.name);
      generation.metadata.asset = stem;
      generation.metadata.atlas.file = `${stem}_Atlas.png`;
      const atlas = `${folder}/${generation.metadata.atlas.file}`;
      atlases[atlas] = generation.atlas;
      states.push({
        name: mapping.name,
        clip: mapping.clipName,
        fps: fixedRecipe.fps,
        loop: mapping.loop,
        returnToDefault: mapping.returnToDefault,
        duration: mapping.duration,
        frameCount: sampleTimes(mapping.duration, fixedRecipe.fps).length,
        atlas,
        metadata: `${folder}/${stem}.json`,
        sprite: generation.metadata,
      });
      disposeGeneration(generation);
    }
    check();
    progress(1, "Character ready — play test or send to Unreal");
    return { metadata: characterMetadata(name, defaultState, states), atlases };
  } finally {
    mixer.stopAllAction();
    mixer.uncacheRoot(asset.root);
    asset.dispose();
  }
}
export async function characterFiles(build: CharacterBuild) {
  const encode = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value, null, 2));
  const files: Record<string, Uint8Array> = {
    [`${build.metadata.name}.character.json`]: encode(build.metadata),
  };
  for (const state of build.metadata.states) {
    files[state.atlas] = new Uint8Array(
      await build.atlases[state.atlas].arrayBuffer(),
    );
    files[state.metadata] = encode(state.sprite);
  }
  return files;
}
export async function exportCharacter(
  build: CharacterBuild,
  directory?: string | null,
) {
  return writeExport(
    await characterFiles(build),
    build.metadata.name,
    `${build.metadata.name}_character.zip`,
    directory,
  );
}
