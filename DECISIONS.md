# Decisions

- React + TypeScript + Three.js + Zustand + Vite with Tauri 2 desktop shell; browser mode remains fully local and exports ZIP downloads.
- Dedicated offscreen WebGL renderer, separate from inspection camera. Fixed framing across all directions and sampled animation poses.
- Explicit schema v1 frame records, top-left pixel/UV coordinates, direction-major ordering, local atlas path, and recipe snapshot connect the baker to Unreal.
- Sequential batch processing with independent errors and unique export folders avoids overwriting existing exports.
- No runtime network assets, APIs or cloud dependencies. GLTF sidecars are supplied with the asset or selected as a folder.

- Pixel readback flips the WebGL origin and converts associated-alpha RGB to straight-alpha PNG. The MSAA render target is rebound before every frame because asynchronous readback restores the resolved framebuffer.
- Atlas allocation caps at 8192px per side / 32 megapixels before rendering, with 4096 samples per animation. This bounds GPU/CPU memory and reports actionable errors.
- Unreal Engine 5.8.1 and MSVC 14.44 were discovered on the Windows host mounted into WSL. The plugin is compiled against that installation and verified in a separate temporary project.
