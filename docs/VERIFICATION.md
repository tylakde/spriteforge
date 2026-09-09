# Verification report

Verified on 9 September 2026. The original brief is preserved in the repository root.

## Standalone baker

| Requirement | Evidence |
| --- | --- |
| Install and local launch | `npm ci` and Vite dev server launched successfully; Playwright exercised the running app. |
| Production web build | `npm run build` passed (TypeScript + Vite). |
| Core algorithms | 8 Vitest tests passed: directions, validation, names/sanitisation, samples, layout, metadata, framing and outline pixels. |
| Real GLB import / visible model | Original textured Runestone and animated Sentinel GLBs imported; actual generated pixels checked. Screenshot in `docs/workspace.png`. |
| GLTF with sidecars | `.gltf` + external `.bin` fixture loaded and exported in a batch. Native path resolution isolates identically named sidecars from different source folders. |
| 8 directions | Eight distinct frame outputs, expected angles, correct dimensions and no clipping at image borders checked. |
| Transparent PNGs | Decoded PNG alpha and non-empty coloured pixels checked; RGB is unassociated before PNG encoding. |
| Atlas + metadata | ZIP unpacked and PNG, frame count, rectangles, UVs, names and schema data asserted. Examples in `docs/examples/`. |
| Animation | 48-frame, 8-direction, 6 FPS Idle bake; frames change with time; repeat bake yields identical PNG bytes despite preview playback. |
| Recipes and persistence | Saved custom recipe survives page reload; invalid recipe JSON yields controlled error. |
| Batch errors | Malformed first item fails; subsequent GLTF succeeds and exports. |
| 32 directions, outline, solid | 32-frame bake succeeds; 11.25° spacing, outline recipe, fully opaque solid-background pixels and enlarged inspection checked. |
| Error recovery | Malformed GLB, invalid recipes and excessive atlas requests covered. |
| Dependency audit | `npm audit`: zero vulnerabilities. |
| Formatting | Prettier check and Rust formatting run. |

All four Playwright workflows passed locally under Chromium with SwiftShader. A separate GitHub Actions web job also passed. Tests render real Three.js scenes; they do not mock the renderer or export routines.

## Desktop

The source includes Tauri 2, native file/folder dialogs, selected-file access, bounded GLTF sidecar reads, unique export directories, and cleanup after failed writes. Rust unit tests exercise path rejection and non-overwriting exports.

The initial local Linux check could not compile because the WSL environment has no `cc` linker or GTK/WebKit development packages and unattended sudo is unavailable. Node 22 and Rust were installed in user-local directories. Browser testing dependencies were extracted locally without modifying system packages. Desktop tests and packaging run on configured GitHub Linux/Windows runners; final results are recorded in `PROGRESS.md`.

## Unreal Engine

Found and used the Windows host's **Unreal Engine 5.8.1**, **MSVC 14.44.35228** and **Windows SDK 10.0.22621.0**.

- `RunUAT BuildPlugin` completed successfully for Win64 Editor, Development and Shipping configurations.
- Real Runestone export imported with the plugin commandlet: eight frames; atlas texture, data asset, shared masked material and material instance saved; direction selection verified; exit 0.
- Real Sentinel export imported with the plugin commandlet: 48 animated frames; corresponding assets saved; direction selection verified; exit 0.
- Import commandlet rejects an unsupported schema version.
- Runtime actor checks live in `tests/unreal/verify_runtime.py`; final results are recorded in `PROGRESS.md`.

Unreal validation uses an isolated temporary project, not the user's game project. The import runs use `-nullrhi`; these results do not constitute an in-game visual quality review. Reimport/actor tests and desktop package results are recorded as they complete.

## Scope audit and limitations

The 15 Definition of Done items are implemented in the source: local launch; file/folder/drop import; textured orbit preview; centering/grounding; configurable recipe; all direction counts; generated view inspection; PNG/atlas/JSON output; recipes; deterministic animation; sequential batch; persistence; controlled errors; local-only operation; test/build commands.

V1 intentionally has a single RGBA pass, one selected animation per bake, no automatic root-motion removal, and no MMORPG LOD manager. Draco and KTX2 assets require decompressed export; Meshopt support is bundled. The runtime uses vertical billboards, local player camera selection and masked alpha; soft transparent materials and split-screen need custom rendering. Atlas limits and texture/mipmap trade-offs are documented in the README and integration guide.
