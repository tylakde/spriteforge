import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "1421",
    "--strictPort",
  ],
  { stdio: "ignore" },
);
let browser;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Production preview server could not start.");
    try {
      if ((await fetch("http://127.0.0.1:1421")).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-gl=angle",
      "--use-angle=swiftshader",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      /Content Security|wasm|WebAssembly/.test(msg.text())
    )
      errors.push(msg.text());
  });
  const csp = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")).app
    .security.csp;
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "Content-Security-Policy": csp },
    });
  });
  await page.goto("http://127.0.0.1:1421");
  await page
    .getByRole("button", { name: "Runestone Textured environment prop" })
    .click();
  await page
    .getByRole("button", { name: "Generate", exact: true })
    .click({ timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelectorAll(".frame-card").length === 8,
    {},
    { timeout: 30000 },
  );
  assert.equal(await page.locator(".frame-card").count(), 8);
  assert.deepEqual(errors, []);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export", exact: true })
    .last()
    .click();
  assert.equal((await download).suggestedFilename(), "Runestone_all.zip");
  await page
    .getByRole("button", { name: "Character Forge", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Try animated Knight demo", exact: true })
    .click();
  await page.getByLabel("State name 7", { exact: true }).waitFor();
  await page.getByLabel("Character directions").selectOption("4");
  await page.getByLabel("Character resolution").selectOption("128");
  await page.getByText("Advanced rendering", { exact: true }).click();
  await page.getByLabel("Character FPS").fill("2");
  await page
    .getByRole("button", { name: "Build playable character", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Character play test" })
    .waitFor({ timeout: 60000 });
  await page.getByLabel("Playable sprite arena").focus();
  await page.keyboard.down("w");
  await page.waitForFunction(() =>
    document
      .querySelector('[data-testid="play-debug"]')
      ?.textContent?.includes("State: Walk"),
  );
  await page.keyboard.up("w");
  await page
    .getByRole("button", { name: "Close play test", exact: true })
    .click();
  const character = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Send to Unreal", exact: true })
    .click();
  assert.equal(
    (await character).suggestedFilename(),
    "ForgeKnight_character.zip",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Production smoke passed: desktop CSP, WebAssembly decoder, original 8-view bake/export, complete character bake, playable sprites and Unreal package export.",
  );
} finally {
  await browser?.close();
  server.kill();
}
