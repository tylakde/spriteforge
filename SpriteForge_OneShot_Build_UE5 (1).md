# SpriteForge — One-Shot Autonomous Build Brief

## Mission
Build a finished, working local desktop app called **SpriteForge**: a production-oriented **3D asset → 2D sprite / sprite-sheet / impostor baker** for a third-person, instance-based MMORPG being developed in Unreal Engine 5.

Core workflow:
**Import GLB/GLTF → preview → auto-frame → configure render recipe → generate directional sprites/animations → preview → export PNG frames + atlas + JSON metadata.**

This is an autonomous build. Do not stop at scaffolding, mock UI, pseudocode, TODOs, or a proof of concept. Continue implementing, running, testing, debugging and polishing until the core application works end-to-end. Make sensible technical decisions without asking routine questions. Prefer reliable working functionality over unnecessary complexity.

## Definition of Done
The user can:
1. Launch the app locally with documented commands.
2. Drag/drop or browse for `.glb`/`.gltf` assets.
3. See textured models in an interactive 3D preview with orbit/pan/zoom/reset.
4. Have models automatically centred, grounded and framed.
5. Configure resolution, projection, camera elevation, front direction, direction count, lighting, background, padding, anchor and optional outline.
6. Generate consistent 1/4/8/16/32-direction transparent sprites.
7. Preview all generated views.
8. Export individual transparent PNGs, an atlas PNG and versioned JSON metadata.
9. Save/load/customise render recipes.
10. Load animated GLB/GLTF files, select clips/FPS and bake deterministic directional animation sprite sheets.
11. Batch-process multiple assets using one recipe.
12. Retain recipes/preferences across restarts.
13. Receive useful errors rather than crashes.
14. Complete all core workflows locally with no cloud service.
15. Run tests and production builds successfully where the environment permits.

## Stack
Use unless a concrete blocker requires otherwise:
- TypeScript
- React + Vite
- Three.js
- Tauri 2
- Rust only where Tauri/native filesystem functionality requires it
- Zustand
- lightweight CSS/CSS modules
- npm
- Vitest; React Testing Library where useful; Playwright if practical

No authentication, hosted backend, database, paid API or cloud dependency.

## UI
Use the supplied reference screenshots as inspiration for information architecture, not assets to copy. Dark, compact, professional game-development-tool UI, usable around 1366×768.

```text
┌────────────────┬────────────────────────────────────┬────────────────────┐
│ ASSET LIBRARY  │           MODEL PREVIEW            │   RENDER RECIPE    │
│ Chest          │                                    │ Cell size          │
│ Mushroom       │             3D MODEL               │ Camera             │
│ Goblin         │                                    │ Directions         │
│ Sword          │                                    │ Lighting           │
│ + Import       │                                    │ Background/Outline │
├────────────────┴────────────────────────────────────┴────────────────────┤
│ GENERATED VIEWS / ANIMATION FRAMES                                      │
│ [0°] [45°] [90°] [135°] [180°] [225°] [270°] [315°]                    │
├──────────────────────────────────────────────────────────────────────────┤
│ Preset [Environment Prop ▼]       Generate       Export                 │
└──────────────────────────────────────────────────────────────────────────┘
```

Avoid marketing-style layout, giant typography and excessive decorative cards.

## Asset Import
Initially support `.glb` and `.gltf`.
On import:
- load geometry/textures and preserve PBR materials as accurately as practical
- calculate combined world-space bounds and dimensions
- centre horizontally and ground lowest point at Y=0
- calculate sensible target and automatic camera framing with padding
- detect animation clips
- show useful stats where practical: filename, triangles, meshes, materials, dimensions, animations
- fail gracefully on malformed assets

## Interactive Preview
Implement a proper Three.js viewport with perspective inspection camera, orbit/pan/zoom/reset, ground-grid toggle, transparent/checker/solid preview background, readable default lighting and animation playback controls when clips exist.

Keep the inspection camera separate from deterministic sprite-render settings. Moving the preview camera must not silently modify the render recipe.

## Render Recipe
Use a serialisable typed model similar to:

