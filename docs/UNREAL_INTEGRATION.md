# Unreal Engine integration

SpriteForge's standalone baker owns rendering. The Unreal plugin consumes version 1 exports and creates project assets. The source targets **Unreal Engine 5.8**; the build environment has the Windows 5.8 installation and MSVC 14.44. See `PROGRESS.md` for the actual compile/import results.

## Install and compile

1. Close your Unreal Editor.
2. Copy `unreal/SpriteForgeImporter` into `<YourProject>/Plugins/SpriteForgeImporter`.
3. Regenerate your project files and build the Development Editor target with your engine's C++ toolchain. A Blueprint-only project may need an empty C++ class added first.
4. Open the project. Enable **SpriteForge Importer** under Edit → Plugins, then restart if requested. Its Procedural Mesh Component dependency is declared automatically.

To compile/package the plugin independently on Windows:

```powershell
& 'C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\RunUAT.bat' BuildPlugin `
  '-Plugin=C:\path\SpriteForgeImporter\SpriteForgeImporter.uplugin' `
  '-Package=C:\path\SpriteForgePluginBuild' -TargetPlatforms=Win64 -Rocket
```

The plugin has two modules: `SpriteForgeRuntime` (data asset, frame selection and actor) and `SpriteForgeEditor` (JSON validation, importer, generated material, Tools menu and commandlet). No Editor modules are linked into the runtime module.

## Export from SpriteForge

Import a GLB/GLTF, select a recipe, generate, then choose **Atlas + metadata** or **Everything**. For animation, select a clip before generating. Unzip browser exports. Keep the atlas PNG and JSON together. A frames-only export is not sufficient for Unreal import.

## Import into the Editor

Choose **Tools → Import SpriteForge Asset…** and select the JSON. If the named PNG is missing, the importer opens a second dialog to locate it. It validates schema, dimensions, directions, frame rectangles, timing and pivot before creating assets; PNG dimensions must match the JSON.

Example destinations:

```text
/Game/SpriteForge/Runestone/
  T_Runestone_Atlas
  DA_Runestone_SpriteForge
  MI_Runestone_Impostor
/Game/SpriteForge/_Shared/
  M_SpriteForge_Masked
```

Reimport by selecting the same JSON again. The matching texture, data asset and material instance are updated. An unrelated asset type at a required destination is reported as an error. The shared material is created once and retained so you can extend it. Generated assets are saved immediately. If a later import step fails, earlier successfully saved assets can remain; correct the issue and rerun the import.

## Directional actor

Place a **SpriteForgeImpostorActor** in the level (Place Actors → search, or derive a Blueprint from it). Assign `DA_Runestone_SpriteForge` to **Sprite Asset**. Set **Cell Height Cm** to the world height of the entire sprite cell, including padding. It defaults to 250 cm. The actor origin corresponds to the exported pivot: ground for ground anchors, screen center for center anchors.

Press Play and move the player camera around the actor. The actor rotates its render quad around world Z to face the selected local player's camera. Its root rotation stays fixed, preserving the model's logical forward heading. The quad is vertical (cylindrical billboard), with the exported ground pivot fixed at its origin. Camera pitch is intentionally not applied, so an elevated capture should be chosen to match gameplay camera elevation.

Source-to-Unreal conventions:

- Source model +Y is up → Unreal +Z.
- Source front +Z → Unreal +X.
- Source +X → Unreal +Y.
- A baked angle of 0° observes from source +Z. Positive bake angles move toward source +X.
- `relativeYaw = cameraToActorYaw - actorYaw` where `cameraToActorYaw` here means the yaw of **camera position minus actor position** (the actor-to-camera vector).
- `targetBakeAngle = relativeYaw + metadata.frontDirection`.
- Pick the exported angle with the smallest absolute wrapped angular difference. This accounts for the front offset exactly once and avoids left/right reversal.

`FindFrame` supports every exported count (1, 4, 8, 16, 32). `UpdateForCamera` is Blueprint-callable for custom camera routing. Player Index selects the local player camera used by the default tick. One actor has one view orientation; split-screen/stereo needs per-view rendering in a production implementation.

## Animation

Set **Animation Name** or call `SetAnimation(Name, Restart)`. The actor starts with the first exported animation when none is specified. It advances a local clock at **Play Rate**, wraps at the exported duration, chooses `floor(time * FPS)`, and finds the matching direction/frame record. `bPlaying` pauses the clock. Missing states fall back to the first frame in the chosen direction. One selected animation is exported per bake in v1.

## Material and textures

The importer generates a two-sided **masked, unlit** material. Baked RGB goes to Emissive Color to avoid relighting the already shaded sprite; alpha goes to Opacity Mask. It samples `Atlas` with:

```text
atlasUV = localQuadUV * UVScale.xy + UVOffset.xy
```

The actor applies a half-texel inset to reduce neighbouring-cell sampling. PNG UV origin is top-left, and the procedural quad explicitly maps its top-left vertex to UV (0,0).

Textures use sRGB, uncompressed icon-style RGBA, clamp addressing, no mipmaps and no streaming. Filtering is bilinear for smooth styles and nearest-neighbour for pixelated styles. These are predictable V1 settings; they preserve alpha and avoid cross-cell mip bleed. Masked rendering is suitable for many opaque-cutout impostors but clips soft transparency. Hair, smoke and glass may need a translucent material with the same parameters. For large-scale use, add extruded gutters and carefully generated atlas mipmaps, compression and streaming policies.

