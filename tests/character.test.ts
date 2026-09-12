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
