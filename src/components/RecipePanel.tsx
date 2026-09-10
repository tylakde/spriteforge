import { useEffect, useRef, useState } from "react";
import {
  Download,
  Upload,
  Copy,
  Save,
  Trash2,
  RotateCcw,
  ChevronDown,
  Pencil,
  Layers,
} from "lucide-react";
import { useStore } from "../stores/useStore";
import { validateRecipe } from "../features/recipes/recipes";
import { exportRecipe } from "../features/export/export";
import type { RenderRecipe } from "../types";
import {
  applyStyle,
  styleDefinitions,
  type SpriteStyle,
  allStyles,
  defaultVariationStyles,
} from "../features/styles/styles";
export default function RecipePanel({
  disabled,
  canGenerateStyles,
  onGenerateStyles,
  onError,
}: {
  disabled: boolean;
  canGenerateStyles: boolean;
  onGenerateStyles: () => void;
  onError: (message: string) => void;
}) {
  const {
    recipe: r,
    update,
    presets,
    setRecipe,
    savePreset,
    renamePreset,
    deletePreset,
    reset,
    styleSelection,
    selectStyles,
  } = useStore();
  const [name, setName] = useState(r.name);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setName(r.name), [r.name]);
  const num = (
    label: string,
    key: keyof RenderRecipe,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={r[key] as number}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= min && v <= max)
            try {
              update({ [key]: v });
            } catch {
              /* Keep last valid edit while typing. */
            }
        }}
      />
    </label>
  );
  const select = (
    label: string,
    key: keyof RenderRecipe,
    values: (string | number)[],
  ) => (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={String(r[key])}
        onChange={(e) =>
          update({
            [key]:
              typeof r[key] === "number"
                ? Number(e.target.value)
                : e.target.value,
          })
        }
      >
        {values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <aside className="recipe-panel">
      <div className="panel-title">
        RENDER RECIPE <span className="tiny-tag">LOCAL</span>
      </div>
      <fieldset disabled={disabled}>
        <div className="preset-section">
          <label className="overline">PRESET</label>
          <select
            aria-label="Preset"
            className="preset-select"
            value={presets.some((p) => p.name === r.name) ? r.name : ""}
            onChange={(e) => {
              const p = presets.find((x) => x.name === e.target.value);
              if (p) {
                setRecipe(p);
                setName(p.name);
              }
            }}
          >
            <option value="" disabled>
              Custom recipe
            </option>
            {presets.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
          </select>
          <div className="preset-name">
            <input
              aria-label="Recipe name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
            <button
              title="Save or rename recipe"
              onClick={() => {
                try {
                  savePreset(name);
                } catch (e) {
                  onError((e as Error).message);
                }
              }}
            >
              <Save size={14} />
            </button>
            <button
              title="Rename current preset"
              onClick={() => {
                try {
                  renamePreset(name);
                } catch (e) {
                  onError((e as Error).message);
                }
              }}
            >
              <Pencil size={14} />
            </button>
            <button
              title="Duplicate recipe"
              onClick={() => {
                const n = r.name + " copy";
                savePreset(n);
                setName(n);
              }}
            >
              <Copy size={14} />
            </button>
          </div>
          <div className="text-actions">
            <button onClick={() => input.current?.click()}>
              <Upload size={12} /> Import
            </button>
            <button
              onClick={() =>
                void exportRecipe(JSON.stringify(r, null, 2), r.name).catch(
                  (e) => onError(e.message),
                )
              }
            >
              <Download size={12} /> Export
            </button>
            <button title="Delete preset" onClick={() => deletePreset(r.name)}>
              <Trash2 size={12} />
            </button>
            <button title="Reset built-in presets" onClick={reset}>
              <RotateCcw size={12} />
            </button>
          </div>
          <input
            ref={input}
            type="file"
            accept=".json"
            hidden
            onChange={async (e) => {
              try {
                const f = e.target.files?.[0];
                if (f) {
                  const recipe = validateRecipe(JSON.parse(await f.text()));
                  setRecipe(recipe);
                  savePreset(recipe.name);
                  setName(recipe.name);
                }
              } catch (error) {
                onError("Invalid recipe: " + (error as Error).message);
              }
              e.target.value = "";
            }}
          />
        </div>
        <div className="style-section">
          <label className="overline" htmlFor="sprite-style">
            ART STYLE
          </label>
          <select
            id="sprite-style"
            aria-label="Art style"
            value={r.style}
            onChange={(e) =>
              setRecipe({
                ...applyStyle(r, e.target.value as SpriteStyle),
                framingOutlineWidth: 0,
              })
            }
          >
            {Object.entries(styleDefinitions).map(([value, style]) => (
              <option key={value} value={value}>
                {style.label}
              </option>
            ))}
          </select>
          <p>{styleDefinitions[r.style].description}</p>
          {r.style !== "original" && (
            <details className="style-tuning">
              <summary>
                <ChevronDown size={13} /> Tune appearance
              </summary>
              {styleDefinitions[r.style].pixelated &&
                select("Pixel block size", "pixelScale", [1, 2, 4, 8])}
              {num("Colour steps", "colorSteps", 2, 64)}
              {num("Saturation", "saturation", 0, 2, 0.05)}
              {num("Contrast", "contrast", 0.5, 1.75, 0.05)}
              {num("Dithering", "dither", 0, 1, 0.05)}
              {styleDefinitions[r.style].shading === "toon" &&
                num("Shading bands", "toonBands", 2, 8)}
              <label className="field">
                <span>Outline colour</span>
                <input
                  aria-label="Outline colour"
                  type="color"
                  value={r.outlineColor}
                  onChange={(e) => update({ outlineColor: e.target.value })}
                />
              </label>
            </details>
          )}
          <details className="style-tuning style-picker">
            <summary>
              <ChevronDown size={13} /> Choose styles ({styleSelection.length} /{" "}
              {allStyles.length})
            </summary>
            <div className="style-selection-actions">
              <button onClick={() => selectStyles([...allStyles])}>
                Select all {allStyles.length}
              </button>
              <button onClick={() => selectStyles([])}>Clear</button>
              <button onClick={() => selectStyles([...defaultVariationStyles])}>
                Original trio
              </button>
            </div>
            {allStyles.map((style) => (
              <label
                className="check"
                title={styleDefinitions[style].description}
                key={style}
              >
                <input
                  type="checkbox"
                  aria-label={`Include ${styleDefinitions[style].label}`}
                  checked={styleSelection.includes(style)}
                  onChange={(e) =>
                    selectStyles(
                      e.target.checked
                        ? [...styleSelection, style]
                        : styleSelection.filter((s) => s !== style),
                    )
                  }
                />
                {styleDefinitions[style].label}
              </label>
            ))}
          </details>
          <button
            className="bake-styles"
            disabled={!canGenerateStyles || disabled || !styleSelection.length}
            onClick={onGenerateStyles}
          >
            <Layers size={14} /> Bake {styleSelection.length} style{" "}
            {styleSelection.length === 1 ? "set" : "sets"}
          </button>
          <small>Same camera and animation. Compare after baking.</small>
        </div>
        <details open>
          <summary>
            <ChevronDown size={13} /> OUTPUT
          </summary>
          {select("Cell size", "cellSize", [64, 128, 256, 512, 1024])}
          <label className="field">
            <span>Directions</span>
            <div className="segments">
              {[1, 4, 8, 16, 32].map((n) => (
                <button
                  key={n}
                  className={r.directionCount === n ? "selected" : ""}
                  onClick={() =>
                    update({
                      directionCount: n as RenderRecipe["directionCount"],
                    })
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </label>
          {num("Padding %", "paddingPercent", 2, 35)}
          {select("Anchor", "anchor", ["ground", "center"])}
          {select("Atlas layout", "atlasLayout", ["grid", "strip"])}
          {num("Atlas gutter px", "atlasPadding", 0, 16)}
          <label className="check">
            <input
              type="checkbox"
              checked={r.powerOfTwo}
              onChange={(e) => update({ powerOfTwo: e.target.checked })}
            />{" "}
            Power-of-two atlas
          </label>
        </details>
        <details open>
          <summary>
            <ChevronDown size={13} /> CAMERA
          </summary>
          {select("Projection", "projection", ["orthographic", "perspective"])}
          {num("Elevation °", "cameraElevation", -10, 89)}
          {num("Front direction °", "frontDirection", 0, 360)}
          {r.projection === "perspective" &&
            num("Field of view °", "perspectiveFov", 10, 100)}
        </details>
        <details open>
          <summary>
            <ChevronDown size={13} /> LIGHTING
          </summary>
          {num("Key azimuth °", "lightAzimuth", 0, 360)}
          {num("Key elevation °", "lightElevation", 0, 90)}
          {num("Key intensity", "lightIntensity", 0, 10, 0.1)}
          {num("Ambient", "ambientIntensity", 0, 5, 0.1)}
        </details>
        <details open>
          <summary>
            <ChevronDown size={13} /> FINISH
          </summary>
          {select("Background", "background", ["transparent", "solid"])}
          {r.background === "solid" && (
            <label className="field">
              <span>Colour</span>
              <input
                aria-label="Background colour"
                type="color"
                value={r.backgroundColor}
                onChange={(e) => update({ backgroundColor: e.target.value })}
              />
            </label>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={r.outlineEnabled}
              onChange={(e) => update({ outlineEnabled: e.target.checked })}
            />{" "}
            Silhouette outline
          </label>
          {r.outlineEnabled && num("Outline width px", "outlineWidth", 1, 8)}
        </details>
      </fieldset>
    </aside>
  );
}
