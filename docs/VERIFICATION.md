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

All four Playwright workflows passed locally under Chromium with SwiftShader. A separate GitHub Actions web job also passed. Production Chromium at 1366×768 with the actual Tauri content-security policy also passed WebAssembly loading, sample import, generation and export. Tests render real Three.js scenes; they do not mock the renderer or export routines.

## Desktop

The source includes Tauri 2, native file/folder dialogs, selected-file access, bounded GLTF sidecar reads, unique export directories, and cleanup after failed writes. Rust unit tests exercise path rejection and non-overwriting exports, and passed on both Linux and Windows CI.

The initial local Linux check could not compile because the WSL environment has no `cc` linker or GTK/WebKit development packages and unattended sudo is unavailable. Node 22 and Rust were installed in user-local directories. Browser testing dependencies were extracted locally without modifying system packages. The latest source (293b8ef) passed release Rust tests and built a Linux .deb package in [CI run 34413511176](https://github.com/tylakde/spriteforge/actions/runs/34413511176). Desktop tests and packaging run on configured GitHub Linux/Windows runners; final results are recorded in `PROGRESS.md`. A direct launch initially failed because WebKit uses fixed system child-process paths. A temporary mount namespace supplied the locally extracted runtime at those paths, and the current native package then passed actual UI checks: textured sample preview, eight-direction generation, folder selection and native filesystem export. The eight PNGs, atlas PNG and schema v1 JSON were inspected; opposite-direction pixels differ. See `native-workspace.png`. A normal launch outside that test namespace requires installing the documented runtime dependencies.

## Unreal Engine

Found and used the Windows host's **Unreal Engine 5.8.1**, **MSVC 14.44.35228** and **Windows SDK 10.0.22621.0**.

- `RunUAT BuildPlugin` completed successfully for Win64 Editor, Development and Shipping configurations.
- Real Runestone export imported with the plugin commandlet: eight frames; atlas texture, data asset, shared masked material and material instance saved; direction selection verified; exit 0.
- Real Sentinel export imported with the plugin commandlet: 48 animated frames; corresponding assets saved; direction selection verified; exit 0.
- Reimport of Runestone updated existing assets and returned 0, with 0 errors and 0 warnings.
- Import commandlet rejects an unsupported schema version.
- Runtime actor checks in `tests/unreal/verify_runtime.py` passed with 0 errors and 0 warnings: actor construction, actual material assignment, camera quadrants, heading offset, fixed ground placement, animated frame selection and wraparound.

Unreal validation uses an isolated temporary project, not the user's game project. The import runs use `-nullrhi`; these results do not constitute an in-game visual quality review. Actor behavior was exercised in the real Editor world through Python. Desktop package results are recorded in the progress file.

## Scope audit and limitations

The 15 Definition of Done items are implemented in the source: local launch; file/folder/drop import; textured orbit preview; centering/grounding; configurable recipe; all direction counts; generated view inspection; PNG/atlas/JSON output; recipes; deterministic animation; sequential batch; persistence; controlled errors; local-only operation; test/build commands.

V1 intentionally has a single RGBA pass, one selected animation per bake, no automatic root-motion removal, and no MMORPG LOD manager. Draco and KTX2 assets require decompressed export; Meshopt support is bundled. The runtime uses vertical billboards, local player camera selection and masked alpha; soft transparent materials and split-screen need custom rendering. Atlas limits and texture/mipmap trade-offs are documented in the README and integration guide.

## Additional packaging status

The Windows installer job is still compiling in CI run 34413511176 at handoff. Its completion can be checked on the Actions page. The core desktop build requirement is verified by the successful current Linux package and its actual native workflow.

## Style variations — 10 September 2026

- 13 unit tests passed, including legacy recipe defaults, invalid style parameters, deterministic quantisation, alpha preservation, toon-material ownership/restoration, style naming and export filtering.
- All seven Playwright workflows passed. New tests bake and export three distinct static/animated sets, confirm 4× pixel blocks, equal pivots, independent atlas names, persistent recipes, and byte-identical individual re-bakes. A targeted rerun also passed full-size comparison and next-view navigation after the comparison modal was added.
- Production build and desktop-CSP browser smoke passed. Generated comparison screenshots and all three example export sets are checked in under `docs/`.
- UE5.8 Editor build passed. Three generated style atlases were imported into separate data assets; actual Unreal texture properties are nearest for Pixel Fantasy / Pixel Realism and bilinear for Painted Cartoon. `tests/unreal/verify_styles.py` also verified matching pivots and persisted recipe styles, logging `SPRITEFORGE_STYLES_OK` and returning 0.
- These are local rendering treatments; they do not generate new model geometry or repaint source texture artwork.

## Exactly 15 total styles — 10 September 2026

- Catalogue has 15 entries including Original PBR, with 14 named treatments and unchanged IDs for the earlier three.
- 16 unit tests pass: catalogue cardinality, default validity, palette mapping, coloured outlines, clay material restoration/cutout-alpha handling, selection validation and multi-style memory budgeting.
- All 9 Playwright workflows pass. The full 15-style bake/export produced 15 distinct front-frame hashes and identical pivots, with 8 views per style. Handheld output uses at most four opaque colours. Empty selection disables baking; selected subsets and custom recipes survive reload/migration. Existing static, animated, export and malformed-input workflows pass.
- Visual review: `docs/fifteen-styles.png`. The comparison supports compact overview, larger previews, shared frame navigation and horizontal style tabs.
- Existing Unreal appearance/filter metadata is reused without importer changes.
