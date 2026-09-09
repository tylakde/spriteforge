# SpriteForge Importer — UE 5.8

Copy this folder into `<Project>/Plugins/`, compile the Development Editor target, and enable **SpriteForge Importer**. Requires the engine's C++ toolchain; Procedural Mesh Component is a declared dependency.

1. Export **Atlas + metadata** or **Everything** from SpriteForge.
2. In Unreal, choose **Tools → Import SpriteForge Asset…** and select the JSON.
3. Assets are saved under `/Game/SpriteForge/<Asset>/`; the shared masked atlas material is under `_Shared`.
4. Place `SpriteForgeImpostorActor`, assign the generated data asset and set cell height. Play and orbit the camera. Set Animation Name for animated exports.

Reimport updates the same named assets. The importer validates version 1, atlas PNG dimensions, directions, animation timing, frame rectangles and pivot. Errors are shown in the Editor; a missing atlas opens a file picker.

See [full integration guide](../../docs/UNREAL_INTEGRATION.md) for compilation commands, direction conventions, Blueprint methods, material trade-offs, command-line verification and production limitations. See [progress](../../PROGRESS.md) for actual build and import results.
