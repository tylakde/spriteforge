# SpriteForge

A local GLB/GLTF → directional sprite and animated atlas baker for Unreal Engine 5. React, Three.js and Tauri 2. No accounts, hosted backend or runtime cloud service.

![SpriteForge workspace](docs/workspace.png)

## Run

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:1420. Browser mode supports the complete bake pipeline and ZIP exports. Try the included **Runestone** (textured static prop) and **Sentinel** (animated character) samples.

For the desktop app, install [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and stable Rust, then:

```sh
npm run tauri -- dev
```

Linux prerequisites (Ubuntu/Debian):

```sh
sudo apt-get install build-essential pkg-config libwebkit2gtk-4.1-dev libssl-dev libxdo-dev librsvg2-dev libayatana-appindicator3-dev
```

Windows requires Microsoft C++ build tools and WebView2. macOS requires Xcode command line tools. Use `npm run tauri -- build --bundles nsis` on Windows and `--bundles dmg` on macOS; the checked-in default targets Linux.

## Workflow

1. Import one or more `.glb` assets, or import/drop a folder containing `.gltf`, `.bin` and textures. GLTF resources resolve locally; remote resource fetching is disabled.
2. Inspect with orbit, pan and zoom. Reset, grid and background controls are at the top right of the viewport. Inspection does not change the bake camera.
3. Select a preset or edit resolution, camera, directions, lighting, anchor, padding and outline. Save custom recipes or exchange recipe JSON. Preferences persist locally.
4. For animation, select a clip and FPS. The preview supports playback and scrubbing; the bake samples explicit timestamps with fixed framing across all frames and directions.
5. Generate and click any thumbnail for full-size inspection. Select an export mode and export.
6. Batch processes the checked library items sequentially. With a clip selected, batch bakes the first clip from each asset. A missing or malformed asset produces an item error and the queue continues.

Desktop exports ask for a destination and create a unique asset folder (`Runestone`, `Runestone_001`, …). Existing exports are never overwritten. Browser mode downloads a ZIP per export; a browser may request permission for multiple batch downloads.

```text
Runestone/
  Runestone_atlas.png
  Runestone.json
  frames/
    Runestone_dir000.png
    Runestone_dir045.png
    ...
```

## Art styles and variation sets

Choose **Art style** in the recipe panel, or select one of the new built-in presets:

| Style | Treatment |
| --- | --- |
| Pixel Fantasy | Coarse 4× pixel blocks, reduced colour steps, subtle fixed dithering and crisp alpha silhouettes. |
| Painted Cartoon | Warcraft-inspired matte toon lighting, configurable shading bands, richer colour and a smooth outline. |
| Pixel Realism | Finer 2× pixels, restrained colour grading and retained textured lighting detail. |
| Original PBR | The original material rendering. Legacy recipes load in this mode. |

**Tune appearance** exposes pixel block size, colour steps, saturation, contrast, dithering and (for cartoon) shading bands. Cell size still controls the exported PNG dimensions. Stylisation changes rendering; it preserves the source geometry and texture artwork. The inspection viewport shows the original asset; generated views show the baked style.

**Bake 3 style sets** generates the three default looks sequentially using your current camera, output dimensions, directions and animation settings. It reserves identical framing across the sets. Use the style tabs to select a set, **Compare** for a large side-by-side view, and **Export 3 sets** for a single ZIP or native folder containing all styles. Tune an individual style and use **Generate** to customise it; ordinary batch processing uses the selected recipe's style.

Exports use distinct asset names such as `Runestone_Pixel_Fantasy`, `Runestone_Painted_Cartoon` and `Runestone_Pixel_Realism`, so Unreal imports coexist. Appearance/filter settings and the shared framing margin are saved in recipes and metadata. Re-generating a selected variation reproduces its original framing.

![Style comparison](docs/style-comparison.png)

Ready-to-import example sets are in `docs/examples/styles/`. The updated Unreal importer applies nearest-neighbour filtering to pixelated styles and bilinear filtering to smooth styles.

## Development and checks

```sh
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles deb
```

`npm run fixtures` regenerates the original procedural sample assets. CI checks the web workflows and builds Linux and Windows desktop packages. Download its artifact from the private repository's Actions page.

## Unreal Engine

The plugin and install instructions live in `unreal/SpriteForgeImporter/`; see [Unreal integration](docs/UNREAL_INTEGRATION.md). The baker's version 1 metadata contains explicit rectangles, UVs, frame timing, direction angles and anchor data.

## Limits

- RGBA colour pass only; no normals, depth or production LOD manager in v1.
- GLB/GLTF with standard PBR materials, embedded or local PNG/JPEG/WebP textures. Draco and KTX2 compressed assets must be re-exported without those compression extensions. Meshopt decoding is bundled locally.
- Atlas limit: 8192px per dimension and 32 megapixels; reduce resolution/FPS/directions when needed. Animations use a single selected clip per export.
- No automatic root-motion removal; exported animation retains source motion. Bounds cover every exported pose.
- Baked lighting is fixed in world space; metallic assets use direct/hemisphere lighting without environment reflections.

Ready-to-import static and animated example exports are included in `docs/examples/`.

See [PROGRESS.md](PROGRESS.md) for actual validation status and [DECISIONS.md](DECISIONS.md) for implementation choices.

Locally produced installers and the compiled UE 5.8 Windows plugin are in the ignored `artifacts/` folder. The current Linux package is `artifacts/linux/deb/SpriteForge_1.0.0_amd64.deb`; install it with `sudo apt install ./artifacts/linux/deb/SpriteForge_1.0.0_amd64.deb`. Normal installation resolves the WebKit runtime dependencies. The Windows CI artifact is named `SpriteForge-Windows` when its job completes.
