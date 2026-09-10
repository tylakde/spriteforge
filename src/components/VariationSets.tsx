import { Download } from "lucide-react";
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
  return (
    <section className="variation-bar" aria-label="Style comparison">
      <div className="overline">STYLE SETS</div>
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
      <button disabled={disabled} onClick={onExport}>
        <Download size={14} /> Export 3 sets
      </button>
    </section>
  );
}
