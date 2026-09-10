import { describe, expect, it } from "vitest";
import { baseRecipe, validateRecipe } from "../src/features/recipes/recipes";
import {
  applyStyle,
  effectivePixelScale,
  gradePixels,
  styledAssetName,
  variationStyles,
  allStyles,
  styleDefinitions,
  validateStyleSelection,
  hexRGB,
} from "../src/features/styles/styles";
import { makeMetadata } from "../src/features/atlas/atlas";
import { prepareStyleMaterials } from "../src/features/styles/materials";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  Texture,
} from "three";
import { validateVariationBudget } from "../src/features/styles/variations";
describe("sprite style contracts", () => {
  it("has exactly 15 complete, uniquely named styles, including the original four", () => {
    expect(allStyles).toHaveLength(15);
    expect(
      new Set(allStyles.map((style) => styleDefinitions[style].label)).size,
    ).toBe(15);
    for (const style of allStyles)
      expect(validateRecipe(applyStyle(baseRecipe, style)).style).toBe(style);
    expect(validateStyleSelection(["pixel", "pixel", "original"])).toEqual([
      "pixel",
      "original",
    ]);
    expect(() => validateStyleSelection(["__proto__"])).toThrow();
    expect(() => validateVariationBudget(1000, 1024, 15)).toThrow(/budget/);
    expect(() => validateVariationBudget(8, 256, 15)).not.toThrow();
  });
  it("uses fixed handheld palette and preserves tinted outline colours", () => {
    const p = new Uint8ClampedArray([
      220, 180, 140, 255, 80, 100, 210, 255, 0, 0, 0, 0, 255, 255, 255, 255,
    ]);
    const r = applyStyle(baseRecipe, "handheld");
    gradePixels(p, 2, r);
    const palette = styleDefinitions.handheld.palette!.map(hexRGB);
    for (const index of [0, 4, 12])
      expect(palette).toContainEqual(Array.from(p.slice(index, index + 3)));
    expect(p[11]).toBe(0);
    expect(r.outlineColor).toBe("#173c2a");
  });
  it("restores source materials after the clay style and keeps diffuse-map alpha", () => {
    const map = new Texture(),
      source = new MeshStandardMaterial({ map, alphaTest: 0.5 });
    const mesh = new Mesh(new BoxGeometry(), source),
      root = new Group();
    root.add(mesh);
    const restore = prepareStyleMaterials(root, applyStyle(baseRecipe, "clay"));
    expect(mesh.material).not.toBe(source);
    expect(mesh.material.map).toBe(map);
    expect(mesh.material.alphaTest).toBe(0.5);
    expect(mesh.material.roughness).toBe(1);
    restore();
    expect(mesh.material).toBe(source);
    mesh.geometry.dispose();
    source.dispose();
    map.dispose();
  });

  it("migrates legacy recipes to original rendering and validates style controls", () => {
    expect(validateRecipe({ name: "Legacy" })).toMatchObject({
      style: "original",
      pixelScale: 1,
      saturation: 1,
    });
    for (const patch of [
      { style: "unknown" },
      { pixelScale: 3 },
      { colorSteps: 1 },
      { saturation: Infinity },
      { dither: 2 },
      { toonBands: 2.5 },
      { framingOutlineWidth: 99 },
    ])
      expect(() => validateRecipe({ ...baseRecipe, ...patch })).toThrow();
  });
  it("uses distinct styles without changing camera, resolution or animation sampling", () => {
    for (const style of variationStyles) {
      const r = applyStyle(
        { ...baseRecipe, fps: 24, cameraElevation: 30 },
        style,
      );
      expect(r).toMatchObject({
        style,
        cellSize: 256,
        fps: 24,
        cameraElevation: 30,
        directionCount: 8,
      });
    }
    expect(effectivePixelScale(applyStyle(baseRecipe, "pixel"))).toBe(4);
    expect(effectivePixelScale(applyStyle(baseRecipe, "cartoon"))).toBe(1);
    expect(effectivePixelScale(applyStyle(baseRecipe, "hybrid"))).toBe(2);
  });
  it("leaves original pixels untouched and quantises deterministically on a fixed grid", () => {
    const input = new Uint8ClampedArray([
      120, 160, 80, 255, 80, 120, 200, 70, 255, 255, 255, 0, 0, 0, 0, 255,
    ]);
    const unchanged = input.slice();
    gradePixels(unchanged, 2, baseRecipe);
    expect(unchanged).toEqual(input);
    const r = applyStyle(baseRecipe, "pixel"),
      a = input.slice(),
      b = input.slice();
    gradePixels(a, 2, r);
    gradePixels(b, 2, r);
    expect(a).toEqual(b);
    expect(a).not.toEqual(input);
    expect(a[7]).toBe(0);
    expect(a[3]).toBe(255);
    expect(a[11]).toBe(0);
    const hybrid = input.slice();
    gradePixels(hybrid, 2, applyStyle(baseRecipe, "hybrid"));
    expect(hybrid[7]).toBe(70);
  });
  it("preserves original material/maps after disposing the cartoon conversion", () => {
    const map = new Texture(),
      metalMap = new Texture(),
      original = new MeshStandardMaterial({ map, metalnessMap: metalMap });
    const mesh = new Mesh(new BoxGeometry(), original);
    const root = new Group();
    root.add(mesh);
    const restore = prepareStyleMaterials(
      root,
      applyStyle(baseRecipe, "cartoon"),
    );
    expect(mesh.material).toBeInstanceOf(MeshToonMaterial);
    expect(mesh.material.map).toBe(map);
    restore();
    expect(mesh.material).toBe(original);
    expect(mesh.material.metalnessMap).toBe(metalMap);
    mesh.geometry.dispose();
    original.dispose();
    map.dispose();
    metalMap.dispose();
  });
  it("names style assets separately and exports reproducible filtering metadata", () => {
    const names = variationStyles.map((style) => {
      const r = applyStyle(baseRecipe, style);
      const m = makeMetadata("Goblin.glb", r, [0], "", 0.85);
      expect(m.source).toBe("Goblin.glb");
      expect(m.recipe.style).toBe(style);
      expect(m.frames[0].file.startsWith(m.asset)).toBe(true);
      expect(m.appearance.textureFilter).toBe(
        styleDefinitions[style].pixelated ? "nearest" : "linear",
      );
      return m.asset;
    });
    expect(new Set(names).size).toBe(14);
    expect(styledAssetName("A".repeat(80), "pixel")).toHaveLength(80);
    expect(styledAssetName("Goblin", "original")).toBe("Goblin");
  });
});
