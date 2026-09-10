import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { createHash } from "node:crypto";
test("all 8 styles bake distinct exports, compare and persist a chosen subset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      /Shader Error|VALIDATE_STATUS|shader error/i.test(msg.text())
    )
      errors.push(msg.text());
  });
  await page.goto("/");
  await expect(
    page.getByLabel("Art style", { exact: true }).locator("option"),
  ).toHaveCount(8);
  await page
    .getByRole("button", { name: "Runestone Textured environment prop" })
    .click();
  await page.getByText("Choose styles (3 / 8)", { exact: true }).click();
  await page.getByRole("button", { name: "Select all 8" }).click();
  await page.getByRole("button", { name: "Bake 8 style sets" }).click();
  await expect(page.locator(".variation-options button")).toHaveCount(8, {
    timeout: 90000,
  });
  await expect(page.locator(".frame-card")).toHaveCount(8);
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByRole("dialog").locator("img")).toHaveCount(8);
  await page
    .getByRole("dialog")
    .locator("img")
    .evaluateAll(async (images) => {
      await Promise.all(
        images.map((image) => (image as HTMLImageElement).decode()),
      );
    });
  await page.screenshot({ path: "test-results/eight-styles.png" });
  await page.getByRole("button", { name: "Next view" }).click();
  await expect(page.getByRole("dialog")).toContainText("45°");
  await page.getByRole("button", { name: "Close style comparison" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export 8 sets" }).click();
  const files = unzipSync(readFileSync((await (await download).path())!));
  const metadata = Object.keys(files)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(strFromU8(files[name])));
  expect(metadata).toHaveLength(8);
  expect(new Set(metadata.map((m) => m.asset)).size).toBe(8);
  expect(new Set(metadata.map((m) => m.anchor.y)).size).toBe(1);
  const hashes = metadata.map((m) => {
    expect(m.frames).toHaveLength(8);
    return createHash("sha256")
      .update(files[`${m.asset}/frames/${m.frames[0].file}`])
      .digest("hex");
  });
  expect(new Set(hashes).size).toBe(8);
  const retro = metadata.find((m) => m.recipe.style === "retro");
  expect(retro.appearance.textureFilter).toBe("nearest");
  const palette = await page.evaluate(
    async (bytes) => {
      const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      const c = document.createElement("canvas");
      c.width = c.height = bmp.width;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      const p = ctx.getImageData(0, 0, c.width, c.height).data;
      const colors = new Set<string>();
      let opaque = 0,
        clear = 0;
      for (let i = 0; i < p.length; i += 4) {
        if (p[i + 3]) {
          opaque++;
          colors.add(`${p[i]},${p[i + 1]},${p[i + 2]}`);
        } else clear++;
      }
      return { colors: [...colors], opaque, clear };
    },
    Array.from(files[`${retro.asset}/frames/${retro.frames[0].file}`]),
  );
  expect(palette.colors.length).toBeLessThanOrEqual(16);
  expect(palette.opaque).toBeGreaterThan(500);
  expect(palette.clear).toBeGreaterThan(1000);
  mkdirSync("test-results/catalogue-export", { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    const destination = "test-results/catalogue-export/" + name;
    mkdirSync(destination.slice(0, destination.lastIndexOf("/")), {
      recursive: true,
    });
    writeFileSync(destination, data);
  }
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Bake 0 style sets" }),
  ).toBeDisabled();
  await page.getByLabel("Include Comic Cel").check();
  await page.getByLabel("Include Pastel Storybook").check();
  await page.reload();
  await page.getByText("Choose styles (2 / 8)", { exact: true }).click();
  await expect(page.getByLabel("Include Comic Cel")).toBeChecked();
  await expect(page.getByLabel("Include Pastel Storybook")).toBeChecked();
  expect(errors).toEqual([]);
});
test("three-style-era custom presets survive catalogue migration", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "spriteforge-v1",
      JSON.stringify({
        state: {
          recipe: { name: "My cartoon", style: "cartoon", saturation: 1.7 },
          presets: [{ name: "My cartoon", style: "cartoon", saturation: 1.7 }],
          grid: true,
          outputMode: "all",
        },
        version: 0,
      }),
    ),
  );
  await page.reload();
  await expect(page.getByLabel("Preset", { exact: true })).toHaveValue(
    "My cartoon",
  );
  await expect(page.getByLabel("Art style", { exact: true })).toHaveValue(
    "cartoon",
  );
  await expect(
    page
      .getByLabel("Preset", { exact: true })
      .locator("option", { hasText: "Retro 8 Bit" }),
  ).toHaveCount(1);
  await page.getByLabel("Preset", { exact: true }).selectOption("Retro 8 Bit");
  await page.reload();
  await expect(
    page
      .getByLabel("Preset", { exact: true })
      .locator("option", { hasText: "Retro 8 Bit" }),
  ).toHaveCount(1);
});

test("removed styles migrate without resetting surviving custom presets and preferences", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "spriteforge-v1",
      JSON.stringify({
        state: {
          styleCatalogVersion: 2,
          recipe: {
            name: "My clay framing",
            style: "clay",
            cellSize: 128,
            cameraElevation: 27,
          },
          presets: [
            { name: "Terracotta Clay", style: "clay" },
            { name: "Handheld Green", style: "handheld" },
            { name: "My clay framing", style: "clay", cameraElevation: 27 },
            { name: "My cartoon", style: "cartoon", saturation: 1.7 },
          ],
          styleSelection: ["clay", "pixel", "ink", "cartoon", "handheld"],
          grid: false,
          previewBackground: "solid",
          outputMode: "atlas",
        },
        version: 0,
      }),
    ),
  );
  await page.reload();
  await expect(page.getByLabel("Art style", { exact: true })).toHaveValue(
    "original",
  );
  await expect(page.getByLabel("Cell size", { exact: true })).toHaveValue(
    "128",
  );
  await expect(page.getByLabel("Elevation °", { exact: true })).toHaveValue(
    "27",
  );
  await expect(page.getByLabel("Export contents")).toHaveValue("atlas");
  await expect(
    page
      .getByLabel("Preset", { exact: true })
      .locator("option", { hasText: "Terracotta Clay" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByLabel("Preset", { exact: true })
      .locator("option", { hasText: "Handheld Green" }),
  ).toHaveCount(0);
  await page.getByText("Choose styles (2 / 8)", { exact: true }).click();
  await expect(page.getByLabel("Include Pixel Fantasy")).toBeChecked();
  await expect(page.getByLabel("Include Painted Cartoon")).toBeChecked();
  await page.getByLabel("Preset", { exact: true }).selectOption("My cartoon");
  await page.getByText("Tune appearance", { exact: true }).click();
  await expect(page.getByLabel("Saturation", { exact: true })).toHaveValue(
    "1.7",
  );
  await page.reload();
  await expect(page.getByLabel("Art style", { exact: true })).toHaveValue(
    "cartoon",
  );
});
