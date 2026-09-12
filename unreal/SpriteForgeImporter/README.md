# SpriteForge Importer — UE 5.8

Copy this folder into `<Project>/Plugins/`, compile the Development Editor target, and enable **SpriteForge Importer**. Requires the engine's C++ toolchain; Procedural Mesh Component is a declared dependency.

1. Export **Atlas + metadata** or **Everything** from SpriteForge.
2. In Unreal, choose **Tools → Import SpriteForge Asset…** and select the JSON.
3. Assets are saved under `/Game/SpriteForge/<Asset>/`; the shared masked atlas material is under `_Shared`.
4. Place `SpriteForgeImpostorActor`, assign the generated data asset and set cell height. Play and orbit the camera. Set Animation Name for animated exports.

Reimport updates the same named assets. The importer validates version 1, atlas PNG dimensions, directions, animation timing, frame rectangles and pivot. Errors are shown in the Editor; a missing atlas opens a file picker.

See [full integration guide](../../docs/UNREAL_INTEGRATION.md) for compilation commands, direction conventions, Blueprint methods, material trade-offs, command-line verification and production limitations. See [progress](../../PROGRESS.md) for actual build and import results.

## Character Forge

Use **Tools → Import SpriteForge Character…** for a complete `.character.json` package. This creates `/Game/SpriteForge/Characters/<name>/` state atlases/materials/sprite assets and a Blueprint-readable `SpriteForgeCharacterAsset`.

Assign Character Asset on `SpriteForgeImpostorActor`, then call `SetState` / `PlayOneShot`. Or drop `SpriteForgeCharacterExample` into a level for its built-in camera and WASD/Shift/LMB visual demo. Animation frame advancement, loop/one-shot completion and camera-relative directions reuse the existing actor.

See [the repository integration guide](../../docs/UNREAL_INTEGRATION.md) and [character contract](../../docs/CHARACTER_METADATA.md). `SpriteForgeImport -Character=<path>` supports automated import, and `tests/unreal/verify_character.py` verifies state playback in the Editor. Character Forge import/runtime was compiled and tested in UE5.8 with `-nullrhi`; this does not claim a visual PIE playthrough.
