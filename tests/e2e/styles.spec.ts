import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
test("bake, compare, export and reproduce three distinct style sets", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Runestone Textured environment prop" })
    .click();
  await expect(
    page.getByRole("button", { name: "Bake 3 style sets" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Bake 3 style sets" }).click();
  await expect(
    page.getByRole("region", { name: "Style comparison" }),
  ).toBeVisible();
  await expect(page.locator(".frame-card")).toHaveCount(8);
  await expect(page.getByLabel("Art style", { exact: true })).toHaveValue(
    "pixel",
  );
  await page.getByRole("button", { name: "Painted Cartoon 8 frames" }).click();
  await expect(page.getByLabel("Art style", { exact: true })).toHaveValue(
    "cartoon",
  );
  await expect(page.locator(".stale")).toHaveCount(0);
  await page.screenshot({ path: "test-results/style-workspace.png" });
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Compare sprite styles" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog").locator("img")).toHaveCount(3);
  await page
    .getByRole("dialog")
    .locator("img")
    .first()
    .evaluate(async (image: HTMLImageElement) => {
      await image.decode();
    });
  await page.screenshot({ path: "test-results/style-comparison.png" });
  await page.getByRole("button", { name: "Next view" }).click();
  await expect(page.getByRole("dialog")).toContainText("45°");
  await page.getByRole("button", { name: "Close style comparison" }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export 3 sets" }).click();
  const files = unzipSync(readFileSync((await (await download).path())!));
  const names = [
    "Runestone_Pixel_Fantasy",
    "Runestone_Painted_Cartoon",
    "Runestone_Pixel_Realism",
  ];
  const metadata = names.map((name) =>
    JSON.parse(strFromU8(files[`${name}/${name}.json`])),
  );
  expect(metadata.map((m) => m.appearance.style)).toEqual([
    "pixel",
    "cartoon",
    "hybrid",
  ]);
  expect(metadata.map((m) => m.appearance.textureFilter)).toEqual([
    "nearest",
    "linear",
    "nearest",
  ]);
  expect(new Set(metadata.map((m) => m.anchor.y)).size).toBe(1);
  for (const m of metadata) {
    expect(m.frames).toHaveLength(8);
    expect(m.source).toBe("Runestone.glb");
    expect(m.recipe.framingOutlineWidth).toBe(4);
  }
  const pngs = metadata.map(
    (m) => files[`${m.asset}/frames/${m.frames[0].file}`],
  );
  expect(pngs[0]).not.toEqual(pngs[1]);
  expect(pngs[1]).not.toEqual(pngs[2]);
  expect(pngs[0]).not.toEqual(pngs[2]);
  const pixels = await page.evaluate(async (bytes) => {
    const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    const p = ctx.getImageData(0, 0, c.width, c.height).data;
    let blocks = true,
      opaque = 0,
      clear = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4,
          origin =
            (Math.floor(y / 4) * 4 * c.width + Math.floor(x / 4) * 4) * 4;
        for (let channel = 0; channel < 4; channel++)
          if (p[i + channel] !== p[origin + channel]) blocks = false;
        if (p[i + 3] === 255) opaque++;
        if (p[i + 3] === 0) clear++;
      }
    return { blocks, opaque, clear, width: c.width };
  }, Array.from(pngs[0]));
  expect(pixels.blocks).toBe(true);
  expect(pixels.width).toBe(256);
  expect(pixels.opaque).toBeGreaterThan(1000);
  expect(pixels.clear).toBeGreaterThan(1000);
  mkdirSync("test-results/style-export", { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    const dest = "test-results/style-export/" + name;
    mkdirSync(dest.slice(0, dest.lastIndexOf("/")), { recursive: true });
    writeFileSync(dest, data);
  }
  // Exported shared framing must reproduce the selected style on its own.
  await page.getByRole("button", { name: "Pixel Fantasy 8 frames" }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByText("Ready to export", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Style comparison" }),
  ).toHaveCount(0);
  const single = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export", exact: true })
    .last()
    .click();
  const again = unzipSync(readFileSync((await (await single).path())!));
  expect(again["frames/" + metadata[0].frames[0].file]).toEqual(pngs[0]);
  await page.reload();
  await expect(page.getByLabel("Art style", { exact: true })).toHaveValue(
    "pixel",
  );
  expect(errors).toEqual([]);
});
test("legacy recipes upgrade without losing custom presets", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "spriteforge-v1",
      JSON.stringify({
        state: {
          recipe: { name: "My old recipe", cellSize: 128 },
          presets: [{ name: "My old recipe", cellSize: 128 }],
          grid: true,
          outputMode: "all",
        },
        version: 0,
      }),
    ),
  );
  await page.reload();
  await expect(page.getByLabel("Art style", { exact: true })).toHaveValue(
    "original",
  );
  await expect(page.getByLabel("Preset", { exact: true })).toHaveValue(
    "My old recipe",
  );
  await page
    .getByLabel("Preset", { exact: true })
    .selectOption("Pixel Fantasy");
  await expect(page.getByLabel("Art style", { exact: true })).toHaveValue(
    "pixel",
  );
});
test("animated cartoon and hybrid preserve clip frames and transparent output", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Sentinel Animated character" })
    .click();
  await expect(page.getByLabel("Animation clip")).toBeVisible();
  await page.getByLabel("Animation clip").selectOption("0");
  await page.getByLabel("Animation FPS").fill("6");
  await page.getByLabel("Cell size", { exact: true }).selectOption("64");
  await page.getByRole("button", { name: "Bake 3 style sets" }).click();
  await expect(
    page.getByRole("region", { name: "Style comparison" }),
  ).toBeVisible();
  await expect(page.locator(".frame-card")).toHaveCount(48);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export 3 sets" }).click();
  const files = unzipSync(readFileSync((await (await download).path())!));
  for (const name of ["Sentinel_Painted_Cartoon", "Sentinel_Pixel_Realism"]) {
    const m = JSON.parse(strFromU8(files[`${name}/${name}.json`]));
    expect(m.animations.Idle.frameCount).toBe(6);
    expect(m.background).toBe("transparent");
    expect(files[`${name}/frames/${m.frames[0].file}`]).not.toEqual(
      files[`${name}/frames/${m.frames[1].file}`],
    );
  }
});
