import {
  Bone,
  Box3,
  Euler,
  Group,
  Mesh,
  PropertyBinding,
  Skeleton,
  SkinnedMesh,
  Vector3,
  type Object3D,
} from "three";
import { loadAsset } from "../assets/loadAsset";
import type { AssetSource, LoadedAsset, RenderRecipe } from "../../types";
import { validateRecipe } from "../recipes/recipes";
import { validateMappings, type StateMapping } from "./schema";
export const slots = [
  "Base Body",
  "Head / Face",
  "Hair",
  "Helmet",
  "Chest",
  "Gloves",
  "Legs",
  "Boots",
  "Main Weapon",
  "Offhand",
  "Back",
  "Accessory 1",
  "Accessory 2",
];
export interface SkeletonInfo {
  signature: string;
  bones: string[];
  skinned: boolean;
  meshes: number;
}
export interface Attachment {
  mode: "skinned" | "socket" | "fixed";
  bone: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}
export const defaultAttachment = (): Attachment => ({
  mode: "fixed",
  bone: "",
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
});
export interface FactoryAsset {
  id: string;
  source: AssetSource;
  slot: string;
  tags: string[];
  faction: string;
  style: string;
  bodyType: string;
  skeleton: SkeletonInfo;
  attachment: Attachment;
  animations: { name: string; duration: number }[];
}
export interface PartSelection {
  slot: string;
  assetId: string;
  attachment: Attachment;
  locked: boolean;
}
export interface Loadout {
  format: "spriteforge-loadout";
  version: 1;
  name: string;
  baseId: string;
  parts: PartSelection[];
  animationId: string | null;
  mappings: StateMapping[];
  defaultState: string;
  recipe: RenderRecipe;
  assets: { id: string; file: string }[];
}
export function skeletonInfo(
  root: Object3D,
  animations: LoadedAsset["animations"] = [],
): SkeletonInfo {
  let skinned = false,
    meshes = 0;
  const joints = new Set<Object3D>();
  root.traverse((o) => {
    if (o instanceof Bone) joints.add(o);
    if (o instanceof SkinnedMesh) skinned = true;
    if (o instanceof Mesh) meshes++;
  });
  // GLTFLoader only marks joints as Bone when a skin references them. Animation-only
  // GLTFs can instead contain plain nodes; inspect their animated hierarchy.
  if (!joints.size && !meshes) {
    for (const clip of animations)
      for (const track of clip.tracks) {
        const name = PropertyBinding.parseTrackName(track.name).nodeName;
        const target = name ? root.getObjectByName(name) : undefined;
        target?.traverse((o) => {
          if (!(o instanceof Mesh)) joints.add(o);
        });
      }
  }
  const bones = [...joints].map((o) => o.name);
  if (new Set(bones).size !== bones.length || bones.some((b) => !b))
    throw new Error("Skeleton requires unique, named bones.");
  const entries = [...joints].map((o) =>
    JSON.stringify([
      o.name,
      o.parent && joints.has(o.parent) ? o.parent.name : "",
      ...[
        ...o.position.toArray(),
        ...o.quaternion.toArray(),
        ...o.scale.toArray(),
      ].map((v) => Math.round(v * 1e6) / 1e6),
    ]),
  );
  return {
    signature: entries.sort().join("|"),
    bones: bones.sort(),
    skinned,
    meshes,
  };
}
export function detectSlot(name: string) {
  const text = name.toLowerCase();
  const rules: [string, RegExp][] = [
    ["Head / Face", /head|face/],
    ["Hair", /hair/],
    ["Helmet", /helmet|helm|hat/],
    ["Chest", /chest|torso|armour|armor|robe/],
    ["Gloves", /glove|gauntlet/],
    ["Legs", /legs|pants|trouser/],
    ["Boots", /boots|shoes/],
    ["Offhand", /shield|offhand/],
    ["Main Weapon", /weapon|sword|spear|staff|axe/],
    ["Back", /back|cape|cloak/],
    ["Base Body", /body|base|human|orc/],
  ];
  return rules.find(([, r]) => r.test(text))?.[0] ?? "Accessory 1";
}
export function compatibility(
  base: SkeletonInfo,
  part: SkeletonInfo,
  attachment: Attachment,
): string | null {
  if (attachment.mode === "skinned") {
    if (!part.skinned)
      return "This asset has no skinned mesh. Choose fixed or socket attachment.";
    if (!base.signature || base.signature !== part.signature)
      return `Skeleton mismatch. Expected ${base.bones.join(", ") || "no skeleton"}; found ${part.bones.join(", ") || "no skeleton"}.`;
  } else {
    if (part.skinned)
      return "Skinned equipment must use shared-skeleton attachment.";
    if (attachment.mode === "socket" && !base.bones.includes(attachment.bone))
      return `Missing bone/socket: ${attachment.bone || "choose a bone"}.`;
  }
  return null;
}
export async function assetFingerprint(source: AssetSource) {
  const digest = async (file: File) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
  const main = await digest(source.file);
  if (!/\.gltf$/i.test(source.name)) return main;
  const doc = JSON.parse(await source.file.text());
  const uris = [
    ...new Set<string>(
      [...(doc.buffers ?? []), ...(doc.images ?? [])]
        .map((r: { uri?: string }) => r.uri)
        .filter(
          (uri: unknown): uri is string =>
            typeof uri === "string" && !uri.startsWith("data:"),
        ),
    ),
  ].sort();
  const path = source.file.webkitRelativePath || source.name,
    dir = path.slice(0, path.lastIndexOf("/") + 1);
  const dependencies = await Promise.all(
    uris.map(async (uri) => {
      const decoded = decodeURIComponent(uri),
        relative = new URL(decoded, "https://local/" + dir).pathname.slice(1);
      const file =
        source.files.find(
          (f) => (f.webkitRelativePath || f.name) === relative,
        ) ?? source.files.find((f) => f.name === decoded.split("/").pop());
      if (!file) throw new Error(`Missing resource: ${uri}`);
      return `${uri}:${await digest(file)}`;
    }),
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode([main, ...dependencies].join("|")),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function inspectFactoryAsset(
  source: AssetSource,
): Promise<FactoryAsset> {
  const asset = await loadAsset(source, { raw: true, animationOnly: true });
  try {
    const skeleton = skeletonInfo(asset.root, asset.animations);
    const id = await assetFingerprint(source);
    return {
      id,
      source,
      slot: detectSlot(source.file.webkitRelativePath || source.name),
      tags: [],
      faction: "",
      style: "",
      bodyType: "",
      skeleton,
      attachment: {
        ...defaultAttachment(),
        mode: skeleton.skinned ? "skinned" : "fixed",
      },
      animations: asset.animations.map((a) => ({
        name: a.name,
        duration: a.duration,
      })),
    };
  } finally {
    asset.dispose();
  }
}
export function validateAttachment(a: Attachment) {
  if (
    !a ||
    !["skinned", "socket", "fixed"].includes(a.mode) ||
    typeof a.bone !== "string"
  )
    throw new Error("Invalid attachment mode or bone.");
  for (const key of ["position", "rotation", "scale"] as const)
    if (
      !Array.isArray(a[key]) ||
      a[key].length !== 3 ||
      a[key].some((v) => !Number.isFinite(v)) ||
      (key === "scale" && a[key].some((v) => v <= 0))
    )
      throw new Error(
        "Attachment transforms require finite XYZ values and positive scales.",
      );
  if (
    a.mode === "skinned" &&
    ([...a.position, ...a.rotation].some((v) => v !== 0) ||
      a.scale.some((v) => v !== 1))
  )
    throw new Error(
      "Shared-skeleton equipment uses its authored bind transform; use identity XYZ transforms.",
    );
}
export async function assembleCharacter(
  base: FactoryAsset,
  parts: PartSelection[],
  library: FactoryAsset[],
  animationId: string | null,
): Promise<LoadedAsset> {
  const owned: LoadedAsset[] = [],
    skeletons: Skeleton[] = [];
  try {
    const asset = await loadAsset(base.source, { raw: true });
    owned.push(asset);
    const root = asset.root,
      baseInfo = skeletonInfo(root),
      bones = new Map<string, Bone>();
    root.traverse((o) => {
      if (o instanceof Bone) bones.set(o.name, o);
    });
    const occupied = new Set<string>();
    for (const selection of parts) {
      if (occupied.has(selection.slot))
        throw new Error(`Multiple assets selected for ${selection.slot}.`);
      occupied.add(selection.slot);
      validateAttachment(selection.attachment);
      const item = library.find((a) => a.id === selection.assetId);
      if (!item)
        throw new Error(
          `Missing asset in ${selection.slot}. Reimport the loadout's source files.`,
        );
      const issue = compatibility(
        baseInfo,
        item.skeleton,
        selection.attachment,
      );
      if (issue) throw new Error(`${item.source.name}: ${issue}`);
      const loaded = await loadAsset(item.source, { raw: true });
      owned.push(loaded);
      const a = selection.attachment,
        group = new Group();
      group.name = `Equipment_${selection.slot}`;
      group.position.fromArray(a.position);
      group.rotation.copy(
        new Euler(
          ...(a.rotation.map((v) => (v * Math.PI) / 180) as [
            number,
            number,
            number,
          ]),
        ),
      );
      group.scale.fromArray(a.scale);
      if (a.mode === "skinned") {
        const meshes: SkinnedMesh[] = [];
        loaded.root.traverse((o) => {
          if (o instanceof SkinnedMesh) meshes.push(o);
        });
        for (const mesh of meshes) {
          for (const [i, bone] of mesh.skeleton.bones.entries()) {
            const expected = bones.get(bone.name)?.matrixWorld.clone().invert();
            if (
              !expected ||
              expected.elements.some(
                (v, j) =>
                  Math.abs(v - mesh.skeleton.boneInverses[i].elements[j]) >
                  0.0001,
              )
            )
              throw new Error(
                `Bind pose mismatch for ${bone.name}. Equipment must use the base's authored bind pose.`,
              );
          }
          const rebound = new Skeleton(
            mesh.skeleton.bones.map((b) => {
              const target = bones.get(b.name);
              if (!target) throw new Error(`Missing base bone: ${b.name}`);
              return target;
            }),
            mesh.skeleton.boneInverses.map((m) => m.clone()),
          );
          skeletons.push(rebound);
          const bindMatrix = mesh.bindMatrix.clone();
          loaded.root.attach(mesh);
          mesh.bind(rebound, bindMatrix);
        }
        const equipmentBones: Bone[] = [];
        loaded.root.traverse((o) => {
          if (o instanceof Bone) equipmentBones.push(o);
        });
        equipmentBones.forEach((b) => b.removeFromParent());
      }
      // Disambiguate equipment nodes so base animation bindings never target an attachment by accident.
      loaded.root.traverse((o) => {
        o.name = `${selection.slot}_${o.uuid}`;
      });
      group.add(loaded.root);
      (a.mode === "socket" ? bones.get(a.bone)! : root).add(group);
    }
    if (animationId) {
      const libraryAsset = library.find((a) => a.id === animationId);
      if (!libraryAsset)
        throw new Error("Missing animation library. Reimport it.");
      if (
        !baseInfo.signature ||
        baseInfo.signature !== libraryAsset.skeleton.signature
      )
        throw new Error(
          "Animation library skeleton mismatch. Universal retargeting is not supported.",
        );
      const animation = await loadAsset(libraryAsset.source, {
        raw: true,
        animationOnly: true,
      });
      owned.push(animation);
      // Only bone animation tracks are portable between compatible appearances.
      for (const clip of animation.animations)
        for (const track of clip.tracks) {
          const node = PropertyBinding.parseTrackName(track.name).nodeName;
          if (!node || !bones.has(node))
            throw new Error(
              `Animation library track ${track.name} does not target a shared bone.`,
            );
        }
      asset.animations = animation.animations.map((c) => c.clone());
    }
    root.updateMatrixWorld(true);
    const originalBounds = new Box3().setFromObject(root, true);
    // Normalize the assembled base once using its own origin, never each attachment separately.
    const baseBounds = asset.bounds,
      center = baseBounds.getCenter(new Vector3());
    const wrapper = new Group();
    wrapper.position.set(-center.x, -baseBounds.min.y, -center.z);
    wrapper.add(root);
    const normalized = new Group();
    normalized.add(wrapper);
    normalized.updateMatrixWorld(true);
    const bounds = originalBounds.translate(wrapper.position);
    return {
      ...asset,
      root: normalized,
      bounds,
      stats: {
        ...asset.stats,
        dimensions: bounds.getSize(new Vector3()).toArray() as [
          number,
          number,
          number,
        ],
      },
      dispose: () => {
        skeletons.forEach((s) => s.dispose());
        owned.forEach((a) => a.dispose());
      },
    };
  } catch (e) {
    skeletons.forEach((s) => s.dispose());
    owned.forEach((a) => a.dispose());
    throw e;
  }
}
export function serializeLoadout(loadout: Loadout) {
  parseLoadout(JSON.stringify(loadout));
  return JSON.stringify(loadout, null, 2);
}
export function parseLoadout(text: string): Loadout {
  const value = JSON.parse(text) as Loadout;
  if (
    !value ||
    value.format !== "spriteforge-loadout" ||
    value.version !== 1 ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    typeof value.baseId !== "string" ||
    !value.baseId ||
    !(value.animationId === null || typeof value.animationId === "string") ||
    !Array.isArray(value.parts) ||
    value.parts.length > 64 ||
    !Array.isArray(value.assets) ||
    !Array.isArray(value.mappings)
  )
    throw new Error("Invalid or unsupported character loadout.");
  const used = new Set<string>();
  for (const p of value.parts) {
    if (
      typeof p.slot !== "string" ||
      !p.slot ||
      used.has(p.slot) ||
      typeof p.assetId !== "string" ||
      typeof p.locked !== "boolean"
    )
      throw new Error("Invalid or duplicate loadout slot.");
    used.add(p.slot);
    validateAttachment(p.attachment);
  }
  for (const a of value.assets)
    if (typeof a.id !== "string" || typeof a.file !== "string")
      throw new Error("Invalid loadout source reference.");
  for (const m of value.mappings)
    if (
      typeof m.enabled !== "boolean" ||
      typeof m.loop !== "boolean" ||
      typeof m.returnToDefault !== "boolean" ||
      typeof m.clipName !== "string"
    )
      throw new Error("Invalid loadout state mapping.");
  validateMappings(value.mappings, value.defaultState);
  value.recipe = validateRecipe(value.recipe);
  return value;
}
