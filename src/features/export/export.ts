import { strToU8, zip } from "fflate";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import type { Generation } from "../../types";
import { safeName } from "../../lib/math";
export type ExportMode = "all" | "atlas" | "frames";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function exportRecipe(text: string, name: string) {
  if (isTauri()) {
    const path = await save({
      defaultPath: `${safeName(name)}.recipe.json`,
      filters: [{ name: "Recipe JSON", extensions: ["json"] }],
    });
    if (path) await writeFile(path, new TextEncoder().encode(text));
  } else
    download(
      new Blob([text], { type: "application/json" }),
      `${safeName(name)}.recipe.json`,
    );
}
export async function chooseOutputDirectory() {
  return isTauri()
    ? await open({
        directory: true,
        multiple: false,
        title: "Choose SpriteForge output folder",
      })
    : null;
}
export async function generationFiles(
  generation: Generation,
  mode: ExportMode,
) {
  const files: Record<string, Uint8Array> = {};
  const { metadata } = generation;
  if (mode !== "frames") {
    files[metadata.atlas.file] = new Uint8Array(
      await generation.atlas.arrayBuffer(),
    );
    files[`${metadata.asset}.json`] = strToU8(
      JSON.stringify(metadata, null, 2),
    );
  }
  if (mode !== "atlas")
    for (let i = 0; i < generation.frames.length; i++)
      files[`frames/${metadata.frames[i].file}`] = new Uint8Array(
        await generation.frames[i].arrayBuffer(),
      );
  return files;
}
async function writeExport(
  files: Record<string, Uint8Array>,
  assetName: string,
  zipName: string,
  directory?: string | null,
) {
  if (isTauri()) {
    const output = directory ?? (await chooseOutputDirectory());
    if (!output) return null;
    // Rust creates a fresh directory atomically and only writes safe relative filenames into it.
    return await invoke<string>("export_files", {
      directory: output,
      name: assetName,
      files: Object.entries(files).map(([path, data]) => ({
        path,
        data: Array.from(data),
      })),
    });
  }
  const data = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 0 }, (error, result) =>
      error ? reject(error) : resolve(result),
    ),
  );
  const name = zipName;
  download(new Blob([new Uint8Array(data)], { type: "application/zip" }), name);
  return name;
}
export async function exportGeneration(
  generation: Generation,
  mode: ExportMode,
  directory?: string | null,
) {
  return writeExport(
    await generationFiles(generation, mode),
    generation.metadata.asset,
    `${generation.metadata.asset}_${mode}.zip`,
    directory,
  );
}
export async function exportVariationSets(
  generations: Generation[],
  mode: ExportMode,
) {
  if (!generations.length) throw new Error("Generate style sets first.");
  const files: Record<string, Uint8Array> = {};
  for (const generation of generations) {
    const content = await generationFiles(generation, mode);
    for (const [path, data] of Object.entries(content))
      files[`${generation.metadata.asset}/${path}`] = data;
  }
  const stem = safeName(generations[0].metadata.source) + "_styles";
  return writeExport(files, stem, `${stem}_${mode}.zip`);
}
export async function importNativeFiles(): Promise<File[]> {
  const selected = await open({
    multiple: true,
    title: "Import GLB or GLTF assets",
    filters: [{ name: "3D assets", extensions: ["glb", "gltf"] }],
  });
  if (!selected) return [];
  const paths = Array.isArray(selected) ? selected : [selected];
  const files: File[] = [];
  for (const [assetIndex, path] of paths.entries()) {
    // Resolve a GLTF's declared local resources next to the selected document, without allowing traversal outside its directory.
    const bytes = await readFile(path);
    const main = new File([new Uint8Array(bytes)], path.split(/[\\/]/).pop()!);
    Object.defineProperty(main, "webkitRelativePath", {
      value: `native_${assetIndex}/${main.name}`,
    });
    files.push(main);
    if (/\.gltf$/i.test(path)) {
      const doc = JSON.parse(new TextDecoder().decode(bytes));
      const resources = [...(doc.buffers || []), ...(doc.images || [])];
      for (const item of resources) {
        if (!item.uri || item.uri.startsWith("data:")) continue;
        const relative = decodeURIComponent(item.uri);
        if (/(^[\\/]|^[a-z]+:|(^|[\\/])\.\.([\\/]|$))/i.test(relative))
          throw new Error(
            "GLTF resource must be inside the asset folder. Use folder import for complex assets.",
          );
        const resource = await invoke<number[]>("read_sidecar", {
          assetPath: path,
          relative,
        });
        const f = new File(
          [new Uint8Array(resource)],
          relative.split("/").pop()!,
        );
        Object.defineProperty(f, "webkitRelativePath", {
          value: `native_${assetIndex}/${relative}`,
        });
        files.push(f);
      }
    }
  }
  return files;
}
