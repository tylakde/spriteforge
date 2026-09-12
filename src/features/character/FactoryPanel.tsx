import { useEffect, useRef, useState } from "react";
import type { RenderRecipe } from "../../types";
import { download } from "../export/export";
import { disposeGeneration, renderSequence } from "../generation/generate";
import { buildCharacter, exportCharacter, type CharacterBuild } from "./build";
import {
  assembleCharacter,
  compatibility,
  defaultAttachment,
  parseLoadout,
  serializeLoadout,
  slots,
  validateAttachment,
  type Attachment,
  type FactoryAsset,
  type Loadout,
  type PartSelection,
} from "./factory";
import type { FactoryController } from "./useFactory";
import {
  emptyTemplate,
  generatePopulation,
  partSignature,
  type PopulationTemplate,
} from "./population";
import { estimateCharacter, type StateMapping } from "./schema";
import { chooseOutputDirectory } from "../export/export";
import { isTauri } from "@tauri-apps/api/core";
import { safeName } from "../../lib/math";
interface Variation {
  id: string;
  name: string;
  parts: PartSelection[];
  thumbnail: string;
  selected: boolean;
  favourite: boolean;
  status: string;
}
type Run = (
  task: (
    signal: AbortSignal,
    progress: (value: number, status: string) => void,
  ) => Promise<void>,
) => Promise<void>;
export default function FactoryPanel({
  factory: f,
  recipe,
  mappings,
  defaultState,
  name,
  busy,
  run,
  onLoad,
  onBuilt,
  report,
}: {
  factory: FactoryController;
  recipe: RenderRecipe;
  mappings: StateMapping[];
  defaultState: string;
  name: string;
  busy: boolean;
  run: Run;
  onLoad: (loadout: Loadout) => void;
  onBuilt: (build: CharacterBuild) => void;
  report: (message: string) => void;
}) {
  const [filter, setFilter] = useState({
    slot: "",
    tags: "",
    skeleton: "",
    faction: "",
    style: "",
    bodyType: "",
    compatible: false,
  });
  const [editing, setEditing] = useState(""),
    [randomSlots, setRandomSlots] = useState<string[]>([]),
    [template, setTemplate] = useState<PopulationTemplate>(emptyTemplate());
  const [count, setCount] = useState(50),
    [variations, setVariations] = useState<Variation[]>([]),
    [reviewed, setReviewed] = useState(false),
    [notice, setNotice] = useState("");
  const variationsRef = useRef(variations);
  variationsRef.current = variations;
  const history = useRef(new Set<string>()),
    loadInput = useRef<HTMLInputElement>(null),
    templateInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () =>
      variationsRef.current.forEach((v) => URL.revokeObjectURL(v.thumbnail)),
    [],
  );
  useEffect(() => {
    variationsRef.current.forEach((v) => URL.revokeObjectURL(v.thumbnail));
    setVariations([]);
    history.current.clear();
  }, [f.base?.id]);
  const availableSlots = [
    ...new Set([
      ...slots.slice(1),
      ...f.library.map((a) => a.slot).filter((s) => s !== "Base Body"),
      ...f.parts.map((p) => p.slot),
    ]),
  ];
  const updateAsset = (asset: FactoryAsset, patch: Partial<FactoryAsset>) => {
    const next = { ...asset, ...patch };
    f.setLibrary((l) => l.map((a) => (a.id === asset.id ? next : a)));
    const { slot, tags, faction, style, bodyType, attachment } = next;
    localStorage.setItem(
      `spriteforge-asset-${asset.id}`,
      JSON.stringify({ slot, tags, faction, style, bodyType, attachment }),
    );
    f.setParts((parts) =>
      parts.map((p) =>
        p.assetId === asset.id
          ? { ...p, attachment: structuredClone(attachment) }
          : p,
      ),
    );
  };
  const selectPart = (slot: string, assetId: string) => {
    const asset = f.library.find((a) => a.id === assetId);
    f.setParts((parts) => [
      ...parts.filter((p) => p.slot !== slot),
      ...(asset
        ? [
            {
              slot,
              assetId,
              attachment: structuredClone(asset.attachment),
              locked: false,
            },
          ]
        : []),
    ]);
  };
  const saveLoadout = () => {
    if (!f.base) return;
    try {
      const loadout: Loadout = {
        format: "spriteforge-loadout",
        version: 1,
        name,
        baseId: f.base.id,
        parts: f.parts,
        animationId: f.animationId,
        mappings,
        defaultState,
        recipe,
        assets: f.library
          .filter(
            (a) =>
              a.id === f.base?.id ||
              a.id === f.animationId ||
              f.parts.some((p) => p.assetId === a.id),
          )
          .map((a) => ({
            id: a.id,
            file: a.source.file.webkitRelativePath || a.source.name,
          })),
      };
      download(
        new Blob([serializeLoadout(loadout)], { type: "application/json" }),
        `${safeName(name)}.spriteforge-character.json`,
      );
    } catch (e) {
      report((e as Error).message);
    }
  };
  const randomise = () => {
    if (!f.base) return;
    try {
      const seen = new Set([...history.current, partSignature(f.parts)]);
      const result = generatePopulation(
        f.base,
        f.library,
        f.parts,
        randomSlots,
        template,
        1,
        Date.now(),
        seen,
      );
      if (!result.parts.length)
        throw new Error(
          "No unused combinations remain. Change pools or unlock parts.",
        );
      history.current.add(partSignature(result.parts[0]));
      f.setParts(result.parts[0]);
      setNotice(`Randomised from ${result.capacity} compatible combinations.`);
    } catch (e) {
      report((e as Error).message);
    }
  };
  const thumbnail = async (parts: PartSelection[], signal: AbortSignal) => {
    if (!f.base) throw new Error("Choose a base body.");
    const result = await renderSequence(
      f.base.source,
      {
        ...recipe,
        cellSize: 128,
        directionCount: 1,
        anchor: "ground",
        background: "transparent",
      },
      null,
      () => {},
      signal,
      {
        load: () => assembleCharacter(f.base!, parts, f.library, f.animationId),
        atlasOnly: true,
      },
    );
    disposeGeneration(result);
    return URL.createObjectURL(result.atlas);
  };
  const generate = () =>
    void run(async (signal, progress) => {
      if (!f.base) throw new Error("Choose a base body.");
      const result = generatePopulation(
        f.base,
        f.library,
        f.parts,
        randomSlots,
        template,
        count,
        Date.now(),
        new Set(variations.map((v) => partSignature(v.parts))),
      );
      setNotice(
        `${result.parts.length} new appearances from ${result.capacity} combinations.${result.exhausted ? " The remaining pool is exhausted; no duplicates were added." : ""}`,
      );
      for (const [i, parts] of result.parts.entries()) {
        if (signal.aborted) break;
        progress(
          i / result.parts.length,
          `Previewing variation ${i + 1}/${result.parts.length}`,
        );
        const url = await thumbnail(parts, signal);
        setVariations((v) => [
          ...v,
          {
            id: crypto.randomUUID(),
            name: `${template.name || name} ${v.length + 1}`,
            parts,
            thumbnail: url,
            selected: true,
            favourite: false,
            status: "Ready to bake",
          },
        ]);
      }
      progress(
        1,
        "Population previews ready. Select appearances and review the bake estimate.",
      );
    });
  const reroll = (variation: Variation) =>
    void run(async (signal, progress) => {
      if (!f.base) return;
      const result = generatePopulation(
        f.base,
        f.library,
        variation.parts,
        randomSlots,
        template,
        1,
        Date.now(),
        new Set(variations.map((v) => partSignature(v.parts))),
      );
      if (!result.parts.length)
        throw new Error(
          "No unused combinations remain with these locks and pools.",
        );
      const parts = result.parts[0],
        url = await thumbnail(parts, signal);
      URL.revokeObjectURL(variation.thumbnail);
      setVariations((v) =>
        v.map((x) =>
          x.id === variation.id
            ? { ...x, parts, thumbnail: url, status: "Ready to bake" }
            : x,
        ),
      );
      progress(1, "Variation rerolled");
    });
  const targets = variations.filter((v) => v.selected);
  const estimate = (() => {
    try {
      return estimateCharacter(mappings, recipe, targets.length || count);
    } catch {
      return null;
    }
  })();
  const bake = (all: boolean) =>
    void run(async (signal, progress) => {
      if (!f.base) throw new Error("Choose a base body.");
      const selected = all ? variations : targets;
      if (
        selected.some((v) => !v.name.trim()) ||
        new Set(selected.map((v) => safeName(v.name).toLowerCase())).size !==
          selected.length
      )
        throw new Error("Each exported character needs a unique name.");
      const estimate = estimateCharacter(mappings, recipe, selected.length);
      if (estimate.large && !reviewed)
        throw new Error(
          "Review and acknowledge the large population workload before baking.",
        );
      const directory = await chooseOutputDirectory();
      if (isTauri() && !directory) return;
      for (const [i, variation] of selected.entries()) {
        if (signal.aborted) break;
        try {
          const built = await buildCharacter(
            f.base.source,
            recipe,
            mappings,
            defaultState,
            (p, s) =>
              progress((i + p) / selected.length, `${variation.name}: ${s}`),
            signal,
            () =>
              assembleCharacter(
                f.base!,
                variation.parts,
                f.library,
                f.animationId,
              ),
            variation.name,
          );
          const path = await exportCharacter(built, directory);
          onBuilt(built);
          setVariations((v) =>
            v.map((x) =>
              x.id === variation.id
                ? {
                    ...x,
                    status: path
                      ? "Exported — ready for Unreal"
                      : "Export cancelled",
                  }
                : x,
            ),
          );
        } catch (e) {
          setVariations((v) =>
            v.map((x) =>
              x.id === variation.id
                ? { ...x, status: (e as Error).message }
                : x,
            ),
          );
          if (signal.aborted) break;
        }
      }
      progress(
        1,
        signal.aborted
          ? "Population bake cancelled; completed exports are preserved"
          : "Population bake complete — review each result",
      );
    });
  const asset = f.library.find((a) => a.id === editing);
  return (
    <section className="factory-panel">
      <fieldset disabled={busy}>
        <div className="forge-toolbar">
          <h2>Character Factory</h2>
          <button onClick={saveLoadout} disabled={!f.base || !mappings.length}>
            Save loadout
          </button>
          <button onClick={() => loadInput.current?.click()}>
            Load loadout
          </button>
        </div>
        <input
          hidden
          ref={loadInput}
          type="file"
          accept=".json"
          aria-label="Load character loadout"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              onLoad(parseLoadout(await file.text()));
            } catch (e) {
              report((e as Error).message);
            }
          }}
        />
        <p className="muted">
          Shared skeletons, bone sockets and fixed attachments. Loadouts
          reference source files by content fingerprint; reimport those files on
          another machine.
        </p>
        <div className="factory-slots">
          {availableSlots.map((slot) => {
            const selected = f.parts.find((p) => p.slot === slot);
            return (
              <div key={slot}>
                <label>
                  {slot}
                  <select
                    aria-label={`Slot ${slot}`}
                    value={selected?.assetId ?? ""}
                    onChange={(e) => selectPart(slot, e.target.value)}
                  >
                    <option value="">None</option>
                    {f.library
                      .filter(
                        (a) =>
                          a.id !== f.base?.id &&
                          a.slot === slot &&
                          a.skeleton.meshes > 0,
                      )
                      .map((a) => (
                        <option
                          key={a.id}
                          value={a.id}
                          disabled={
                            !!f.base &&
                            !!compatibility(
                              f.base.skeleton,
                              a.skeleton,
                              a.attachment,
                            )
                          }
                        >
                          {a.source.name}
                          {f.base &&
                          compatibility(
                            f.base.skeleton,
                            a.skeleton,
                            a.attachment,
                          )
                            ? " — incompatible"
                            : ""}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!selected?.locked}
                    disabled={!selected}
                    onChange={(e) =>
                      f.setParts((p) =>
                        p.map((s) =>
                          s.slot === slot
                            ? { ...s, locked: e.target.checked }
                            : s,
                        ),
                      )
                    }
                  />{" "}
                  Lock
                </label>
                <label>
                  <input
                    type="checkbox"
                    aria-label={`Randomise ${slot}`}
                    checked={randomSlots.includes(slot)}
                    onChange={(e) =>
                      setRandomSlots((s) =>
                        e.target.checked
                          ? [...s, slot]
                          : s.filter((x) => x !== slot),
                      )
                    }
                  />{" "}
                  Randomise
                </label>
              </div>
            );
          })}
        </div>
        <p className="muted">
          Select an asset below to assign a custom slot and edit its attachment.
        </p>
        <label className="library-animation">
          Shared animation library
          <select
            aria-label="Shared animation library"
            value={f.animationId ?? ""}
            onChange={(e) => f.setAnimationId(e.target.value || null)}
          >
            <option value="">Base character animations</option>
            {f.library
              .filter((a) => a.animations.length && a.id !== f.base?.id)
              .map((a) => (
                <option
                  key={a.id}
                  value={a.id}
                  disabled={
                    !f.base?.skeleton.signature ||
                    f.base.skeleton.signature !== a.skeleton.signature
                  }
                >
                  {a.source.name}
                  {f.base?.skeleton.signature !== a.skeleton.signature
                    ? " — skeleton mismatch"
                    : ""}
                </option>
              ))}
          </select>
        </label>
        <details open>
          <summary>Factory asset library · {f.library.length} assets</summary>
          <div className="forge-toolbar library-filters">
            {(
              [
                "slot",
                "tags",
                "skeleton",
                "faction",
                "style",
                "bodyType",
              ] as const
            ).map((key) => (
              <input
                key={key}
                aria-label={`Filter assets ${key}`}
                placeholder={key}
                value={filter[key]}
                onChange={(e) =>
                  setFilter((v) => ({ ...v, [key]: e.target.value }))
                }
              />
            ))}
            <label>
              <input
                type="checkbox"
                checked={filter.compatible}
                onChange={(e) =>
                  setFilter((v) => ({ ...v, compatible: e.target.checked }))
                }
              />{" "}
              Compatible only
            </label>
          </div>
          <div className="factory-library">
            {f.library
              .filter(
                (a) =>
                  (!filter.slot ||
                    a.slot.toLowerCase().includes(filter.slot.toLowerCase())) &&
                  (!filter.tags ||
                    filter.tags
                      .split(",")
                      .every((t) => a.tags.includes(t.trim()))) &&
                  (!filter.skeleton ||
                    a.skeleton.bones
                      .join(" ")
                      .toLowerCase()
                      .includes(filter.skeleton.toLowerCase())) &&
                  ["faction", "style", "bodyType"].every(
                    (k) =>
                      !(filter as any)[k] ||
                      (a as any)[k]
                        .toLowerCase()
                        .includes((filter as any)[k].toLowerCase()),
                  ) &&
                  (!filter.compatible ||
                    (f.base &&
                      !compatibility(
                        f.base.skeleton,
                        a.skeleton,
                        a.attachment,
                      ))),
              )
              .map((a) => (
                <button
                  key={a.id}
                  className={editing === a.id ? "active" : ""}
                  onClick={() => setEditing(a.id)}
                >
                  <b>{a.source.name}</b>
                  <span>
                    {a.slot} · {a.skeleton.skinned ? "Skinned" : "Static"} ·{" "}
                    {a.skeleton.bones.length} bones
                  </span>
                  <small>
                    {a.id === f.base?.id
                      ? "Base body"
                      : f.base
                        ? compatibility(
                            f.base.skeleton,
                            a.skeleton,
                            a.attachment,
                          ) || "✓ Compatible"
                        : "Choose base to check compatibility"}
                  </small>
                </button>
              ))}
          </div>
        </details>
        {asset && (
          <div className="asset-editor">
            <h3>{asset.source.name}</h3>
            <div className="forge-toolbar">
              <label>
                Slot
                <input
                  list="factory-slot-names"
                  aria-label="Asset slot"
                  value={asset.slot}
                  onChange={(e) => updateAsset(asset, { slot: e.target.value })}
                />
              </label>
              <datalist id="factory-slot-names">
                {slots.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </datalist>
              <label>
                Tags
                <input
                  aria-label="Asset tags"
                  key={asset.id}
                  defaultValue={asset.tags.join(", ")}
                  onBlur={(e) =>
                    updateAsset(asset, {
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              {(["faction", "style", "bodyType"] as const).map((key) => (
                <label key={key}>
                  {key}
                  <input
                    aria-label={`Asset ${key}`}
                    value={asset[key]}
                    onChange={(e) =>
                      updateAsset(asset, { [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Attachment
                <select
                  aria-label="Attachment mode"
                  value={asset.attachment.mode}
                  onChange={(e) =>
                    updateAsset(asset, {
                      attachment: {
                        ...defaultAttachment(),
                        mode: e.target.value as Attachment["mode"],
                      },
                    })
                  }
                >
                  <option value="fixed">Fixed transform</option>
                  <option value="socket">Bone / socket</option>
                  <option value="skinned">Shared skeleton</option>
                </select>
              </label>
              {asset.attachment.mode === "socket" && (
                <label>
                  Bone
                  <select
                    aria-label="Attachment bone"
                    value={asset.attachment.bone}
                    onChange={(e) =>
                      updateAsset(asset, {
                        attachment: {
                          ...asset.attachment,
                          bone: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Choose bone</option>
                    {f.base?.skeleton.bones.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="forge-toolbar">
              {(["position", "rotation", "scale"] as const).map((key) => (
                <label key={key}>
                  {key} {key === "rotation" ? "(degrees)" : ""}
                  <span className="xyz-inputs">
                    {["X", "Y", "Z"].map((axis, i) => (
                      <input
                        key={axis}
                        type="number"
                        step="0.1"
                        disabled={asset.attachment.mode === "skinned"}
                        aria-label={`Attachment ${key} ${axis}`}
                        value={asset.attachment[key][i]}
                        onChange={(e) => {
                          const values = [...asset.attachment[key]] as [
                            number,
                            number,
                            number,
                          ];
                          values[i] = Number(e.target.value);
                          const attachment = {
                            ...asset.attachment,
                            [key]: values,
                          };
                          try {
                            validateAttachment(attachment);
                            updateAsset(asset, { attachment });
                          } catch (e) {
                            report((e as Error).message);
                          }
                        }}
                      />
                    ))}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="population-heading">
          <h2>Population Factory</h2>
          <button
            onClick={() => {
              setTemplate({
                ...emptyTemplate(),
                name: "City Guard",
                allowedAssets: Object.fromEntries(
                  ["Hair", "Helmet", "Chest"].map((slot) => [
                    slot,
                    f.library
                      .filter(
                        (a) =>
                          a.slot === slot &&
                          /Guard_|Chest_(Iron|Gold|Shadow)/.test(a.source.name),
                      )
                      .map((a) => a.id),
                  ]),
                ),
              });
              setRandomSlots(["Hair", "Helmet", "Chest"]);
              setCount(50);
              setReviewed(false);
            }}
          >
            Use City Guard demo template
          </button>
          <p>
            Generate unique appearances from compatible, tagged asset pools.
          </p>
        </div>
        <div className="forge-toolbar">
          <label>
            Template
            <input
              aria-label="Population template"
              value={template.name}
              onChange={(e) =>
                setTemplate((t) => ({ ...t, name: e.target.value }))
              }
            />
          </label>
          <label>
            Variations
            <input
              aria-label="Population count"
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => {
                setCount(Number(e.target.value));
                setReviewed(false);
              }}
            />
          </label>
          <button className="primary" disabled={!f.base} onClick={randomise}>
            Randomise
          </button>
          <button
            disabled={
              !f.base ||
              count < 1 ||
              count > 200 ||
              variations.length + count > 200
            }
            onClick={generate}
          >
            Generate variations / population
          </button>
          <button
            onClick={() =>
              download(
                new Blob([
                  JSON.stringify(
                    {
                      format: "spriteforge-population-template",
                      version: 1,
                      template,
                    },
                    null,
                    2,
                  ),
                ]),
                `${safeName(template.name)}.template.json`,
              )
            }
          >
            Save template
          </button>
          <button onClick={() => templateInput.current?.click()}>
            Load template
          </button>
          <input
            ref={templateInput}
            hidden
            type="file"
            accept=".json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                const v = JSON.parse(await file.text());
                if (
                  v.format !== "spriteforge-population-template" ||
                  v.version !== 1 ||
                  !v.template ||
                  typeof v.template.name !== "string" ||
                  !["allowedTags", "disallowedTags"].every(
                    (k) =>
                      Array.isArray(v.template[k]) &&
                      v.template[k].every(
                        (s: unknown) => typeof s === "string",
                      ),
                  ) ||
                  !v.template.allowedAssets ||
                  typeof v.template.allowedAssets !== "object" ||
                  !Object.values(v.template.allowedAssets).every(
                    (a) =>
                      Array.isArray(a) && a.every((s) => typeof s === "string"),
                  )
                )
                  throw new Error("Invalid population template");
                setTemplate({ ...emptyTemplate(), ...v.template });
              } catch (e) {
                report((e as Error).message);
              }
            }}
          />
        </div>
        <details>
          <summary>Template rules and allowed pools</summary>
          <div className="forge-toolbar">
            {(["allowedTags", "disallowedTags"] as const).map((key) => (
              <label key={key}>
                {key}
                <input
                  aria-label={`Template ${key}`}
                  key={template.name + key}
                  defaultValue={template[key].join(", ")}
                  onBlur={(e) =>
                    setTemplate((t) => ({
                      ...t,
                      [key]: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </label>
            ))}
            {(["faction", "style", "bodyType"] as const).map((key) => (
              <label key={key}>
                {key}
                <input
                  value={template[key]}
                  onChange={(e) =>
                    setTemplate((t) => ({ ...t, [key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          {randomSlots.map((slot) => (
            <label key={slot}>
              {slot} pool (none selected = all compatible)
              <select
                multiple
                aria-label={`${slot} allowed pool`}
                value={template.allowedAssets[slot] ?? []}
                onChange={(e) => {
                  const selected = Array.from(
                    e.target.selectedOptions,
                    (o) => o.value,
                  );
                  setTemplate((t) => ({
                    ...t,
                    allowedAssets: { ...t.allowedAssets, [slot]: selected },
                  }));
                }}
              >
                {f.library
                  .filter((a) => a.slot === slot)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.source.name}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </details>
        <p>{notice}</p>
        {estimate && (
          <p className="population-estimate">
            Planned bake: {estimate.jobs} characters · {estimate.states} state
            atlases · {estimate.frames.toLocaleString()} frames ·{" "}
            {(estimate.rawBytes / 1024 ** 2).toFixed(1)} MiB uncompressed (PNG
            size varies). Rendering is sequential.
          </p>
        )}
        <div className="variation-grid">
          {variations.map((v) => (
            <article className="character-variation" key={v.id}>
              <button
                aria-label={`Preview ${v.name}`}
                onClick={() => f.setParts(structuredClone(v.parts))}
              >
                <img src={v.thumbnail} alt={v.name} />
              </button>
              <input
                aria-label={`Variation name ${v.id}`}
                value={v.name}
                onChange={(e) =>
                  setVariations((all) =>
                    all.map((x) =>
                      x.id === v.id ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
              <div className="forge-toolbar">
                <label>
                  <input
                    aria-label={`Select ${v.name}`}
                    type="checkbox"
                    checked={v.selected}
                    onChange={(e) => {
                      setReviewed(false);
                      setVariations((all) =>
                        all.map((x) =>
                          x.id === v.id
                            ? { ...x, selected: e.target.checked }
                            : x,
                        ),
                      );
                    }}
                  />{" "}
                  Bake
                </label>
                <button
                  aria-label={`Favourite ${v.name}`}
                  onClick={() =>
                    setVariations((all) =>
                      all.map((x) =>
                        x.id === v.id ? { ...x, favourite: !x.favourite } : x,
                      ),
                    )
                  }
                >
                  {v.favourite ? "★" : "☆"}
                </button>
                <button onClick={() => reroll(v)}>Reroll</button>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(v.thumbnail);
                    setVariations((all) => all.filter((x) => x.id !== v.id));
                  }}
                >
                  Delete
                </button>
              </div>
              <details>
                <summary>Lock selected parts</summary>
                {v.parts.map((p) => (
                  <label key={p.slot}>
                    <input
                      type="checkbox"
                      checked={p.locked}
                      onChange={(e) =>
                        setVariations((all) =>
                          all.map((x) =>
                            x.id === v.id
                              ? {
                                  ...x,
                                  parts: x.parts.map((part) =>
                                    part.slot === p.slot
                                      ? { ...part, locked: e.target.checked }
                                      : part,
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                    {p.slot}
                  </label>
                ))}
              </details>
              <small>{v.status}</small>
            </article>
          ))}
        </div>
        {variations.length > 0 && (
          <div className="forge-build-bar">
            <div>
              <p>
                {targets.length} selected ·{" "}
                {estimate?.frames.toLocaleString() ?? "Invalid workload"} frames
                · {estimate ? (estimate.rawBytes / 1024 ** 2).toFixed(1) : "—"}{" "}
                MiB uncompressed atlases
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />{" "}
                Reviewed large batch (completed exports survive cancellation)
              </label>
            </div>
            <div className="forge-toolbar">
              <button disabled={!targets.length} onClick={() => bake(false)}>
                Bake selected characters
              </button>
              <button onClick={() => bake(true)}>Bake all characters</button>
            </div>
          </div>
        )}
      </fieldset>
    </section>
  );
}
