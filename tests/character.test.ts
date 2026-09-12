import { describe, expect, it } from "vitest";
import {
  classifyAnimation,
  mapAnimations,
  loopDefault,
  validateMappings,
  estimateCharacter,
  characterMetadata,
} from "../src/features/character/schema";
import { baseRecipe } from "../src/features/recipes/recipes";

describe("Character Forge states", () => {
  it("classifies common names deterministically", () => {
    const names = [
      "Idle_01",
      "Walk_Fwd",
      "Jog",
      "SwordAttack_A",
      "DamageReact",
      "Death_A",
      "Block_Loop",
      "Cast_Spell",
      "Dodge_Roll",
      "Jump",
      "Ability",
      "Interact",
      "Emote",
      "Mystery",
    ];
    expect(names.map(classifyAnimation)).toEqual([
      "Idle",
      "Walk",
      "Run",
      "Attack",
      "Hit",
      "Death",
      "Block",
      "Cast",
      "Dodge",
      "Jump",
      "Ability 1",
      "Interact",
      "Emote",
      "Custom",
    ]);
    expect(
      [
        "Idle",
        "Walk",
        "Run",
        "Block",
        "Attack",
        "Hit",
        "Death",
        "Dodge",
        "Cast",
      ].map(loopDefault),
    ).toEqual([true, true, true, true, false, false, false, false, false]);
  });
  it("maps attack variants, preserves death and validates corrections", () => {
    const states = mapAnimations(
      ["Idle", "SwordAttack_A", "SwordAttack_B", "Death_A"].map((name) => ({
        name,
        duration: 1,
      })),
    );
    expect(states.map((s) => s.name)).toEqual([
      "Idle",
      "Attack",
      "Attack 2",
      "Death",
    ]);
    expect(states[3].returnToDefault).toBe(false);
    expect(validateMappings(states, "Idle")).toHaveLength(4);
    states[1].name = "idle";
    expect(() => validateMappings(states, "Idle")).toThrow("unique");
    states[1].enabled = false;
    expect(validateMappings(states, "Idle")).toHaveLength(3);
    expect(() => validateMappings(states, "Walk")).toThrow("Default");
    expect(() => characterMetadata("Test", "Idle", [])).toThrow();
  });
  it("estimates exact sampled frames and atlas allocation, bounds populations", () => {
    const states = mapAnimations([
      { name: "Idle", duration: 1 },
      { name: "Walk", duration: 0.51 },
    ]);
    const recipe = { ...baseRecipe, fps: 6 };
    const estimate = estimateCharacter(states, recipe, 50);
    expect(estimate.frames).toBe((6 + 4) * 8 * 50);
    expect(estimate.rawBytes).toBeGreaterThan(
      estimate.frames * recipe.cellSize ** 2 * 4,
    );
    expect(() => estimateCharacter(states, recipe, 201)).toThrow("200");
    expect(() =>
      estimateCharacter(states, { ...recipe, cellSize: 1024, fps: 60 }),
    ).toThrow("Atlas");
  });
});

import {
  advancePlayback,
  locomotion,
  selectFrame,
  setState,
} from "../src/features/character/runtime";
import { makeMetadata } from "../src/features/atlas/atlas";
import { characterFiles } from "../src/features/character/build";
function runtimeCharacter() {
  const states = mapAnimations(
    ["Idle", "Walk", "Run", "Attack", "Death"].map((name) => ({
      name,
      duration: 0.6,
    })),
  );
  return characterMetadata(
    "Knight",
    "Idle",
    states.map((s) => ({
      name: s.name,
      clip: s.clipName,
      fps: 4,
      loop: s.loop,
      returnToDefault: s.returnToDefault,
      duration: s.duration,
      frameCount: 3,
      atlas: `${s.name}/Knight.png`,
      metadata: `${s.name}/Knight.json`,
      sprite: makeMetadata(
        "Knight",
        { ...baseRecipe, fps: 4 },
        [0, 0.25, 0.5],
        s.clipName,
        0.8,
        s.duration,
      ),
    })),
  );
}
it("runtime loops at clip duration, holds death, returns attacks and selects camera-relative frames", () => {
  const m = runtimeCharacter();
  expect(
    advancePlayback({ state: "Idle", time: 0.5, finished: false }, 0.2, m).time,
  ).toBeCloseTo(0.1);
  expect(
    advancePlayback({ state: "Attack", time: 0.5, finished: false }, 0.2, m)
      .state,
  ).toBe("Idle");
  expect(
    advancePlayback({ state: "Death", time: 0.5, finished: false }, 0.2, m),
  ).toEqual({ state: "Death", time: 0.6, finished: true });
  expect(selectFrame(m.states[4], 0.6, 90, 0).directionDegrees).toBe(270);
  expect(selectFrame(m.states[4], 0.6, 90, 0).animationFrame).toBe(2);
  expect(selectFrame(m.states[0], 0, 45, 90).directionDegrees).toBe(45);
  expect(locomotion(m, true, true)).toBe("Run");
  expect(
    setState({ state: "Idle", time: 0.4, finished: false }, "Missing", m).time,
  ).toBe(0.4);
});
it("character package includes every atlas and backward-compatible state document", async () => {
  const metadata = runtimeCharacter(),
    atlases = Object.fromEntries(
      metadata.states.map((s) => [s.atlas, new Blob(["png"])]),
    );
  const files = await characterFiles({ metadata, atlases });
  expect(Object.keys(files)).toHaveLength(11);
  expect(
    JSON.parse(new TextDecoder().decode(files["Knight.character.json"])),
  ).toEqual(metadata);
  for (const state of metadata.states)
    expect(JSON.parse(new TextDecoder().decode(files[state.metadata]))).toEqual(
      state.sprite,
    );
});
