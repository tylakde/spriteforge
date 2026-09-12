import { describe, expect, it } from "vitest";
import {
  Bone,
  Group,
  SkinnedMesh,
  BoxGeometry,
  MeshBasicMaterial,
} from "three";
import {
  compatibility,
  defaultAttachment,
  detectSlot,
  parseLoadout,
  serializeLoadout,
  skeletonInfo,
  validateAttachment,
  type FactoryAsset,
  type Loadout,
  type PartSelection,
} from "../src/features/character/factory";
import {
  emptyTemplate,
  generatePopulation,
  partSignature,
} from "../src/features/character/population";
import { baseRecipe } from "../src/features/recipes/recipes";
import { mapAnimations } from "../src/features/character/schema";
function rig(reverse = false) {
  const root = new Group(),
    hips = new Bone(),
    hand = new Bone(),
    foot = new Bone();
  hips.name = "Hips";
  hand.name = "Hand";
  foot.name = "Foot";
  root.add(hips);
  hips.add(...(reverse ? [foot, hand] : [hand, foot]));
  return root;
}
function asset(id: string, slot = "Chest", tags: string[] = []): FactoryAsset {
  return {
    id,
    source: { id, name: `${id}.glb` } as FactoryAsset["source"],
    slot,
    tags,
    faction: "",
    style: "",
    bodyType: "",
    skeleton: {
      signature: "rig",
      bones: ["Hips", "Hand"],
      skinned: false,
      meshes: 1,
    },
    attachment: defaultAttachment(),
    animations: [],
  };
}
describe("modular character factory", () => {
  it("bone hierarchy signatures are deterministic and reject ambiguity", () => {
    expect(skeletonInfo(rig()).signature).toBe(
      skeletonInfo(rig(true)).signature,
    );
    const changed = rig();
    changed.add(changed.getObjectByName("Hand")!);
    expect(skeletonInfo(changed).signature).not.toBe(
      skeletonInfo(rig()).signature,
    );
    const ambiguous = rig(),
      duplicate = new Bone();
    duplicate.name = "Hand";
    ambiguous.add(duplicate);
    expect(() => skeletonInfo(ambiguous)).toThrow("unique");
    const r = rig();
    r.add(new SkinnedMesh(new BoxGeometry(), new MeshBasicMaterial()));
    expect(skeletonInfo(r).skinned).toBe(true);
  });
  it("detects slots and validates skeleton/socket compatibility", () => {
    expect(
      [
        "Helmet_Iron_01.glb",
        "Weapon_Sword_04.glb",
        "Boots_Leather_02.glb",
        "Head_A.glb",
        "Shield.glb",
      ].map(detectSlot),
    ).toEqual(["Helmet", "Main Weapon", "Boots", "Head / Face", "Offhand"]);
    const base = asset("base").skeleton,
      part = { ...base, skinned: true };
    expect(
      compatibility(base, part, { ...defaultAttachment(), mode: "skinned" }),
    ).toBeNull();
    expect(
      compatibility(
        base,
        { ...part, signature: "orc" },
        { ...defaultAttachment(), mode: "skinned" },
      ),
    ).toContain("mismatch");
    expect(
      compatibility(base, base, {
        ...defaultAttachment(),
        mode: "socket",
        bone: "Hand",
      }),
    ).toBeNull();
    expect(
      compatibility(base, base, {
        ...defaultAttachment(),
        mode: "socket",
        bone: "Missing",
      }),
    ).toContain("Missing");
  });
  it("roundtrips complete loadouts and transforms and rejects unsupported data", () => {
    const a = {
      ...defaultAttachment(),
      mode: "socket" as const,
      bone: "Hand",
      position: [0.1, 0.2, 0.3] as [number, number, number],
      rotation: [0, 90, 0] as [number, number, number],
    };
    const loadout: Loadout = {
      format: "spriteforge-loadout",
      version: 1,
      name: "Knight",
      baseId: "base",
      animationId: "library",
      parts: [
        { slot: "Main Weapon", assetId: "sword", attachment: a, locked: true },
      ],
      mappings: mapAnimations([{ name: "Idle", duration: 1 }]),
      defaultState: "Idle",
      recipe: baseRecipe,
      assets: [{ id: "base", file: "Base.glb" }],
    };
    expect(parseLoadout(serializeLoadout(loadout))).toEqual(loadout);
    expect(() =>
      parseLoadout(JSON.stringify({ ...loadout, version: 2 })),
    ).toThrow();
    expect(() =>
      parseLoadout(
        JSON.stringify({
          ...loadout,
          parts: [...loadout.parts, ...loadout.parts],
        }),
      ),
    ).toThrow("duplicate");
    expect(() => validateAttachment({ ...a, scale: [1, 0, 1] })).toThrow(
      "positive",
    );
    expect(() => validateAttachment({ ...a, position: [NaN, 0, 0] })).toThrow(
      "finite",
    );
    expect(() => validateAttachment({ ...a, mode: "skinned" })).toThrow(
      "identity",
    );
  });
  it("respects tags, explicit pools, compatibility and locks", () => {
    const base = asset("base", "Base Body"),
      iron = asset("iron", "Chest", ["guard"]),
      gold = asset("gold", "Chest", ["guard"]),
      forbidden = asset("forbidden", "Chest", ["guard", "mage"]),
      weapon = asset("weapon", "Main Weapon");
    const incompatible = {
      ...asset("orc"),
      skeleton: { ...base.skeleton, signature: "orc", skinned: true },
      attachment: { ...defaultAttachment(), mode: "skinned" as const },
    };
    const locked: PartSelection = {
      slot: "Main Weapon",
      assetId: "weapon",
      attachment: defaultAttachment(),
      locked: true,
    };
    const template = {
      ...emptyTemplate(),
      allowedTags: ["guard"],
      disallowedTags: ["mage"],
      allowedAssets: { Chest: ["iron"] },
    };
    const result = generatePopulation(
      base,
      [iron, gold, forbidden, weapon, incompatible],
      [locked],
      ["Chest", "Main Weapon"],
      template,
      50,
      42,
    );
    expect(result.parts).toHaveLength(1);
    expect(result.exhausted).toBe(true);
    expect(result.parts[0]).toContainEqual(locked);
    expect(result.parts[0].find((p) => p.slot === "Chest")?.assetId).toBe(
      "iron",
    );
  });
  it("generates reproducible unique populations without enumerating cross products", () => {
    const base = asset("base"),
      library = Array.from({ length: 60 }, (_, i) =>
        asset(`part${i}`, `slot${Math.floor(i / 10)}`),
      );
    const randomSlots = Array.from({ length: 6 }, (_, i) => `slot${i}`);
    const result = generatePopulation(
      base,
      library,
      [],
      randomSlots,
      emptyTemplate(),
      200,
      7,
    );
    expect(result.capacity).toBe("1000000");
    expect(result.parts).toHaveLength(200);
    expect(new Set(result.parts.map(partSignature)).size).toBe(200);
    expect(
      generatePopulation(
        base,
        library,
        [],
        randomSlots,
        emptyTemplate(),
        200,
        7,
      ).parts,
    ).toEqual(result.parts);
    const again = generatePopulation(
      base,
      library,
      [],
      randomSlots,
      emptyTemplate(),
      200,
      7,
      new Set(result.parts.map(partSignature)),
    );
    expect(
      again.parts.some((p) =>
        result.parts.some((old) => partSignature(old) === partSignature(p)),
      ),
    ).toBe(false);
    expect(() =>
      generatePopulation(
        base,
        library,
        [],
        randomSlots,
        emptyTemplate(),
        201,
        7,
      ),
    ).toThrow("200");
  });
  it("fails clearly for empty or completely locked pools", () => {
    expect(() =>
      generatePopulation(
        asset("base"),
        [],
        [],
        ["Hair"],
        emptyTemplate(),
        1,
        1,
      ),
    ).toThrow("No compatible");
    expect(() =>
      generatePopulation(asset("base"), [], [], [], emptyTemplate(), 1, 1),
    ).toThrow("unlocked");
  });
});

import { assetFingerprint } from "../src/features/character/factory";
it("portable GLTF fingerprints include external resource contents", async () => {
  const file = new File(
    [JSON.stringify({ buffers: [{ uri: "mesh.bin" }] })],
    "Body.gltf",
  );
  const source = {
    id: "source",
    name: file.name,
    file,
    files: [file, new File(["first"], "mesh.bin")],
  };
  const first = await assetFingerprint(source);
  expect(await assetFingerprint({ ...source, id: "another-session" })).toBe(
    first,
  );
  expect(
    await assetFingerprint({
      ...source,
      files: [file, new File(["second"], "mesh.bin")],
    }),
  ).not.toBe(first);
});
