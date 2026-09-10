import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { createHash } from "node:crypto";
test("all 15 styles bake distinct exports, compare and persist a chosen subset", async ({
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
  ).toHaveCount(15);
  await page
    .getByRole("button", { name: "Runestone Textured environment prop" })
    .click();
  await page.getByText("Choose styles (3 / 15)", { exact: true }).click();
  await page.getByRole("button", { name: "Select all 15" }).click();
  await page.getByRole("button", { name: "Bake 15 style sets" }).click();
  await expect(page.locator(".variation-options button")).toHaveCount(15, {
    timeout: 90000,
  });
  await expect(page.locator(".frame-card")).toHaveCount(8);
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByRole("dialog").locator("img")).toHaveCount(15);
  await page
    .getByRole("dialog")
    .locator("img")
    .evaluateAll(async (images) => {
      await Promise.all(
        images.map((image) => (image as HTMLImageElement).decode()),
      );
    });
  await page.screenshot({ path: "test-results/fifteen-styles.png" });
  await page.getByRole("button", { name: "Next view" }).click();
  await expect(page.getByRole("dialog")).toContainText("45°");
  await page.getByRole("button", { name: "Close style comparison" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export 15 sets" }).click();
  const files = unzipSync(readFileSync((await (await download).path())!));
  const metadata = Object.keys(files)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(strFromU8(files[name])));
  expect(metadata).toHaveLength(15);
  expect(new Set(metadata.map((m) => m.asset)).size).toBe(15);
  expect(new Set(metadata.map((m) => m.anchor.y)).size).toBe(1);
  const hashes = metadata.map((m) => {
    expect(m.frames).toHaveLength(8);
    return createHash("sha256")
      .update(files[`${m.asset}/frames/${m.frames[0].file}`])
      .digest("hex");
  });
  expect(new Set(hashes).size).toBe(15);
  const handheld = metadata.find((m) => m.recipe.style === "handheld");
  expect(handheld.appearance.textureFilter).toBe("nearest");
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
    Array.from(files[`${handheld.asset}/frames/${handheld.frames[0].file}`]),
  );
  expect(palette.colors.length).toBeLessThanOrEqual(4);
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
  await page.getByLabel("Include Terracotta Clay").check();
  await page.getByLabel("Include Ink Engraving").check();
  await page.reload();
  await page.getByText("Choose styles (2 / 15)", { exact: true }).click();
  await expect(page.getByLabel("Include Terracotta Clay")).toBeChecked();
  await expect(page.getByLabel("Include Ink Engraving")).toBeChecked();
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
      .locator("option", { hasText: "Handheld Green" }),
  ).toHaveCount(1);
  await page
    .getByLabel("Preset", { exact: true })
    .selectOption("Handheld Green");
  await page.reload();
  await expect(
    page
      .getByLabel("Preset", { exact: true })
      .locator("option", { hasText: "Handheld Green" }),
  ).toHaveCount(1);
});
