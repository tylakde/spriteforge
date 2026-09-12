import { useEffect, useMemo, useRef, useState } from "react";
import type { AssetSource, LoadedAsset, RenderRecipe } from "../../types";
import Viewport from "../preview/Viewport";
import { baseRecipe } from "../recipes/recipes";
import {
  mapAnimations,
  npcProfiles,
  stateNames,
  estimateCharacter,
  type StateMapping,
} from "./schema";
import { buildCharacter, exportCharacter, type CharacterBuild } from "./build";
import PlayTest from "./PlayTest";
import { useFactory } from "./useFactory";
import FactoryPanel from "./FactoryPanel";
import type { Loadout } from "./factory";
import { useStore } from "../../stores/useStore";
import { safeName } from "../../lib/math";
import { allStyles } from "../styles/styles";

export default function CharacterForge({
  sources,
  source,
  importFiles,
  selectSource,
  onBusy,
}: {
  sources: AssetSource[];
  source: AssetSource | null;
  importFiles: (files: File[]) => void;
  selectSource: (source: AssetSource) => void;
  onBusy: (value: boolean) => void;
}) {
  const factory = useFactory(sources, source);
  const [name, setName] = useState("Character"),
    [ready, setReady] = useState(false);
  const pendingLoadout = useRef<Loadout | null>(null),
    clipSignature = useRef("");
  const [recipe, setRecipe] = useState<RenderRecipe>({
    ...baseRecipe,
    cellSize: 256,
    directionCount: 8,
    anchor: "ground",
    background: "transparent",
  });
  const [mappings, setMappings] = useState<StateMapping[]>([]),
    [defaultState, setDefault] = useState("Idle");
  const [clips, setClips] = useState<{ name: string; duration: number }[]>([]),
    [clip, setClip] = useState<number | null>(null);
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState("Drop an animated character to get started"),
    [error, setError] = useState("");
  const [progress, setProgress] = useState(0),
    [built, setBuilt] = useState<CharacterBuild | null>(null),
    [play, setPlay] = useState(false),
    [large, setLarge] = useState(false);
  const abort = useRef<AbortController | null>(null),
    files = useRef<HTMLInputElement>(null),
    folder = useRef<HTMLInputElement>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    clipSignature.current = "";
    setName(safeName(source?.name ?? "Character"));
    setMappings([]);
    setClips([]);
    setClip(null);
    setBuilt(null);
    setError("");
  }, [source]);
  useEffect(() => {
    setBuilt(null);
    setReady(false);
  }, [source, factory.loader]);
  const report = (message: string) => setError(message);
  useEffect(() => {
    if (factory.error) setError(factory.error);
  }, [factory.error]);
  const loaded = (asset: LoadedAsset) => {
    const clips = asset.animations.map((c) => ({
      name: c.name,
      duration: c.duration,
    }));
    setClips(clips);
    setReady(true);
    const signature = JSON.stringify(clips);
    const pending = pendingLoadout.current;
    if (pending) {
      pendingLoadout.current = null;
      if (
        pending.mappings.some(
          (m) =>
            clips[m.clipIndex]?.name !== m.clipName ||
            clips[m.clipIndex]?.duration !== m.duration,
        )
      ) {
        report("Loadout animation clips do not match the imported library.");
        setReady(false);
        return;
      }
      setMappings(pending.mappings);
      setDefault(pending.defaultState);
      setRecipe(pending.recipe);
      setName(pending.name);
      setClip(pending.mappings[0]?.clipIndex ?? null);
    } else if (signature !== clipSignature.current) {
      const next = mapAnimations(clips);
      setMappings(next);
      setDefault(
        next.find((s) => s.name === "Idle")?.name ?? next[0]?.name ?? "Idle",
      );
      setClip(next[0]?.clipIndex ?? null);
    }
    clipSignature.current = signature;
    setStatus(
      `${clips.length} animations detected · ${clips.length} gameplay states mapped`,
    );
  };
  const estimate = useMemo(() => {
    try {
      return { value: estimateCharacter(mappings, recipe), error: "" };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [mappings, recipe]);
  const edit = (index: number, patch: Partial<StateMapping>) => {
    setMappings((m) => m.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    setBuilt(null);
  };
  const patchRecipe = (patch: Partial<RenderRecipe>) => {
    setRecipe((r) => ({ ...r, ...patch }));
    setBuilt(null);
    setLarge(false);
  };
  const build = async () => {
    if (!source || busy) return;
    setBusy(true);
    onBusy(true);
    setError("");
    abort.current = new AbortController();
    try {
      const result = await buildCharacter(
        source,
        recipe,
        mappings,
        defaultState,
        (p, s) => {
          setProgress(p);
          setStatus(s);
        },
        abort.current.signal,
        factory.loader,
        name,
      );
      setBuilt(result);
      setPlay(true);
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  const send = async () => {
    if (!built) return;
    setBusy(true);
    onBusy(true);
    try {
      const path = await exportCharacter(built);
      setStatus(
        path
          ? `Exported ${path}. In Unreal: Tools → Import SpriteForge Character → choose ${built.metadata.name}.character.json.`
          : "Export cancelled",
      );
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  const run = async (
    task: (
      signal: AbortSignal,
      progress: (p: number, s: string) => void,
    ) => Promise<void>,
  ) => {
    if (busy) return;
    setBusy(true);
    onBusy(true);
    setError("");
    abort.current = new AbortController();
    try {
      await task(abort.current.signal, (p, s) => {
        setProgress(p);
        setStatus(s);
      });
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  const loadLoadout = (loadout: Loadout) => {
    const required = [
      loadout.baseId,
      ...loadout.parts.map((p) => p.assetId),
      ...(loadout.animationId ? [loadout.animationId] : []),
    ];
    const missing = required.filter(
      (id) => !factory.library.some((a) => a.id === id),
    );
    if (missing.length)
      throw new Error(
        `Reimport the loadout source files first: ${missing.map((id) => loadout.assets.find((a) => a.id === id)?.file ?? id).join(", ")}`,
      );
    const base = factory.library.find((a) => a.id === loadout.baseId)!;
    pendingLoadout.current = loadout;
    factory.setFactory(true);
    factory.setParts(loadout.parts);
    factory.setAnimationId(loadout.animationId);
    selectSource(base.source);
  };
  return (
    <section className="character-forge">
      <div className="forge-heading">
        <div>
          <span className="eyebrow">CHARACTER FORGE</span>
          <h1>From 3D character to playable sprites.</h1>
          <p>One character. Every state. Ready to play.</p>
        </div>
        <span className="forge-pill">All local · deterministic baking</span>
      </div>
      <div className="forge-toolbar forge-entry-paths">
        <button
          disabled={busy}
          className={!factory.factory ? "active" : ""}
          onClick={() => factory.setFactory(false)}
        >
          One-click character
        </button>
        <button
          disabled={busy}
          className={factory.factory ? "active" : ""}
          onClick={() => factory.setFactory(true)}
        >
          Modular character factory
        </button>
      </div>
      <div className="forge-columns">
        <aside className="forge-panel">
          <h2>Character</h2>
          <label>
            Name
            <input
              aria-label="Character name"
              disabled={busy}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setBuilt(null);
              }}
            />
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() => files.current?.click()}
          >
            Drop / import animated character
          </button>
          <button disabled={busy} onClick={() => folder.current?.click()}>
            Import asset folder
          </button>
          <input
            hidden
            ref={files}
            type="file"
            multiple
            aria-label="Import character files"
            onChange={(e) => {
              importFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <input
            hidden
            ref={folder}
            type="file"
            multiple
            {...({ webkitdirectory: "" } as object)}
            onChange={(e) => {
              importFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <label>
            Base character
            <select
              aria-label="Base character"
              disabled={busy}
              value={source?.id ?? ""}
              onChange={(e) => {
                const s = sources.find((s) => s.id === e.target.value);
                if (s) selectSource(s);
              }}
            >
              <option value="" disabled>
                Select a character
              </option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy}
            onClick={async () => {
              try {
                const r = await fetch("/samples/ForgeKnight.glb");
                if (!r.ok) throw new Error("Sample unavailable");
                importFiles([new File([await r.blob()], "ForgeKnight.glb")]);
              } catch (e) {
                report((e as Error).message);
              }
            }}
          >
            Try animated Knight demo
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              try {
                const names = [
                  "Base_Human",
                  "Chest_Iron",
                  "Chest_Gold",
                  "Chest_Shadow",
                  "Weapon_Sword",
                  "Human_Combat_Animations",
                  ...Array.from(
                    { length: 4 },
                    (_, i) => `Helmet_Guard_${i + 1}`,
                  ),
                  ...Array.from({ length: 5 }, (_, i) => `Hair_Guard_${i + 1}`),
                ];
                const files = await Promise.all(
                  names.map(async (name) => {
                    const r = await fetch(`/samples/factory/${name}.glb`);
                    if (!r.ok) throw new Error("Factory sample unavailable");
                    return new File([await r.blob()], `${name}.glb`);
                  }),
                );
                factory.setFactory(true);
                factory.setParts([]);
                factory.setAnimationId(null);
                importFiles(files);
              } catch (e) {
                report((e as Error).message);
              }
            }}
          >
            Try modular Guard demo
          </button>
          <p>
            {clips.length} animations detected
            <br />
            {mappings.filter((s) => s.enabled).length} gameplay states mapped
          </p>
          <p className="muted">
            Import a complete animated model here. Factory assembly and
            population tools use the same character build format.
          </p>
        </aside>
        <div className="forge-preview">
          <Viewport
            source={source}
            loader={factory.loader}
            clipIndex={clip}
            playing={!busy}
            time={0}
            resetKey={0}
            onLoaded={loaded}
            onError={report}
            onTime={() => {}}
          />
          <div className="forge-state-tabs">
            {mappings.map((s, i) => (
              <button
                key={i}
                className={clip === s.clipIndex ? "active" : ""}
                onClick={() => setClip(s.clipIndex)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <aside className="forge-panel">
          <h2>Character setup</h2>
          <fieldset disabled={busy}>
            <label>
              Directions
              <select
                aria-label="Character directions"
                value={recipe.directionCount}
                onChange={(e) =>
                  patchRecipe({
                    directionCount: Number(
                      e.target.value,
                    ) as RenderRecipe["directionCount"],
                  })
                }
              >
                {[4, 8, 16].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Resolution
              <select
                aria-label="Character resolution"
                value={recipe.cellSize}
                onChange={(e) =>
                  patchRecipe({
                    cellSize: Number(
                      e.target.value,
                    ) as RenderRecipe["cellSize"],
                  })
                }
              >
                {[128, 256, 512, 1024].map((v) => (
                  <option key={v} value={v}>
                    {v} px
                  </option>
                ))}
              </select>
            </label>
            <label>
              NPC bake profile
              <select
                aria-label="NPC bake profile"
                defaultValue=""
                onChange={(e) => {
                  const profile =
                    npcProfiles[e.target.value as keyof typeof npcProfiles];
                  if (!profile) return;
                  patchRecipe({
                    directionCount: profile.directionCount,
                    cellSize: profile.cellSize,
                  });
                  const next = mappings.map((s) => ({
                    ...s,
                    enabled:
                      profile.states === null ||
                      (profile.states as readonly string[]).includes(s.name),
                  }));
                  setMappings(next);
                  if (!next.some((s) => s.enabled && s.name === defaultState))
                    setDefault(next.find((s) => s.enabled)?.name ?? "Idle");
                }}
              >
                <option value="">Custom / all states</option>
                {Object.keys(npcProfiles).map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <details>
              <summary>Advanced rendering</summary>
              <button
                onClick={() => {
                  const r = useStore.getState().recipe;
                  patchRecipe({
                    ...r,
                    directionCount: [4, 8, 16].includes(r.directionCount)
                      ? r.directionCount
                      : 8,
                    cellSize: r.cellSize === 64 ? 128 : r.cellSize,
                    anchor: "ground",
                    background: "transparent",
                  });
                }}
              >
                Use Sprite Baker recipe
              </button>
              <label>
                FPS
                <input
                  aria-label="Character FPS"
                  type="number"
                  min={1}
                  max={60}
                  value={recipe.fps}
                  onChange={(e) => {
                    const fps = Number(e.target.value);
                    if (Number.isInteger(fps) && fps > 0 && fps <= 60)
                      patchRecipe({ fps });
                  }}
                />
              </label>
              <label>
                Art style
                <select
                  aria-label="Character art style"
                  value={recipe.style}
                  onChange={(e) =>
                    patchRecipe({
                      style: e.target.value as RenderRecipe["style"],
                    })
                  }
                >
                  {allStyles.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Front angle
                <input
                  aria-label="Character front angle"
                  type="number"
                  value={recipe.frontDirection}
                  onChange={(e) =>
                    patchRecipe({ frontDirection: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Camera elevation
                <input
                  aria-label="Character camera elevation"
                  type="number"
                  min={0}
                  max={80}
                  value={recipe.cameraElevation}
                  onChange={(e) =>
                    patchRecipe({
                      cameraElevation: Math.max(
                        0,
                        Math.min(80, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </label>
            </details>
          </fieldset>
        </aside>
      </div>
      <details className="forge-mapping" open>
        <summary>Animation mapping — correct names, clips and playback</summary>
        <fieldset disabled={busy}>
          <label>
            Default state
            <select
              aria-label="Default character state"
              value={defaultState}
              onChange={(e) => {
                setDefault(e.target.value);
                setBuilt(null);
              }}
            >
              {mappings
                .filter((s) => s.enabled)
                .map((s, i) => (
                  <option key={i}>{s.name}</option>
                ))}
            </select>
          </label>
          <datalist id="forge-states">
            {stateNames.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </datalist>
          {mappings.map((s, i) => (
            <div className="mapping-row" key={i}>
              <input
                type="checkbox"
                aria-label={`Include state ${i + 1}`}
                checked={s.enabled}
                onChange={(e) => edit(i, { enabled: e.target.checked })}
              />
              <input
                list="forge-states"
                aria-label={`State name ${i + 1}`}
                value={s.name}
                onChange={(e) => edit(i, { name: e.target.value })}
              />
              <select
                aria-label={`State clip ${i + 1}`}
                value={s.clipIndex}
                onChange={(e) => {
                  const index = Number(e.target.value);
                  edit(i, {
                    clipIndex: index,
                    clipName: clips[index].name,
                    duration: clips[index].duration,
                  });
                }}
              >
                {clips.map((c, i) => (
                  <option key={i} value={i}>
                    {c.name}
                  </option>
                ))}
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={s.loop}
                  onChange={(e) => edit(i, { loop: e.target.checked })}
                />{" "}
                Loop
              </label>
              <label>
                <input
                  type="checkbox"
                  disabled={s.loop}
                  checked={s.returnToDefault}
                  onChange={(e) =>
                    edit(i, { returnToDefault: e.target.checked })
                  }
                />{" "}
                Return to default
              </label>
            </div>
          ))}
        </fieldset>
      </details>
      {factory.factory && (
        <FactoryPanel
          factory={factory}
          recipe={recipe}
          mappings={mappings}
          defaultState={defaultState}
          name={name}
          busy={busy}
          run={run}
          onLoad={loadLoadout}
          onBuilt={setBuilt}
          report={report}
        />
      )}
      {error && (
        <p className="forge-error" role="alert">
          {error}
        </p>
      )}
      <div className="forge-build-bar">
        <div>
          {estimate.value ? (
            <p>
              {estimate.value.frames.toLocaleString()} frames ·{" "}
              {(estimate.value.rawBytes / 1024 ** 2).toFixed(1)} MiB
              uncompressed atlases <small>(PNG size varies)</small>
            </p>
          ) : (
            <p>{estimate.error}</p>
          )}
          {estimate.value?.large && (
            <label>
              <input
                type="checkbox"
                checked={large}
                onChange={(e) => setLarge(e.target.checked)}
              />{" "}
              I have reviewed this large workload
            </label>
          )}
          <output>{status}</output>
          {busy && <progress value={progress} max={1} />}
        </div>
        <div className="forge-toolbar">
          {busy && (
            <button onClick={() => abort.current?.abort()}>
              Cancel character build
            </button>
          )}
          <button
            className="primary"
            disabled={
              !source ||
              !ready ||
              (factory.factory && !factory.base) ||
              busy ||
              !estimate.value ||
              (estimate.value.large && !large)
            }
            onClick={() => void build()}
          >
            Build playable character
          </button>
          <button disabled={!built || busy} onClick={() => setPlay(true)}>
            Play test
          </button>
          <button disabled={!built || busy} onClick={() => void send()}>
            Send to Unreal
          </button>
        </div>
      </div>
      {play && built && (
        <PlayTest build={built} onClose={() => setPlay(false)} />
      )}
    </section>
  );
}
