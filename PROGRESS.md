# SpriteForge progress

- [x] Read build brief; create private GitHub repository before implementation.
- [x] Foundation and deterministic static baker.
- [x] Export, recipes, animation and batch workflows implemented; browser verification underway.
- [x] Verify real browser generation/export with fixtures.
- [x] UE5 importer and directional runtime actor (after baker verification).
- [ ] Final tests, desktop build attempt, documentation and specification audit.

## Environment
Initial environment: Ubuntu 26.04; no Node, Rust or Unreal installation found. Bootstrapping local tools. Repository: https://github.com/tylakde/spriteforge (private).

## Milestone 1
Production web build passed; eight core unit tests passed. Procedural static/animated textured GLB fixtures included. Rust installed locally; native compilation attempted.

## Milestone 2
All 3 Playwright end-to-end tests passed: static GLB, distinct 8 directions, alpha pixels, atlas/JSON ZIP, persisted preset, malformed input, deterministic animated bake, GLTF sidecars and batch error continuation. MSAA binding bug found by pixel comparisons and fixed. Beginning Unreal work after this verification.

## Milestone 3
UE 5.8.1 Windows BuildPlugin succeeded for Editor, Development and Shipping (MSVC 14.44). Real static Runestone export imported successfully: 8 frames, atlas texture, data asset, shared material and material instance saved. Real animated Sentinel export imported successfully: 48 frames. Both commandlet runs verified directional selection and returned 0. Runtime actor integration checks are underway.

Four browser integration tests now pass, including 32-view outlined/solid output, full-resolution inspection and invalid recipe input. npm ci, production build and 8 unit tests pass. npm audit reports zero vulnerabilities.

Desktop Rust tests passed on the first Linux CI run; release packaging continues. Current Windows and Linux jobs are building. Browser CI passed on commit 8ad4e37.

## Milestone 4
Unreal Python runtime integration passed with 0 errors and 0 warnings: actor construction, material graph/instance assignment, camera quadrants, logical heading offset, fixed actor ground placement, animated lookup and loop timing. Production Chromium smoke at 1366×768 with the actual desktop CSP passed GLB import, WebAssembly loading, 8-view generation and ZIP export.

First Linux CI desktop job successfully passed Rust tests and built the .deb package; artifact downloaded locally. Windows packaging and the latest-code CI run are still in progress.
