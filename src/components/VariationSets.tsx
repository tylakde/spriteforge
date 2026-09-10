import { useEffect, useState } from "react";
import { Download, Columns3, X } from "lucide-react";
import type { Generation } from "../types";
import { styleDefinitions } from "../features/styles/styles";
export default function VariationSets({
  sets,
  selected,
  disabled,
  onSelect,
  onExport,
}: {
  sets: Generation[];
  selected: Generation | null;
  disabled: boolean;
  onSelect: (set: Generation) => void;
  onExport: () => void;
}) {
  const [comparing, setComparing] = useState(false),
    [frame, setFrame] = useState(0),
    [urls, setURLs] = useState<string[]>([]);
  useEffect(() => {
    setFrame(0);
    setComparing(false);
  }, [sets]);
  useEffect(() => {
    if (!comparing) return;
    const urls = sets.map((set) => URL.createObjectURL(set.frames[frame]));
    setURLs(urls);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setComparing(false);
    };
    window.addEventListener("keydown", key);
    return () => {
      urls.forEach(URL.revokeObjectURL);
      window.removeEventListener("keydown", key);
    };
  }, [sets, frame, comparing]);
  const record = sets[0].metadata.frames[frame];
  return (
    <>
      <section className="variation-bar" aria-label="Style comparison">
        <div className="overline" title={sets[0].metadata.source}>
          STYLE SETS
        </div>
        <div
          className="variation-options"
          role="group"
          aria-label="Choose a generated style"
        >
          {sets.map((set) => (
            <button
              disabled={disabled}
              key={set.metadata.recipe.style}
              aria-pressed={selected === set}
              onClick={() => onSelect(set)}
            >
              <img src={set.thumbnails[0]} alt="" className="checker" />
              <span>
                {styleDefinitions[set.metadata.recipe.style].label}
                <small>
                  {set.frames.length} frames ·{" "}
                  {set.metadata.appearance.pixelScale}× pixels
                </small>
              </span>
            </button>
          ))}
        </div>
        <button disabled={disabled} onClick={() => setComparing(true)}>
          <Columns3 size={14} /> Compare
        </button>
        <button disabled={disabled} onClick={onExport}>
          <Download size={14} /> Export 3 sets
        </button>
      </section>
      {comparing && (
        <div className="modal-backdrop" onClick={() => setComparing(false)}>
          <div
            className="style-comparison-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Compare sprite styles"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-title">
              <span>
                {sets[0].metadata.source} · {record.directionDegrees}°
                {record.animation &&
                  ` · ${record.animation} / frame ${record.animationFrame}`}
              </span>
              <button
                aria-label="Close style comparison"
                onClick={() => setComparing(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="style-comparison-images">
              {sets.map((set, i) => (
                <figure key={set.metadata.recipe.style}>
                  <img
                    className="checker"
                    style={{
                      imageRendering:
                        set.metadata.appearance.pixelScale > 1
                          ? "pixelated"
                          : "auto",
                    }}
                    src={urls[i]}
                    alt={styleDefinitions[set.metadata.recipe.style].label}
                  />
                  <figcaption>
                    {styleDefinitions[set.metadata.recipe.style].label}
                    <small>
                      {styleDefinitions[set.metadata.recipe.style].description}
                    </small>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="modal-controls">
              <button
                onClick={() =>
                  setFrame(
                    (frame + sets[0].frames.length - 1) % sets[0].frames.length,
                  )
                }
              >
                Previous view
              </button>
              <span>
                {frame + 1} / {sets[0].frames.length}
              </span>
              <button
                onClick={() => setFrame((frame + 1) % sets[0].frames.length)}
              >
                Next view
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
