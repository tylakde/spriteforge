import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
test("animated character builds every state, plays baked sprites and exports Unreal package", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Character Forge", exact: true })
    .click();
  await page.getByRole("button", { name: "Try animated Knight demo" }).click();
  await expect(page.getByLabel("State name 7", { exact: true })).toHaveValue(
    "Dodge",
  );
  await page.getByLabel("Character resolution").selectOption("128");
  await page.getByText("Advanced rendering", { exact: true }).click();
  await page.getByLabel("Character FPS").fill("4");
  await page.getByRole("button", { name: "Build playable character" }).click();
  await expect(
    page.getByRole("dialog", { name: "Character play test" }),
  ).toBeVisible();
  const debug = page.getByTestId("play-debug"),
    arena = page.getByLabel("Playable sprite arena");
  await expect(debug).toContainText("State: Idle");
  await arena.focus();
  await page.keyboard.down("w");
  await expect(debug).toContainText("State: Walk");
  await page.keyboard.down("Shift");
  await expect(debug).toContainText("State: Run");
  await page.keyboard.up("w");
  await page.keyboard.up("Shift");
  await expect(debug).toContainText("State: Idle");
  await arena.click();
  await expect(debug).toContainText("State: Attack");
  await expect(debug).toContainText("State: Idle");
  await page.getByRole("button", { name: "Test Death", exact: true }).click();
  await expect(debug).toContainText("State: Death");
  await page.waitForTimeout(1200);
  await expect(debug).toContainText("Frame: 4/4");
  await page
    .getByRole("button", { name: "Reset character", exact: true })
    .click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByLabel("Preview state").selectOption("Walk");
  await page.getByLabel("Direction lock").selectOption("135");
  await page.getByRole("button", { name: "Frame step", exact: true }).click();
  await expect(debug).toContainText("Direction: 135°");
  await expect(debug).toContainText("Frame: 2/4");
  await page.screenshot({ path: "test-results/character-play-test.png" });
  await page.getByRole("button", { name: "Close play test" }).click();
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Send to Unreal", exact: true })
    .click();
  const files = unzipSync(readFileSync((await (await dl).path())!));
  const m = JSON.parse(strFromU8(files["ForgeKnight.character.json"]));
  expect(m.format).toBe("spriteforge-character");
  expect(m.states).toHaveLength(7);
  expect(m.defaultState).toBe("Idle");
  expect(
    new Set(m.states.map((s: any) => JSON.stringify(s.sprite.anchor))).size,
  ).toBe(1);
  expect(m.states.map((s: any) => s.name)).toEqual([
    "Idle",
    "Walk",
    "Run",
    "Attack",
    "Hit",
    "Death",
    "Dodge",
  ]);
  for (const s of m.states) {
    expect(files[s.atlas]?.length).toBeGreaterThan(100);
    expect(JSON.parse(strFromU8(files[s.metadata]))).toEqual(s.sprite);
    expect(s.sprite.frames).toHaveLength(32);
  }
  expect(files[m.states[0].atlas]).not.toEqual(files[m.states[1].atlas]);
  mkdirSync("test-results/character-export", { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    mkdirSync(
      `test-results/character-export/${name.split("/").slice(0, -1).join("/")}`,
      { recursive: true },
    );
    writeFileSync(`test-results/character-export/${name}`, data);
  }
  await page.screenshot({ path: "test-results/character-forge.png" });
  expect(errors).toEqual([]);
});