```ts
interface RenderRecipe {
  name: string;
  cellSize: 64 | 128 | 256 | 512 | 1024;
  projection: "orthographic" | "perspective";
  perspectiveFov: number;
  cameraElevation: number;
  frontDirection: number;
  directionCount: 1 | 4 | 8 | 16 | 32;
  lightAzimuth: number;
  lightElevation: number;
  lightIntensity: number;
  ambientIntensity: number;
  background: "transparent" | "solid";
  backgroundColor: string;
  paddingPercent: number;
  outlineEnabled: boolean;
  outlineWidth: number;
  anchor: "center" | "ground";
}
```

Extend cleanly where necessary.

## Directional Rendering
For N directions generate evenly spaced views around the vertical axis. Eight views are 0/45/90/135/180/225/270/315°. `frontDirection` offsets the model's assumed forward orientation.

Every output must remain consistently scaled, grounded, framed and coherently lit. Avoid clipping. Use stable world-space lighting or equivalent behavior.

## Offscreen Renderer
Use proper Three.js offscreen/WebGL render targets or another robust rendering method. Do **not** create production sprites by screenshotting DOM UI.

Requirements:
- RGBA and correct transparency
- configurable square cell size
- deterministic dimensions
- sensible anti-aliasing
- correct colour space/tone mapping
- clean transparent edges
- stable object scale

Handle renderer pixel ratio, premultiplied alpha, texture orientation, readback and resource disposal correctly.

## Auto-Framing / Anchoring
Critical requirement.
For static assets: calculate bounds, fit within cell, respect padding, preserve aspect ratio and maintain selected anchor.
For animations: do not independently zoom each frame. Determine stable clip/global bounds and retain identical framing across the sequence. Feet/base should remain visually anchored unless source root motion intentionally changes them.

Support centre and ground anchors.

## Generated Views
Show thumbnails after generation with angle/frame index. Allow selection/enlarged inspection and regeneration. For animations allow navigation by direction and animation frame.

## Animation Baking
When clips exist show clip selection, play/pause/scrub, FPS, loop preview and bake controls.
Suggested FPS: 6, 8, 10, 12, 15, 24, 30 plus sensible custom input.

Bake deterministically:
1. determine duration
2. calculate sample times
3. explicitly set mixer/action time for each sample
4. render each sample
5. repeat for each direction
6. use stable framing
7. build atlas
8. generate metadata

Do not rely on real-time playback timing for capture.

## Atlas / Frames
Export individual frames and atlas.
Examples:
`Goblin_dir045.png`
`Goblin_Idle_dir045_frame003.png`

Support horizontal strip for simple directional output and regular grid for animations, transparent cells and padding. Prefer power-of-two atlas dimensions when reasonable but do not waste huge space merely to force POT.

## Metadata
Export versioned JSON suitable for future UE5 tooling. Include:
- schema version
- source asset name
- atlas dimensions/cell dimensions
- frame rectangles
- direction angles
- animation names
- FPS/frame indices/timing
- pivot/anchor
- recipe needed to reproduce bake

Example shape:
```json
{
  "version": 1,
  "asset": "Goblin",
  "atlas": {"width": 2048, "height": 1024, "cellWidth": 256, "cellHeight": 256},
  "directions": [0,45,90,135,180,225,270,315],
  "anchor": {"type":"ground","x":0.5,"y":0.9},
  "animations": {"Idle":{"fps":12,"frameCount":16}},
  "frames": []
}
```

## Presets
Persistent built-ins:
- **Inventory Item:** 512px, perspective, 1 view, transparent, attractive 3/4 presentation
- **Environment Prop:** 256px, orthographic, 8 directions, transparent, ground anchor
- **Character Impostor:** 256px, 8 directions, transparent, ground anchor
- **Monster Impostor:** same basic intent as character
- **Map Asset:** 256px, elevated/top-down, transparent

Allow duplicate, rename, save, delete user presets, reset built-ins, import/export recipe JSON. Persist locally.

## Batch Processing
Select multiple GLB/GLTF files, recipe and output directory. Show queue/progress. For each asset: load → analyse → frame → render → atlas → metadata → export → continue. One failure must not abort the rest.