Extend the shared material with NormalAtlas, DepthAtlas, EmissiveAtlas or MaskAtlas parameters when the corresponding baker passes exist. V1 exports RGBA only.

## Command-line verification

The Editor commandlet imports, saves assets, tests wrapped directional selection, and rejects an unsupported schema:

```powershell
& 'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe' `
  'C:\path\Project.uproject' -run=SpriteForgeImport `
  '-Metadata=C:\path\Runestone.json' -unattended -nullrhi -nosplash
```

A successful run logs `SPRITEFORGE_IMPORT_OK` and returns 0. This verifies import/data selection without displaying a scene. See the verification report for separate visual/runtime testing status.

## Next steps for production

Add distance-based 3D/impostor switching with hysteresis, frame selection per view, instancing or batched rendering, network-driven animation states, multi-clip exports, texture streaming and mip-safe atlases. Validate lighting, elevation and scale in your actual game camera. A full MMORPG LOD/HLOD manager is outside V1.

## API references

Implementation follows Epic's [material editing API](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Editor/MaterialEditor/UMaterialEditingLibrary) and [Unreal Engine API reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/API). Engine-specific validation is recorded rather than inferred from those references.

To run the actor integration checks after importing both bundled examples, enable the engine's Python Editor Script Plugin and run:

```powershell
& 'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe' `
  'C:\path\Project.uproject' -run=pythonscript `
  '-script=C:\path\spriteforge\tests\unreal\verify_runtime.py' -unattended -nullrhi -nosplash
```

This creates and destroys test actors in the current Editor world, checks the generated material graph, verifies four camera quadrants and a rotated actor heading, and tests animated frame lookup and loop timing. It does not save or modify your level.

On Windows, `scripts/verify-unreal.ps1 -Project C:\path\Project.uproject` runs both included imports and the actor tests together. Use a test project with SpriteForge Importer and Python Editor Script Plugin enabled; it saves the example assets under `/Game/SpriteForge`.

## Sprite style variants

SpriteForge now exports Pixel Fantasy, Painted Cartoon and Pixel Realism sets. Each has its own asset name and atlas, allowing all three to coexist under `/Game/SpriteForge`. Import each style's JSON from the multi-set export folder. Existing schema v1 exports remain supported.

Optional `appearance` metadata records a rendering version, style, pixel scale and texture filter. The updated importer applies **nearest-neighbour** filtering to Pixel Fantasy / Pixel Realism exports with pixel blocks larger than one, preserving crisp pixels. Painted Cartoon and Original PBR use bilinear filtering. The complete editable settings and shared comparison framing margin remain in the recipe snapshot.

After importing the three `docs/examples/styles` exports, `tests/unreal/verify_styles.py` checks separate data assets, frame counts, saved recipes, matching pivots and actual texture filtering in Unreal. Run it through the same Python commandlet used for the runtime tests.

## Character Forge packages

**Send to Unreal** exports the complete character folder (ZIP in browsers). Extract it, then choose **Tools → Import SpriteForge Character…** and select `Name.character.json`. The importer preflights the manifest, every state document and atlas before writing. It reuses the original texture/material/sprite import path and creates:

```text
/Game/SpriteForge/Characters/Knight/
  DA_Knight_Character
  Idle/T_Knight_Idle_Atlas
  Idle/MI_Knight_Idle_Impostor
  Idle/DA_Knight_Idle_SpriteForge
  Walk/…
```

The new `SpriteForgeCharacterAsset` is Blueprint-readable. State records include sprite asset references, source clip, FPS, duration, loop and return flags. The referenced sprite assets contain the frame rectangles/UVs, anchor, material and recipe.

Assign **Character Asset** on the existing `SpriteForgeImpostorActor`. Call `SetState("Walk")`, `SetState("Run")`, or `PlayOneShot("Attack")`. `SetState` keeps playback when called repeatedly with the same state unless Restart is true. `PlayOneShot` restarts a mapped non-looping state. Unknown names return false. Tick advances time automatically; loops wrap at the original duration, configured one-shots return to the default, and Death holds its last frame. `AdvancePlayback(DeltaSeconds)` is exposed for deterministic/manual simulation; disable normal actor ticking if driving the clock yourself.

For a ready-to-drop demonstration, place **SpriteForgeCharacterExample**, assign its Character Asset and press Play. With Demo Controls enabled it uses local player 0, its built-in camera, WASD, Shift, LMB, Space and Q/E. It demonstrates visual state/movement integration without combat or collision behaviour. For a real game, use the existing actor within your Pawn/Character and call the state APIs from your movement/gameplay logic. Only one demo actor should own demo controls in a level.

Command-line character import:

```powershell
& $editor $project -run=SpriteForgeImport '-Character=C:\Exports\Knight\Knight.character.json' -unattended -nullrhi
```

`tests/unreal/verify_character.py` exercises the original ForgeKnight package: all state assets, frame advancement, attack completion, held Death, locomotion loop, heading-relative directions and example actor construction. It ran successfully in UE5.8 during the expansion, alongside the original static/animated importer/runtime tests. This was `-nullrhi`; interactive PIE keyboard input and visual rendering were not validated by that script.

The standalone Sprite Baker still exports one animation per bake. Character Forge coordinates multiple such states into a shared-frame character package. See [Character metadata](CHARACTER_METADATA.md).
