# Decisions

- React + TypeScript + Three.js + Zustand + Vite with Tauri 2 desktop shell; browser mode remains fully local and exports ZIP downloads.
- Dedicated offscreen WebGL renderer, separate from inspection camera. Fixed framing across all directions and sampled animation poses.
- Explicit schema v1 frame records, top-left pixel/UV coordinates, direction-major ordering, local atlas path, and recipe snapshot connect the baker to Unreal.
- Sequential batch processing with independent errors and unique export folders avoids overwriting existing exports.
- No runtime network assets, APIs or cloud dependencies. GLTF sidecars are supplied with the asset or selected as a folder.