Suggested output:
```text
output/
  Chest/
    frames/
    Chest_atlas.png
    Chest.json
```

## Outline
Implement a simple robust optional silhouette outline, off by default, configurable width, compatible with transparency. Do not spend disproportionate effort on a sophisticated toon engine.

## Lighting
Provide key/directional light + ambient/hemisphere contribution, key azimuth/elevation/intensity and ambient intensity. Lighting remains stable between directions. Defaults should be readable and not overexposed.

## Export UX
Provide:
- Individual PNGs
- Atlas + Metadata
- Everything

Use native Tauri file/folder dialogs where appropriate. Sanitise filenames and do not silently overwrite unrelated files.

## Persistence
Persist user recipes, last recipe, preferences and sensible output settings. Recent source paths are optional. Do not persist giant model binaries unnecessarily. Missing paths must fail gracefully.

## Architecture
Keep React UI, Three.js preview, asset loading, recipes, deterministic renderer, animation sampling, atlas creation, filesystem/export and batch orchestration separate.

Suggested structure:
```text
src/
  app/
  components/
  features/
    assets/
    preview/
    recipes/
    renderer/
    generation/
    animation/
    atlas/
    batch/
    export/
  lib/
  stores/
  types/
```

Create clean internal boundaries conceptually like:
```ts
loadAsset(...)
analyseAsset(...)
calculateFraming(...)
prepareRenderScene(...)
renderDirection(...)
renderAnimationFrame(...)
renderSequence(...)
buildAtlas(...)
exportGeneration(...)
```
Do not create one giant React component or unnecessary enterprise abstractions.

## Performance
- dispose Three.js geometries/materials/textures/render targets appropriately
- avoid WebGL leaks during asset switching/batching
- avoid retaining unnecessary full-resolution canvases
- process large batches sequentially
- show progress
- prevent duplicate simultaneous generation
- keep UI responsive where practical
- detect impossible atlas sizes before attempting them

## Error Handling
Handle unsupported files, GLTF parse failures, missing textures, WebGL unavailable, no visible meshes, invalid recipe JSON, filesystem failures, invalid animation duration, excessive atlas dimensions and individual batch failures. Show concise user errors and keep technical detail in developer logs.

## Unreal Engine 5 Integration — Required V1 Deliverable

Because the target game is built in Unreal Engine 5, the one-shot build must include a **basic working UE5 Editor integration** after the standalone SpriteForge baker is stable.

Do not begin the Unreal work before the core baker passes its main generation/export checks. The standalone app remains the source-of-truth asset baker; the Unreal integration consumes its exports.

### Required UE5 deliverables

Create an Unreal plugin in a clearly separated folder such as:

```text
unreal/
  SpriteForgeImporter/
    SpriteForgeImporter.uplugin
    Source/
    Content/
    README.md
```

Target a current Unreal Engine 5.x version available in the environment. Keep version-specific assumptions documented.

The plugin must provide an Editor-side workflow that can:

1. Select a SpriteForge `.json` metadata file.
2. Locate the associated atlas PNG using metadata/relative paths or prompt the user when necessary.
3. Import the atlas into the Unreal project.
4. Apply sensible texture settings for sprite/impostor use.
5. Parse and validate SpriteForge schema version 1 metadata.
6. Create or update a reusable Unreal data asset representing:
   - atlas texture reference
   - atlas dimensions
   - frame rectangles
   - direction angles
   - animation names
   - FPS
   - frame indices
   - pivot/anchor data
7. Produce a usable material/material-instance setup for rendering a selected atlas frame on a camera-facing quad.
8. Provide a simple test actor/component or example Blueprint-compatible C++ class that demonstrates directional frame selection based on camera-to-actor angle.
9. Support static directional assets first; support animated frame advancement from metadata if core plugin work is stable.
10. Fail with readable Editor messages when metadata or textures are invalid.

### Runtime impostor component

Implement a minimal reusable runtime component or actor suitable for testing generated assets in the MMORPG.

Conceptual behaviour:

```text
Camera position
      ↓
Camera-to-actor horizontal angle
      ↓
Convert relative angle using actor forward direction
      ↓
Choose nearest baked direction
      ↓
Select correct atlas frame
      ↓
Display on camera-facing quad
```

