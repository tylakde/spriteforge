import type { Metadata, RenderRecipe } from "../../types";
import { sampleTimes, safeName } from "../../lib/math";
import { makeMetadata } from "../atlas/atlas";

export const coreStates = ["Idle", "Walk", "Run", "Attack", "Hit", "Death"];
export const stateNames = [
  ...coreStates,
  "Attack 2",
  "Attack 3",
  "Block",
  "Dodge",
  "Jump",
  "Cast",
  "Ability 1",
  "Ability 2",
  "Interact",
  "Emote",
];
export interface StateMapping {
  name: string;
  clipIndex: number;
  clipName: string;
  duration: number;
  enabled: boolean;
  loop: boolean;
  returnToDefault: boolean;
}
export interface CharacterState {
  name: string;
  clip: string;
  fps: number;
  loop: boolean;
  returnToDefault: boolean;
  duration: number;
  frameCount: number;
  atlas: string;
  metadata: string;
  sprite: Metadata;
}
export interface CharacterMetadata {
  format: "spriteforge-character";
  version: 1;
  name: string;
  defaultState: string;
  directions: number[];
  frontDirection: number;
  coordinateSystem: string;
  anchor: Metadata["anchor"];
  recipe: RenderRecipe;
  states: CharacterState[];
}
export function loopDefault(state: string) {
  return ["Idle", "Walk", "Run", "Block"].includes(state);
}
export function classifyAnimation(name: string): string {
  const text = name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  // Specific reactions precede broad combat terms (e.g. SwordAttack / DamageReact).
  const rules: [string, RegExp][] = [
    ["Death", /death|dead|dying|die(?:\b|_)/],
    ["Hit", /damage|react|hurt|hit|stagger/],
    ["Dodge", /dodge|roll|evade/],
    ["Block", /block|defend|guard/],
    ["Attack", /attack|strike|slash|punch|shoot|swing/],
    ["Run", /run|jog|sprint/],
    ["Walk", /walk|locomotion/],
    ["Idle", /idle|stand|breath/],
    ["Jump", /jump|leap/],
    ["Cast", /cast|spell/],
    ["Ability 2", /(?:ability|skill)[ _-]*0?2(?:\D|$)/],
    ["Ability 1", /ability|skill/],
    ["Interact", /interact|use|pickup/],
    ["Emote", /emote|dance|wave|taunt/],
  ];
  return rules.find(([, regex]) => regex.test(text))?.[0] ?? "Custom";
}
export function mapAnimations(
  clips: { name: string; duration: number }[],
): StateMapping[] {
  const used = new Set<string>();
  return clips.map((clip, clipIndex) => {
    let base = classifyAnimation(clip.name);
    if (base === "Custom") {
      base = safeName(clip.name).slice(0, 58);
      if (!/^[A-Za-z]/.test(base)) base = `Custom ${base}`.slice(0, 58);
    }
    let name = base,
      suffix = 2;
    while (used.has(name.toLowerCase()))
      name = `${base.replace(/ 1$/, "")} ${suffix++}`;
    used.add(name.toLowerCase());
    return {
      name,
      clipIndex,
      clipName: clip.name,
      duration: clip.duration,
      enabled: true,
      loop: loopDefault(base),
      returnToDefault: base !== "Death",
    };
  });
}
export function validateMappings(
  mappings: StateMapping[],
  defaultState: string,
) {
  const selected = mappings.filter((m) => m.enabled);
  if (selected.length > 256)
    throw new Error("Characters support at most 256 states.");
  if (!selected.length) throw new Error("Select at least one animation state.");
  const names = new Set<string>();
  for (const state of selected) {
    if (
      !/^[A-Za-z][A-Za-z0-9 _-]{0,63}$/.test(state.name) ||
      names.has(state.name.toLowerCase())
    )
      throw new Error(
        "State names must be unique, start with a letter and use letters, numbers, spaces, _ or - (64 characters maximum).",
      );
    if (!Number.isInteger(state.clipIndex) || state.clipIndex < 0)
      throw new Error("Invalid animation selection.");
    sampleTimes(state.duration, 1);
    names.add(state.name.toLowerCase());
  }
  // Paths must also remain unique after sanitising names.
  if (
    new Set(selected.map((s) => safeName(s.name).toLowerCase())).size !==
    selected.length
  )
    throw new Error("State names produce duplicate export paths.");
  if (!selected.some((s) => s.name === defaultState))
    throw new Error("Default state must be included in the build.");
  return selected;
}
export function characterMetadata(
  name: string,
  defaultState: string,
  states: CharacterState[],
): CharacterMetadata {
  if (!states.length || !states.some((s) => s.name === defaultState))
    throw new Error("Character has no valid default state.");
  const first = states[0].sprite;
  for (const state of states) {
    if (
      JSON.stringify(state.sprite.anchor) !== JSON.stringify(first.anchor) ||
      JSON.stringify(state.sprite.directions) !==
        JSON.stringify(first.directions) ||
      JSON.stringify(state.sprite.recipe) !== JSON.stringify(first.recipe)
    )
      throw new Error("All character states must share framing and recipe.");
  }
  return {
    format: "spriteforge-character",
    version: 1,
    name: safeName(name),
    defaultState,
    directions: first.directions,
    frontDirection: first.frontDirection,
    coordinateSystem: first.coordinateSystem,
    anchor: first.anchor,
    recipe: first.recipe,
    states,
  };
}
export function estimateCharacter(
  mappings: StateMapping[],
  recipe: RenderRecipe,
  count = 1,
) {
  if (!Number.isInteger(count) || count < 1 || count > 200)
    throw new Error("Choose 1–200 characters per population.");
  let frames = 0,
    bytes = 0,
    peakBytes = 0;
  for (const state of mappings.filter((s) => s.enabled)) {
    const times = sampleTimes(state.duration, recipe.fps);
    const m = makeMetadata(
      "Estimate",
      recipe,
      times,
      state.clipName,
      0.5,
      state.duration,
    );
    frames += m.frames.length;
    const atlasBytes = m.atlas.width * m.atlas.height * 4;
    bytes += atlasBytes;
    peakBytes = Math.max(
      peakBytes,
      atlasBytes + m.frames.length * recipe.cellSize ** 2 * 4,
    );
  }
  if (!frames) throw new Error("Select at least one animation state.");
  return {
    jobs: count,
    states: mappings.filter((s) => s.enabled).length * count,
    frames: frames * count,
    rawBytes: bytes * count,
    peakBytes,
    large: frames * count > 10000 || bytes * count > 512 * 1024 ** 2,
  };
}
export const npcProfiles = {
  "Background Civilian": {
    states: ["Idle", "Walk"],
    directionCount: 8,
    cellSize: 128,
  },
  "Standard NPC": {
    states: ["Idle", "Walk", "Run", "Hit"],
    directionCount: 8,
    cellSize: 256,
  },
  "Combat NPC": { states: coreStates, directionCount: 8, cellSize: 256 },
  "Hero / Boss": { states: null, directionCount: 16, cellSize: 512 },
} as const;
