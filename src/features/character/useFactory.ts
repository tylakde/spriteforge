import { useEffect, useMemo, useState } from "react";
import type { AssetSource } from "../../types";
import {
  assembleCharacter,
  inspectFactoryAsset,
  validateAttachment,
  type FactoryAsset,
  type PartSelection,
} from "./factory";
export function useFactory(sources: AssetSource[], source: AssetSource | null) {
  const [sourceKeys, setSourceKeys] = useState<Record<string, string>>({});
  const [library, setLibrary] = useState<FactoryAsset[]>([]),
    [parts, setParts] = useState<PartSelection[]>([]),
    [animationId, setAnimationId] = useState<string | null>(null),
    [factory, setFactory] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    void (async () => {
      for (const source of sources) {
        if (library.some((a) => a.source.id === source.id)) continue;
        try {
          const asset = await inspectFactoryAsset(source);
          if (stopped) return;
          try {
            const saved = JSON.parse(
              localStorage.getItem(`spriteforge-asset-${asset.id}`) ?? "null",
            );
            if (saved) {
              validateAttachment(saved.attachment);
              if (
                !["slot", "faction", "style", "bodyType"].every(
                  (k) => typeof saved[k] === "string",
                ) ||
                !Array.isArray(saved.tags) ||
                !saved.tags.every((t: unknown) => typeof t === "string")
              )
                throw new Error("Invalid catalog preferences");
              const { slot, faction, style, bodyType, tags, attachment } =
                saved;
              Object.assign(asset, {
                slot,
                faction,
                style,
                bodyType,
                tags,
                attachment,
              });
            }
          } catch {
            /* Optional catalog preferences are recoverable. */
          }
          setSourceKeys((keys) => ({ ...keys, [source.id]: asset.id }));
          setLibrary((l) =>
            l.some((a) => a.id === asset.id) ? l : [...l, asset],
          );
        } catch (e) {
          if (!stopped) setError((e as Error).message);
        }
      }
    })();
    return () => {
      stopped = true;
    };
    // Inspect only when imported sources change; edits to asset metadata do not reload files.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);
  const base =
    library.find(
      (a) =>
        a.source.id === source?.id || a.id === sourceKeys[source?.id ?? ""],
    ) ?? null;
  const loader = useMemo(
    () =>
      factory && base
        ? () => assembleCharacter(base, parts, library, animationId)
        : undefined,
    [factory, base, parts, library, animationId],
  );
  return {
    library,
    setLibrary,
    parts,
    setParts,
    animationId,
    setAnimationId,
    factory,
    setFactory,
    error,
    setError,
    base,
    loader,
  };
}
export type FactoryController = ReturnType<typeof useFactory>;