The implementation should:

- rotate the render quad to face the active camera
- preserve world-space ground placement
- select the nearest available baked direction
- support at least 4/8/16 directions based on metadata
- avoid obvious left/right direction inversion
- expose useful Blueprint-callable/configurable properties where sensible
- be suitable as the basis of a future LOD system

If animated metadata is implemented, it should also:

- select an animation by name/state
- advance frame index using exported FPS
- combine animation frame + direction into the appropriate atlas rectangle

### Material

Create a reusable Unreal material strategy for atlas rendering.

At minimum it should support:

- base colour + alpha
- masked or translucent mode as technically appropriate
- atlas UV rectangle selection
- camera-facing billboard usage

Prefer masked rendering where alpha quality permits because it is generally cheaper and more suitable for large numbers of distant actors. Document trade-offs.

Keep the material architecture extendable for future:

- normal map
- depth
- emissive
- object mask

### Editor importer UX

Expose the importer through a practical Editor action, for example:

```text
Tools
  → SpriteForge
      → Import SpriteForge Asset
```

or another standard UE5 Editor extension point.

A successful import should create assets in a predictable folder, for example:

```text
/Game/SpriteForge/Goblin/
  T_Goblin_Atlas
  DA_Goblin_SpriteForge
  MI_Goblin_Impostor
```

Exact asset naming can differ if a cleaner Unreal convention is used.

### SpriteForge metadata changes required for Unreal

Ensure the standalone application's exported metadata includes everything the UE importer needs without reverse engineering PNG layout.

Required fields include:

- schema version
- source asset name
- atlas filename
- atlas width/height
- cell/frame rectangles in pixels
- normalised UV rectangle or enough data to derive it
- direction count
- direction angle per directional frame
- front-direction offset
- animation names
- animation FPS
- animation frame indices
- pivot/anchor
- render recipe summary
- frame ordering
- transparent/background mode

Prefer explicit frame records such as:

```json
{
  "index": 17,
  "directionDegrees": 90,
  "animation": "Idle",
  "animationFrame": 1,
  "rect": {
    "x": 512,
    "y": 256,
    "width": 256,
    "height": 256
  },
  "uv": {
    "u0": 0.25,
    "v0": 0.25,
    "u1": 0.375,
    "v1": 0.5
  }
}
```

### Required documentation

Create:

- `docs/UNREAL_INTEGRATION.md`
- `unreal/SpriteForgeImporter/README.md`

Document:

1. how to install the plugin into an Unreal project
2. how to compile/enable it
3. how to export from SpriteForge
4. how to import a generated asset
5. where Unreal assets are created
6. how the test actor/component works
7. how direction selection is calculated
8. known limitations
9. next steps for a production LOD/impostor system

### Scope boundary

A complete MMORPG-wide automatic LOD manager is **not** required for V1.

Do not attempt to replace Unreal's entire LOD/HLOD system.

The V1 requirement is:

> a working SpriteForge baker + a working UE5 importer + a minimal runtime directional impostor demonstration.

Once those work, advanced automatic distance-based 3D→impostor swapping can remain documented future work.

## Future Render Pass Architecture
V1 requires reliable RGBA colour output. Structure renderer so future passes can be added: albedo, normals, depth, emissive, object mask, roughness/metallic/AO. Only implement optional passes after the mandatory app works; normal/depth/emissive may be experimental if straightforward.

## MMORPG-Specific Enhancements (after core completion)
Prioritise if time permits:
- inventory presentation pitch/yaw/roll/scale/framing offset
- source-model vs generated-impostor comparison
- optional lightweight categories: Character, Monster, Weapon, Armour, Environment, Vegetation, Item, Gate, Map
- source-file change detection / stale-output indicator

## Explicit Non-Goals for V1
Do not get distracted by accounts, collaboration, cloud storage, marketplace, procedural modelling, full image editor, Blender replacement, complex database, AI APIs, path tracing, perfect FBX support, mobile support, or a complete MMORPG-wide automatic LOD/HLOD replacement.

A **basic functional UE5 SpriteForge importer and runtime directional-impostor demonstration are required**, but advanced production-scale LOD orchestration is not.

