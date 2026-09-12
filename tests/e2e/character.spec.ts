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
  await page.locator(".character-forge").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: "test-results/character-forge.png" });
  expect(errors).toEqual([]);
});

test("modular skinned equipment, socket attachment, animation library, loadout and unique variations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Character Forge", exact: true })
    .click();
  await page
    .getByLabel("Import character files")
    .setInputFiles(
      [
        "Base_Human",
        "Chest_Iron",
        "Chest_Gold",
        "Chest_Shadow",
        "Weapon_Sword",
        "Human_Combat_Animations",
      ].map((n) => `public/samples/factory/${n}.glb`),
    );
  await page
    .getByRole("button", { name: "Modular character factory", exact: true })
    .click();
  await expect(page.locator(".factory-library > button")).toHaveCount(6);
  await expect(page.getByLabel("State name 6", { exact: true })).toHaveValue(
    "Death",
  );
  await page
    .getByLabel("Slot Chest", { exact: true })
    .selectOption({ label: "Chest_Iron.glb" });
  await page
    .locator(".factory-library > button")
    .filter({ hasText: "Weapon_Sword.glb" })
    .click();
  await page.getByLabel("Attachment mode").selectOption("socket");
  await page.getByLabel("Attachment bone").selectOption("Hand");
  await page.getByLabel("Attachment rotation Z").fill("-30");
  await page
    .getByLabel("Slot Main Weapon", { exact: true })
    .selectOption({ label: "Weapon_Sword.glb" });
  await page
    .getByLabel("Shared animation library")
    .selectOption({ label: "Human_Combat_Animations.glb" });
  await page.getByLabel("Character resolution").selectOption("128");
  await page.getByText("Advanced rendering", { exact: true }).click();
  await page.getByLabel("Character FPS").fill("2");
  await page.getByLabel("Character name", { exact: true }).fill("Iron Recruit");
  await page.getByLabel("State name 4", { exact: true }).fill("Sword Attack");
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save loadout", exact: true }).click();
  const loadoutPath = (await (await save).path())!,
    loadout = JSON.parse(readFileSync(loadoutPath, "utf8"));
  expect(loadout.parts).toHaveLength(2);
  expect(
    loadout.parts.find((p: any) => p.slot === "Main Weapon").attachment,
  ).toMatchObject({ mode: "socket", bone: "Hand", rotation: [0, 0, -30] });
  await page
    .getByLabel("Slot Chest", { exact: true })
    .selectOption({ label: "Chest_Gold.glb" });
  await page.getByLabel("Load character loadout").setInputFiles({
    name: "Recruit.spriteforge-character.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(loadout)),
  });
  await expect(page.getByLabel("Slot Chest", { exact: true })).toHaveValue(
    loadout.parts.find((p: any) => p.slot === "Chest").assetId,
  );
  await expect(page.getByLabel("State name 4", { exact: true })).toHaveValue(
    "Sword Attack",
  );
  await expect(
    page.getByRole("button", { name: "Build playable character", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Build playable character", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Character play test" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close play test" }).click();
  await page.getByLabel("Randomise Chest", { exact: true }).check();
  await page.getByLabel("Population count").fill("3");
  await page
    .getByRole("button", {
      name: "Generate variations / population",
      exact: true,
    })
    .click();
  await expect(page.locator(".character-variation")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Bake selected characters", exact: true }),
  ).toBeEnabled();
  const images = await page
    .locator(".character-variation img")
    .evaluateAll(async (imgs) =>
      Promise.all(
        imgs.map(async (img) =>
          Array.from(
            new Uint8Array(
              await (await fetch((img as HTMLImageElement).src)).arrayBuffer(),
            ),
          ).join(","),
        ),
      ),
    );
  expect(new Set(images).size).toBe(3);
  await page.screenshot({
    path: "test-results/character-factory.png",
    fullPage: true,
  });
  // All three finite combinations are present; a reroll reports exhaustion instead of duplicating one.
  await page
    .locator(".character-variation")
    .first()
    .getByRole("button", { name: "Reroll", exact: true })
    .click();
  await expect(page.getByRole("alert").last()).toContainText(
    "No unused combinations",
  );
  const download = page.waitForEvent("download");
  const cards = page.locator(".character-variation");
  await cards
    .nth(1)
    .getByRole("checkbox", { name: /^Select/ })
    .uncheck();
  await cards
    .nth(2)
    .getByRole("checkbox", { name: /^Select/ })
    .uncheck();
  await page
    .getByRole("button", { name: "Bake selected characters", exact: true })
    .click();
  const output = unzipSync(readFileSync((await (await download).path())!));
  expect(Object.keys(output).some((k) => k.endsWith(".character.json"))).toBe(
    true,
  );
  await expect(cards.first()).toContainText("Exported — ready for Unreal");
  expect(errors).toEqual([]);
});

test("City Guard demo produces 50 unique visual previews with bounded estimates and cancellation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Character Forge", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Try modular Guard demo", exact: true })
    .click();
  await expect(page.locator(".factory-library > button")).toHaveCount(15);
  await page
    .getByRole("button", { name: "Use City Guard demo template", exact: true })
    .click();
  await expect(page.getByLabel("Population count")).toHaveValue("50");
  await page
    .getByRole("button", {
      name: "Generate variations / population",
      exact: true,
    })
    .click();
  await expect(page.locator(".character-variation")).toHaveCount(50, {
    timeout: 90000,
  });
  await expect(
    page.getByRole("button", { name: "Bake all characters", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".population-estimate")).toContainText(
    "28,800 frames",
  );
  const hashes = await page
    .locator(".character-variation img")
    .evaluateAll(async (imgs) =>
      Promise.all(
        imgs.map(async (img) =>
          Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                await (
                  await fetch((img as HTMLImageElement).src)
                ).arrayBuffer(),
              ),
            ),
          ).join(""),
        ),
      ),
    );
  expect(new Set(hashes).size).toBe(50);
  await page
    .getByRole("button", { name: "Bake all characters", exact: true })
    .click();
  await expect(page.getByRole("alert").last()).toContainText(
    "Review and acknowledge",
  );
  await page.getByRole("button", { name: "Sprite Baker", exact: true }).click();
  await page
    .getByRole("button", { name: "Character Forge", exact: true })
    .click();
  await expect(page.locator(".character-variation")).toHaveCount(50);
  await page.getByLabel("Population count").fill("201");
  await expect(
    page.getByRole("button", {
      name: "Generate variations / population",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByLabel("Population count").fill("10");
  await page
    .getByRole("button", {
      name: "Generate variations / population",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Cancel character build", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Generate variations / population",
      exact: true,
    }),
  ).toBeEnabled();
  expect(
    await page.locator(".character-variation").count(),
  ).toBeGreaterThanOrEqual(50);
  await page.locator(".population-heading").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/population-factory.png" });
});
