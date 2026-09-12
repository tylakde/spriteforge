# Decisions

- React + TypeScript + Three.js + Zustand + Vite with Tauri 2 desktop shell; browser mode remains fully local and exports ZIP downloads.
- Dedicated offscreen WebGL renderer, separate from inspection camera. Fixed framing across all directions and sampled animation poses.
- Explicit schema v1 frame records, top-left pixel/UV coordinates, direction-major ordering, local atlas path, and recipe snapshot connect the baker to Unreal.
- Sequential batch processing with independent errors and unique export folders avoids overwriting existing exports.
- No runtime network assets, APIs or cloud dependencies. GLTF sidecars are supplied with the asset or selected as a folder.

- Pixel readback flips the WebGL origin and converts associated-alpha RGB to straight-alpha PNG. The MSAA render target is rebound before every frame because asynchronous readback restores the resolved framebuffer.
- Atlas allocation caps at 8192px per side / 32 megapixels before rendering, with 4096 samples per animation. This bounds GPU/CPU memory and reports actionable errors.
- Unreal Engine 5.8.1 and MSVC 14.44 were discovered on the Windows host mounted into WSL. The plugin is compiled against that installation and verified in a separate temporary project.

- Style changes are deterministic local rendering operations, independent of asset purpose presets. Pixel styles render to a lower-resolution WebGL target and upscale with nearest-neighbour sampling; colour quantisation/dithering use fixed parameters across all directions and animation frames. Cartoon style uses a nearest-filtered toon lighting ramp while preserving texture, alpha and emissive maps. Hybrid retains softened PBR lighting.
- Three-style sets share a recorded `framingOutlineWidth` margin, keeping output pivots and camera scale identical and allowing individual recipe re-bakes to reproduce the result. Style suffixes identify distinct UE assets; schema v1's optional appearance metadata controls nearest/bilinear import filtering without invalidating old exports.

- The catalogue contains exactly 15 styles including Original PBR. Shared style definitions drive recipe validation, material shading families, pixel sampling, fixed palettes and post-processing. Existing style IDs remain stable.
- Multi-style selection is explicit and persistent. Output is sequential and capped at 128 megapixels across the selection before rendering; all chosen sets use the same maximum outline framing margin. Catalogue version 2 adds missing new presets once without overwriting custom recipes.

- Catalogue version 3 removes seven styles at the user's request, leaving eight. Retirement migration is confined to persisted state: matching retired built-in presets are removed, custom recipes retain camera/output settings using Original PBR, and surviving selections/preferences are retained. Importing a retired style JSON reports an unsupported style rather than silently changing its appearance. Historical exports remain intact.

## Character Forge expansion

- Character packages wrap existing sprite metadata v1; a separate `spriteforge-character` version 1 manifest holds gameplay states and references. Both entry paths share the same build/export/runtime contract. Source loadouts use a distinct `spriteforge-loadout` format to avoid confusing assembly configuration with baked output.
- Every state is measured into one deterministic bounds union. The loaded assembly and original animation data are reused across states; the existing renderer accepts an injected loader and shared bounds. Atlas-only jobs stream directly into the existing atlas canvas writer rather than retaining individual PNG frames.
- The playable arena uses actual atlas rectangles and the same camera-minus-heading/front convention as Unreal. One-shots wrap only when configured; death holds. The exported visual runtime does not create combat, collisions or game-specific logic.
- Shared equipment requires matching named hierarchy/rest transforms and bind pose. Bone-only libraries inspect animated node hierarchies when no GLTF skin exists. Shared animation tracks must target compatible bones; no universal retargeting or morph-library transplant.
- Portable loadouts reference SHA-256 identities of the main source and GLTF sidecars. Asset metadata and attachment preferences persist locally; users reimport original sources when moving loadouts between machines. No cloud or asset embedding requirement.
- Population generation traverses bounded mixed-radix combinations after seeded pool shuffles. Locks, tag/pool constraints, duplicate signatures, a 200-card limit, existing atlas limits and explicit large-bake acknowledgement bound work. Sequential exports preserve completed jobs on cancellation; PNG size is not falsely estimated from a compression ratio.
- Send to Unreal is an explicit package handoff to the existing Tools importer, not a background write into an arbitrary game project. The extended plugin was compiled and exercised in an isolated UE5.8 project; headless runtime checks are distinguished from visual PIE/input testing.
