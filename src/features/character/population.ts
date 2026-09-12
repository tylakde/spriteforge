import {
  compatibility,
  type FactoryAsset,
  type PartSelection,
} from "./factory";
export interface PopulationTemplate {
  name: string;
  allowedTags: string[];
  disallowedTags: string[];
  allowedAssets: Record<string, string[]>;
  faction: string;
  style: string;
  bodyType: string;
}
export const emptyTemplate = (): PopulationTemplate => ({
  name: "Custom population",
  allowedTags: [],
  disallowedTags: [],
  allowedAssets: {},
  faction: "",
  style: "",
  bodyType: "",
});
export function partSignature(parts: PartSelection[]) {
  return JSON.stringify(
    [...parts]
      .sort((a, b) => a.slot.localeCompare(b.slot))
      .map((p) => [p.slot, p.assetId, p.attachment]),
  );
}
export function assetAllowed(
  asset: FactoryAsset,
  template: PopulationTemplate,
) {
  return (
    (!template.allowedTags.length ||
      asset.tags.some((t) => template.allowedTags.includes(t))) &&
    !asset.tags.some((t) => template.disallowedTags.includes(t)) &&
    (!template.faction || asset.faction === template.faction) &&
    (!template.style || asset.style === template.style) &&
    (!template.bodyType || asset.bodyType === template.bodyType) &&
    (!template.allowedAssets[asset.slot]?.length ||
      template.allowedAssets[asset.slot].includes(asset.id))
  );
}
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function generatePopulation(
  base: FactoryAsset,
  library: FactoryAsset[],
  current: PartSelection[],
  randomSlots: string[],
  template: PopulationTemplate,
  count: number,
  seed: number,
  existing: Set<string> = new Set(),
) {
  if (!Number.isInteger(count) || count < 1 || count > 200)
    throw new Error("Choose 1–200 variations.");
  const random = seededRandom(seed),
    fixed = current.filter((p) => p.locked || !randomSlots.includes(p.slot));
  for (const part of fixed) {
    const asset = library.find((a) => a.id === part.assetId);
    if (!asset) throw new Error(`Missing locked asset in ${part.slot}.`);
    const issue = compatibility(base.skeleton, asset.skeleton, part.attachment);
    if (issue) throw new Error(`Locked ${part.slot}: ${issue}`);
  }
  const pools = [...new Set(randomSlots)]
    .filter((slot) => !fixed.some((p) => p.slot === slot))
    .map((slot) => {
      const pool = library.filter(
        (a) =>
          a.id !== base.id &&
          a.slot === slot &&
          a.skeleton.meshes > 0 &&
          assetAllowed(a, template) &&
          !compatibility(base.skeleton, a.skeleton, a.attachment),
      );
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      if (!pool.length)
        throw new Error(
          `No compatible assets satisfy the template for ${slot}.`,
        );
      return { slot, pool };
    });
  if (!pools.length)
    throw new Error("Choose at least one unlocked slot to randomise.");
  const capacity = pools.reduce((n, p) => n * BigInt(p.pool.length), 1n);
  const result: PartSelection[][] = [],
    seen = new Set(existing);
  const offset = BigInt(
    Math.floor(
      random() * Number(capacity > 2147483647n ? 2147483647n : capacity),
    ),
  );
  const limit =
    capacity < BigInt(count + existing.size)
      ? capacity
      : BigInt(count + existing.size);
  for (let index = 0n; index < limit && result.length < count; index++) {
    let code = (index + offset) % capacity;
    const parts = structuredClone(fixed);
    for (const { slot, pool } of pools) {
      const asset = pool[Number(code % BigInt(pool.length))];
      code /= BigInt(pool.length);
      parts.push({
        slot,
        assetId: asset.id,
        attachment: structuredClone(asset.attachment),
        locked: false,
      });
    }
    const signature = partSignature(parts);
    if (!seen.has(signature)) {
      seen.add(signature);
      result.push(parts);
    }
  }
  return {
    parts: result,
    capacity: capacity.toString(),
    exhausted: result.length < count,
  };
}
