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
  console.log(
    "Production smoke passed: 1366×768 UI, desktop CSP, WebAssembly decoder, import, 8-view generation and ZIP export.",
  );
} finally {
  await browser?.close();
  server.kill();
}
