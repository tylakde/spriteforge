import { useEffect, useRef, useState } from "react";
import {
  Box,
  Plus,
  FolderOpen,
  Download,
  Play,
  Pause,
  Sparkles,
  X,
  Check,
  AlertCircle,
  Layers,
  Package,
  Square,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import Viewport from "../features/preview/Viewport";
import RecipePanel from "../components/RecipePanel";
import GeneratedViews from "../components/GeneratedViews";
import { sourcesFromFiles } from "../features/assets/loadAsset";
import {
  disposeGeneration,
  renderSequence,
} from "../features/generation/generate";
import {
  chooseOutputDirectory,
  exportGeneration,
  exportVariationSets,
  importNativeFiles,
} from "../features/export/export";
import { runBatch, type QueueItem } from "../features/batch/batch";
import { useStore } from "../stores/useStore";
import type { AssetSource, Generation, LoadedAsset } from "../types";
import { renderVariationSets } from "../features/styles/variations";
import VariationSets from "../components/VariationSets";
import CharacterForge from "../features/character/CharacterForge";
export default function App() {
  const [workspace, setWorkspace] = useState("baker");
  const [forgeOpened, setForgeOpened] = useState(false);
  const [forgeBusy, setForgeBusy] = useState(false);
  const [sources, setSources] = useState<AssetSource[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [checked, setChecked] = useState<string[]>([]),
    [stats, setStats] = useState<LoadedAsset["stats"] | null>(null),
    [clips, setClips] = useState<{ name: string; duration: number }[]>([]),
    [clipIndex, setClipIndex] = useState<number | null>(null),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [generation, setGeneration] = useState<Generation | null>(null),
    [variations, setVariations] = useState<Generation[]>([]),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [status, setStatus] = useState("Ready"),
    [error, setError] = useState(""),
    [queue, setQueue] = useState<QueueItem[]>([]),
    [dragging, setDragging] = useState(false),
    [help, setHelp] = useState(false);
  const filesInput = useRef<HTMLInputElement>(null),
    folderInput = useRef<HTMLInputElement>(null),
    abort = useRef<AbortController | null>(null),
    generationRef = useRef<Generation | null>(null),
    variationsRef = useRef<Generation[]>([]);
  const recipe = useStore((s) => s.recipe),
    outputMode = useStore((s) => s.outputMode),
    preferences = useStore((s) => s.preferences),
    update = useStore((s) => s.update),
    styleSelection = useStore((s) => s.styleSelection);
  const source = sources.find((s) => s.id === selected) ?? null;
  useEffect(
    () => () => {
      abort.current?.abort();
      new Set([generationRef.current, ...variationsRef.current]).forEach(
        disposeGeneration,
      );
    },
    [],
  );
  const report = (message: string) => {
    setError(message);
    setStatus("Attention needed");
  };
  const activate = (asset: AssetSource) => {
    setSelected(asset.id);
    setStats(null);
    setClips([]);
    setClipIndex(null);
    setTime(0);
    setPlaying(false);
  };
  const importFiles = (files: File[]) => {
    const added = sourcesFromFiles(files);
    if (!added.length) {
      report(
        "No GLB or GLTF assets found. Include .bin and texture sidecars with .gltf files.",
      );
      return;
    }
    setSources((s) => [...s, ...added]);
    setChecked((c) => [...c, ...added.map((s) => s.id)]);
    activate(added[0]);
    setError("");
    setStatus(`Imported ${added.length} asset${added.length > 1 ? "s" : ""}`);
  };
  const browse = async () => {
    if (busy) return;
    if (isTauri()) {
      try {
        const files = await importNativeFiles();
        if (files.length) importFiles(files);
      } catch (e) {
        report((e as Error).message);
      }
    } else filesInput.current?.click();
  };
  const sample = async (name: string) => {
    try {
      const response = await fetch(`/samples/${name}.glb`);
      if (!response.ok) throw new Error("Sample file could not be loaded.");
      importFiles([new File([await response.blob()], `${name}.glb`)]);
    } catch (e) {
      report((e as Error).message);
    }
  };
  const generate = async () => {
    if (!source || busy) return;
    setBusy(true);
    setError("");
    setPlaying(false);
    abort.current = new AbortController();
    try {
      const next = await renderSequence(
        source,
        recipe,
        clipIndex,
        (value, label) => {
          setProgress(value);
          setStatus(label);
        },
        abort.current.signal,
      );
      new Set([generationRef.current, ...variationsRef.current]).forEach(
        disposeGeneration,
      );
      variationsRef.current = [];
      setVariations([]);
      generationRef.current = next;
      setGeneration(next);
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const generateStyles = async () => {
    if (!source || busy) return;
    setBusy(true);
    setError("");
    setPlaying(false);
    abort.current = new AbortController();
    try {
      const sets = await renderVariationSets(
        source,
        recipe,
        clipIndex,
        (value, label) => {
          setProgress(value);
          setStatus(label);
        },
        abort.current.signal,
        styleSelection,
      );
      new Set([generationRef.current, ...variationsRef.current]).forEach(
        disposeGeneration,
      );
      variationsRef.current = sets;
      setVariations(sets);
      generationRef.current = sets[0];
      setGeneration(sets[0]);
      useStore.getState().setRecipe(sets[0].metadata.recipe);
      setStatus(
        `${sets.length} style ${sets.length === 1 ? "set" : "sets"} ready — compare and export`,
      );
    } catch (error) {
      report((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const selectVariation = (set: Generation) => {
    if (busy) return;
    generationRef.current = set;
    setGeneration(set);
    useStore.getState().setRecipe(set.metadata.recipe);
  };
  const exportStyles = async () => {
    if (busy || !variations.length) return;
    setBusy(true);
    setError("");
    try {
      const path = await exportVariationSets(variations, outputMode);
      setStatus(path ? `Exported to ${path}` : "Export cancelled");
    } catch (error) {
      report((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const exportCurrent = async () => {
    if (!generation || busy) return;
    setBusy(true);
    setError("");
    try {
      setStatus("Exporting…");
      const path = await exportGeneration(generation, outputMode);
      setStatus(path ? `Exported to ${path}` : "Export cancelled");
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const batch = async () => {
    if (busy || !checked.length) return;
    setBusy(true);
    setError("");
    abort.current = new AbortController();
    try {
      const directory = await chooseOutputDirectory();
      if (isTauri() && !directory) {
        setBusy(false);
        return;
      }
      const items = sources.filter((s) => checked.includes(s.id));
      setQueue(
        items.map((s) => ({
          id: s.id,
          name: s.name,
          status: "waiting",
          detail: "Queued",
          progress: 0,
        })),
      );
      await runBatch(
        items,
        { ...recipe },
        outputMode,
        directory,
        clipIndex !== null,
        (item) => {
          setQueue((q) => q.map((i) => (i.id === item.id ? item : i)));
          setStatus(`${item.name}: ${item.detail}`);
          setProgress(item.progress);
        },
        abort.current.signal,
      );
      setStatus(
        abort.current.signal.aborted
          ? "Batch cancelled"
          : "Batch complete — review queue results",
      );
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const drop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const list: File[] = [];
    // FileSystemEntry traversal preserves sidecar paths for dropped folders.
    const walk = async (entry: FileSystemEntry, prefix = ""): Promise<void> => {
      if (entry.isFile) {
        const f = await new Promise<File>((resolve, reject) =>
          (entry as FileSystemFileEntry).file(resolve, reject),
        );
        Object.defineProperty(f, "webkitRelativePath", {
          value: prefix + f.name,
        });
        list.push(f);
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        let children: FileSystemEntry[];
        do {
          children = await new Promise((resolve, reject) =>
            reader.readEntries(resolve, reject),
          );
          for (const child of children)
            await walk(child, prefix + entry.name + "/");
        } while (children.length);
      }
    };
    try {
      const entries = Array.from(e.dataTransfer.items)
        .map((i) => i.webkitGetAsEntry?.())
        .filter(Boolean) as FileSystemEntry[];
      if (entries.length) for (const entry of entries) await walk(entry);
      else list.push(...e.dataTransfer.files);
      importFiles(list);
    } catch (e) {
      report((e as Error).message);
    }
  };
  const stale =
    !!generation &&
    (generation.sourceId !== selected ||
      generation.recipeKey !== JSON.stringify(recipe) ||
      generation.metadata.frames[0]?.animation !==
        (clipIndex === null ? "" : clips[clipIndex]?.name));
  return (
    <div
      className="app-shell"
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy && !forgeBusy) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(e) => {
        if (forgeBusy) e.preventDefault();
        else void drop(e);
      }}
    >
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <Box size={22} />
          </div>
          <span>
            Sprite<span className="brand-light">Forge</span>
          </span>
          <span className="version">1.0</span>
        </div>
        <div className="header-center">
          ASSET WORKSPACE <ChevronRight size={12} />
          <span>{source?.name ?? "Untitled session"}</span>
        </div>
        <div className="header-right">
          <span className="local-badge">
            <span className="live-dot" /> All local
          </span>
          <button title="Quick start" onClick={() => setHelp(true)}>
            <BookOpen size={16} />
          </button>
        </div>
      </header>
      <nav className="workspace-tabs" aria-label="Workspace">
        <button
          className={workspace === "baker" ? "active" : ""}
          disabled={busy || forgeBusy}
          onClick={() => setWorkspace("baker")}
        >
          Sprite Baker
        </button>
        <button
          className={workspace === "forge" ? "active" : ""}
          disabled={busy || forgeBusy}
          onClick={() => {
            setForgeOpened(true);
            setWorkspace("forge");
          }}
        >
          Character Forge
        </button>
        <button
          disabled={busy || forgeBusy}
          onClick={() => {
            setWorkspace("baker");
            document.querySelector(".batch-queue")?.scrollIntoView();
          }}
        >
          Batch
        </button>
      </nav>
      <div
        className="baker-workspace"
        style={{ display: workspace === "baker" ? "flex" : "none" }}
      >
        <main className="workspace">
          <aside className="asset-panel">
            <div className="panel-title">
              ASSET LIBRARY <span className="count">{sources.length}</span>
            </div>
            <div className="library-actions">
              <button
                className="import-button"
                disabled={busy}
                onClick={() => void browse()}
              >
                <Plus size={16} /> Import assets
              </button>
              <button
                title="Import folder with textures"
                disabled={busy}
                onClick={() => folderInput.current?.click()}
              >
                <FolderOpen size={16} />
              </button>
            </div>
            <input
              ref={filesInput}
              type="file"
              multiple
              hidden
              accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.ktx2"
              onChange={(e) => {
                if (e.target.files) importFiles(Array.from(e.target.files));
                e.target.value = "";
              }}
            />
            <input
              ref={folderInput}
              type="file"
              multiple
              hidden
              {...{ webkitdirectory: "" }}
              onChange={(e) => {
                if (e.target.files) importFiles(Array.from(e.target.files));
                e.target.value = "";
              }}
            />
            <div className="asset-list">
              {sources.map((s) => (
                <div
                  className={`asset-row ${s.id === selected ? "selected" : ""}`}
                  key={s.id}
                >
                  <input
                    aria-label={`Batch select ${s.name}`}
                    type="checkbox"
                    disabled={busy}
                    checked={checked.includes(s.id)}
                    onChange={(e) =>
                      setChecked((c) =>
                        e.target.checked
                          ? [...c, s.id]
                          : c.filter((id) => id !== s.id),
                      )
                    }
                  />
                  <button disabled={busy} onClick={() => activate(s)}>
                    <Box size={21} />
                    <span>
                      {s.name.replace(/\.(glb|gltf)$/i, "")}
                      <small>
                        {s.name.split(".").pop()?.toUpperCase()} ·{" "}
                        {(s.file.size / 1024).toFixed(0)} KB
                      </small>
                    </span>
                  </button>
                  <button
                    className="remove-asset"
                    aria-label={`Remove ${s.name}`}
                    disabled={busy}
                    onClick={() => {
                      setSources((a) => a.filter((x) => x.id !== s.id));
                      setChecked((c) => c.filter((id) => id !== s.id));
                      if (s.id === selected) {
                        setSelected(null);
                        setStats(null);
                        setClips([]);
                        setPlaying(false);
                      }
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {!sources.length && (
                <p className="library-hint">
                  A home for your next
                  <br />
                  game-ready sprites.
                </p>
              )}
            </div>
            <div className="samples">
              <div className="overline">TRY A SAMPLE</div>
              <button disabled={busy} onClick={() => void sample("Runestone")}>
                <Package size={16} />
                <span>
                  Runestone<small>Textured environment prop</small>
                </span>
                <Plus size={13} />
              </button>
              <button disabled={busy} onClick={() => void sample("Sentinel")}>
                <Box size={16} />
                <span>
                  Sentinel<small>Animated character</small>
                </span>
                <Plus size={13} />
              </button>
            </div>
            <div className="library-footer">
              <span>GLB / GLTF</span>
              <span>Drop files anywhere</span>
            </div>
          </aside>
          <section className="preview-panel">
            <div className="preview-heading">
              <div>
                <span className="tab-active">Model preview</span>
                <span className="tab-note">Inspection camera</span>
              </div>
              {source && (
                <span className="tiny-tag">
                  {clips.length ? "ANIMATED" : "STATIC MESH"}
                </span>
              )}
            </div>
            <Viewport
              source={source}
              clipIndex={clipIndex}
              playing={playing}
              time={time}
              resetKey={0}
              onLoaded={(asset) => {
                setStats(asset.stats);
                setClips(
                  asset.animations.map((c, i) => ({
                    name: c.name || `Animation ${i + 1}`,
                    duration: c.duration,
                  })),
                );
              }}
              onError={report}
              onTime={setTime}
            />
            <div className="model-info">
              <span>
                <Box size={13} />
                {stats ? `${stats.meshes} meshes` : "No model selected"}
              </span>
              {stats && (
                <>
                  <span>{stats.triangles.toLocaleString()} tris</span>
                  <span>{stats.materials} materials</span>
                  <span>
                    {stats.dimensions.map((d) => d.toFixed(2)).join(" × ")} m
                  </span>
                </>
              )}
            </div>
            {clips.length > 0 && (
              <div className="animation-bar">
                <button
                  aria-label={playing ? "Pause animation" : "Play animation"}
                  disabled={clipIndex === null}
                  onClick={() => setPlaying(!playing)}
                >
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <select
                  aria-label="Animation clip"
                  disabled={busy}
                  value={clipIndex ?? ""}
                  onChange={(e) => {
                    setClipIndex(
                      e.target.value === "" ? null : Number(e.target.value),
                    );
                    setTime(0);
                  }}
                >
                  <option value="">Static pose</option>
                  {clips.map((c, i) => (
                    <option key={i} value={i}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Animation time"
                  type="range"
                  disabled={clipIndex === null}
                  min={0}
                  max={clips[clipIndex ?? 0]?.duration ?? 1}
                  step="0.001"
                  value={time}
                  onChange={(e) => {
                    setPlaying(false);
                    setTime(Number(e.target.value));
                  }}
                />
                <span>{time.toFixed(2)}s</span>
                <label>
                  FPS{" "}
                  <input
                    aria-label="Animation FPS"
                    disabled={busy}
                    type="number"
                    min={1}
                    max={60}
                    value={recipe.fps}
                    onChange={(e) => {
                      const fps = Number(e.target.value);
                      if (Number.isInteger(fps) && fps >= 1 && fps <= 60)
                        update({ fps });
                    }}
                  />
                </label>
              </div>
            )}
          </section>
          <RecipePanel
            disabled={busy}
            canGenerateStyles={!!source && !!stats}
            onGenerateStyles={() => void generateStyles()}
            onError={report}
          />
        </main>
        {variations.length > 0 && (
          <VariationSets
            sets={variations}
            selected={generation}
            disabled={busy}
            onSelect={selectVariation}
            onExport={() => void exportStyles()}
          />
        )}
        <GeneratedViews generation={generation} stale={stale} />
        {queue.length > 0 && (
          <section className="batch-queue">
            <div className="queue-title">
              BATCH QUEUE{" "}
              <button
                disabled={busy}
                onClick={() => setQueue([])}
                aria-label="Close batch queue"
              >
                <X size={14} />
              </button>
            </div>
            {queue.map((q) => (
              <div className={`queue-item ${q.status}`} key={q.id}>
                {q.status === "done" ? (
                  <Check size={13} />
                ) : q.status === "error" ? (
                  <AlertCircle size={13} />
                ) : (
                  <Layers size={13} />
                )}
                <b>{q.name}</b>
                <span>{q.detail}</span>
                <progress value={q.progress} max={1} />
              </div>
            ))}
          </section>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={15} />
            </button>
          </div>
        )}
        <footer className="action-bar">
          <div className="status">
            <span className={`live-dot ${busy ? "working" : ""}`} />
            <span title={status}>{status}</span>
            {busy && <progress value={progress} max={1} />}
          </div>
          <div className="actions">
            <span className="output-summary">
              {recipe.cellSize} px <b>·</b> {recipe.directionCount} views{" "}
              <b>·</b> {recipe.background === "transparent" ? "RGBA" : "RGB"}
            </span>
            {busy ? (
              <button onClick={() => abort.current?.abort()}>
                <Square size={13} /> Cancel
              </button>
            ) : (
              <button disabled={!checked.length} onClick={() => void batch()}>
                <Layers size={15} /> Batch{" "}
                {checked.length > 0 && `(${checked.length})`}
              </button>
            )}
            <button
              className="primary"
              disabled={!source || !stats || busy}
              onClick={() => void generate()}
            >
              <Sparkles size={16} />
              {busy ? "Working…" : "Generate"}
            </button>
            <div className="export-group">
              <button
                disabled={!generation || busy}
                onClick={() => void exportCurrent()}
              >
                <Download size={15} /> Export
              </button>
              <select
                aria-label="Export contents"
                value={outputMode}
                onChange={(e) =>
                  preferences({
                    outputMode: e.target.value as typeof outputMode,
                  })
                }
              >
                <option value="all">Everything</option>
                <option value="atlas">Atlas + metadata</option>
                <option value="frames">Individual PNGs</option>
              </select>
            </div>
          </div>
        </footer>
      </div>
      {forgeOpened && (
        <div
          className="forge-workspace"
          style={{ display: workspace === "forge" ? "flex" : "none" }}
        >
          <CharacterForge
            sources={sources}
            source={source}
            importFiles={importFiles}
            selectSource={activate}
            onBusy={setForgeBusy}
          />
        </div>
      )}
      {dragging && (
        <div className="drop-overlay">
          <FolderOpen size={44} />
          <h2>Drop assets to import</h2>
          <p>GLB, GLTF, or a folder with textures</p>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <div
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Quick start"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">
              <h2>From model to sprite</h2>
              <button
                aria-label="Close quick start"
                onClick={() => setHelp(false)}
              >
                <X size={18} />
              </button>
            </div>
            <ol>
              <li>
                Import a GLB, or a folder containing a GLTF and its textures.
              </li>
              <li>
                Orbit to inspect the model. Baking uses the camera settings in
                your recipe.
              </li>
              <li>
                Choose a preset, cell size, directions and lighting. Select a
                clip to bake animation.
              </li>
              <li>
                Generate, inspect the views, then export. Desktop exports create
                a new asset folder; browser exports download a ZIP.
              </li>
              <li>
                Install the plugin in <code>unreal/SpriteForgeImporter</code> to
                import the atlas and JSON into UE5.
              </li>
            </ol>
            <p>
              Batch processes checked assets with the current recipe. With
              animation selected it bakes the first clip of each asset; assets
              without a clip report an error and the queue continues.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