## Testing
Add meaningful automated tests for:
- direction angle generation
- recipe validation
- frame naming
- atlas layout
- animation sample times
- metadata generation
- filename sanitisation

Before declaring completion actually run and verify where environment permits:
1. clean install
2. dev launch
3. production web build
4. Tauri check/build
5. GLB import
6. visible model
7. 8-direction generation
8. transparent PNG output
9. atlas generation
10. metadata export
11. recipe persistence
12. animated bake with a suitable fixture if available
13. controlled malformed-input error

Do not call functionality complete solely because TypeScript compiles.

## Autonomous Execution Rules
This is a one-shot unattended build.

1. Inspect the repository first.
2. If empty, initialise it yourself.
3. Establish a concise implementation plan and immediately execute it.
4. Build in vertical slices.
5. Run tests/build frequently.
6. Inspect and fix errors yourself.
7. Do not ask routine implementation questions.
8. If one technical path fails, choose another reasonable path.
9. Optional difficulty must not block core completion.
10. Never replace required functionality with fake buttons/mocks.
11. Leave no core-path TODOs.
12. Never claim a test/build passed unless it actually ran successfully.
13. Keep README current.
14. Maintain `PROGRESS.md` during work so interrupted execution can resume.
15. Maintain `DECISIONS.md` for important architectural choices.
16. If git is available, commit at sensible stable milestones; never destroy user work.
17. Do not rewrite unrelated existing project files without reason.
18. Continue until Definition of Done is satisfied or a genuine environment limitation makes a requirement impossible.
19. If blocked by an environment limitation, complete everything else and document the exact blocker and reproduction steps.
20. At the end, perform a final audit against this specification rather than stopping after the first successful launch.

## Recommended Build Order
Use approximately this order, adapting when necessary:

### Phase 1 — Foundation
- Vite/React/TypeScript/Tauri
- base desktop UI
- state/types
- Three.js viewport

### Phase 2 — Static Asset Pipeline
- GLB/GLTF import
- asset analysis
- centring/grounding
- auto-framing
- render recipe controls
- deterministic offscreen render
- directional generation

### Phase 3 — Output
- generated-view UI
- individual PNGs
- atlas builder
- metadata
- native export

### Phase 4 — Production Usability
- presets
- persistence
- outline
- lighting controls
- error handling
- polish

### Phase 5 — Animation
- clip inspection/playback
- deterministic sampling
- stable animated bounds
- directional animated bake
- animated atlas/metadata

### Phase 6 — Batch
- multi-file selection
- queue
- progress
- per-item failures
- directory output

### Phase 7 — Unreal Engine Integration
Only begin after the standalone baker's core workflows pass verification.

- finalise Unreal-oriented metadata schema
- create UE5 Editor plugin
- metadata parser/validator
- atlas texture import
- SpriteForge data asset type
- reusable atlas-frame material/material instance
- Editor import command
- static directional impostor runtime actor/component
- camera-angle → nearest-direction selection
- animated playback support if core plugin is stable
- example/test usage
- Unreal integration documentation

### Phase 8 — Final Verification
- automated tests
- standalone production build checks
- manual baker workflow audit
- UE plugin compile/check where the environment has Unreal/build tooling
- validate exported metadata against importer
- verify one generated static asset can make the full SpriteForge → UE workflow where environment permits
- README
- Unreal plugin README
- remove dead code/core TODOs

## Final Deliverable
When finished, the repository should be something the user can open in VS Code, install and run to turn their MMORPG's GLB/GLTF assets into usable static or animated directional sprites **and then import those SpriteForge exports into Unreal Engine 5 using the included plugin**.

The end-to-end target is:

```text
Blender / source GLB
        ↓
SpriteForge
        ↓
PNG atlas + JSON metadata
        ↓
SpriteForge UE5 Importer
        ↓
Unreal texture + data asset + impostor material
        ↓
Runtime directional impostor actor/component
```

The final response should be concise and include:
- what was built
- exact command(s) to run it
- test/build results actually obtained
- any genuine remaining limitations
- where exported files go/how to use the core workflow

**Do not stop at a plan. Build the application.**
