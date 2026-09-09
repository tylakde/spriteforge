import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
test("static GLB → visible preview → 8 transparent sprites → atlas + metadata; persistence and malformed input", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Runestone Textured environment prop" })
    .click();
  await expect(page.getByText("7 meshes")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.locator(".frame-card")).toHaveCount(8);
  await page.screenshot({ path: "test-results/workspace.png" });
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export", exact: true })
    .last()
    .click();
  const download = await dl;
  const path = await download.path();
  const files = unzipSync(readFileSync(path!));
  const metadata = JSON.parse(strFromU8(files["Runestone.json"]));
  expect(metadata.frames).toHaveLength(8);
  expect(metadata.directions).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
  expect(
    Object.keys(files).filter((x) => x.startsWith("frames/")),
  ).toHaveLength(8);
  expect(files["frames/Runestone_dir000.png"]).not.toEqual(
    files["frames/Runestone_dir180.png"],
  );
  const png = files["frames/Runestone_dir000.png"];
  expect(Array.from(png.slice(0, 8))).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  const stats = await page.evaluate(async (bytes) => {
    const bmp = await createImageBitmap(
      new Blob([new Uint8Array(bytes)], { type: "image/png" }),
    );
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    const p = ctx.getImageData(0, 0, c.width, c.height).data;
    let opaque = 0,
      transparent = 0,
      colour = 0,
      edge = 0;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] === 0) transparent++;
      if (p[i + 3] > 200) {
        opaque++;
        colour += p[i] + p[i + 1] + p[i + 2];
      }
      if (
        (i / 4 < c.width ||
          i / 4 >= c.width * (c.height - 1) ||
          (i / 4) % c.width === 0 ||
          (i / 4) % c.width === c.width - 1) &&
        p[i + 3] > 0
      )
        edge++;
    }
    return {
      width: c.width,
      height: c.height,
      opaque,
      transparent,
      colour,
      edge,
    };
  }, Array.from(png));
  expect(stats.width).toBe(256);
  expect(stats.height).toBe(256);
  expect(stats.opaque).toBeGreaterThan(1500);
  expect(stats.transparent).toBeGreaterThan(10000);
  expect(stats.colour).toBeGreaterThan(10000);
  expect(stats.edge).toBe(0);
  mkdirSync("test-results/export", { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    if (!name.includes("/")) writeFileSync(`test-results/export/${name}`, data);
  }
  await page.getByLabel("Cell size", { exact: true }).selectOption("128");
  await page.getByLabel("Recipe name", { exact: true }).fill("My prop preset");
  await page.getByTitle("Save or rename recipe").click();
  await page.reload();
  await expect(page.getByLabel("Cell size", { exact: true })).toHaveValue(
    "128",
  );
  await expect(page.getByLabel("Preset", { exact: true })).toHaveValue(
    "My prop preset",
  );
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("fixtures/malformed.glb");
  await expect(page.getByRole("alert")).toContainText("Could not load");
  expect(errors).toEqual([]);
});
test("animated deterministic bake and individual frames export", async ({
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
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.locator(".frame-card")).toHaveCount(48);
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export", exact: true })
    .last()
    .click();
  const files = unzipSync(readFileSync((await (await dl).path())!));
  const m = JSON.parse(strFromU8(files["Sentinel.json"]));
  expect(m.animations.Idle).toEqual({ fps: 6, frameCount: 6, duration: 1 });
  expect(m.frames[7]).toMatchObject({
    directionDegrees: 45,
    animationFrame: 1,
  });
  const first = files[`frames/${m.frames[0].file}`];
  const second = files[`frames/${m.frames[1].file}`];
  expect(first).not.toEqual(second);
  mkdirSync("test-results/animated-export", { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    if (!name.includes("/"))
      writeFileSync(`test-results/animated-export/${name}`, data);
  }
  // Bake again from explicit mixer times and compare bytes, independent of inspection playback.
  await page
    .getByRole("button", { name: "Play animation", exact: true })
    .click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByText("Ready to export", { exact: true }),
  ).toBeVisible();
  const dl2 = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export", exact: true })
    .last()
    .click();
  const again = unzipSync(readFileSync((await (await dl2).path())!));
  expect(again[`frames/${m.frames[0].file}`]).toEqual(first);
});
test("GLTF sidecars and batch continue after a malformed item", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles([
      "fixtures/malformed.glb",
      "fixtures/sidecar/Runestone.gltf",
      "fixtures/sidecar/mesh.bin",
    ]);
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Cell size", { exact: true }).selectOption("64");
  await page.getByRole("button", { name: "Batch (2)" }).click();
  await expect(page.locator(".queue-item.error")).toHaveCount(1);
  await expect(page.locator(".queue-item.done")).toHaveCount(1);
  await expect(page.locator(".queue-item.done")).toContainText("Runestone");
});

test("outline, solid background, recipe JSON validation and 32 views", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Runestone Textured environment prop" })
    .click();
  await expect(
    page.getByRole("button", { name: "Generate", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Cell size", { exact: true }).selectOption("64");
  await page.getByRole("button", { name: "32", exact: true }).click();
  await page.getByLabel("Silhouette outline").check();
  await page.getByLabel("Background", { exact: true }).selectOption("solid");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.locator(".frame-card")).toHaveCount(32);
  await page.locator(".frame-card").first().click();
  await expect(
    page.getByRole("dialog", { name: "Frame inspection" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close inspection" }).click();
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export", exact: true })
    .last()
    .click();
  const files = unzipSync(readFileSync((await (await dl).path())!));
  const m = JSON.parse(strFromU8(files["Runestone.json"]));
  expect(m.background).toBe("solid");
  expect(m.recipe.outlineEnabled).toBe(true);
  expect(m.directions[1]).toBe(11.25);
  const alpha = await page.evaluate(
    async (bytes) => {
      const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      return Array.from(ctx.getImageData(0, 0, 64, 64).data)
        .filter((_, i) => i % 4 === 3)
        .every((v) => v === 255);
    },
    Array.from(files["frames/" + m.frames[0].file]),
  );
  expect(alpha).toBe(true);
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"cellSize":999}'),
  });
  await expect(page.getByRole("alert")).toContainText("Invalid recipe");
});
