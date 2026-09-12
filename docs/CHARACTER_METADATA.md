# Character Forge metadata v1

Both one-click and modular assembly produce the same package:

```text
Knight/
  Knight.character.json
  Idle/
    Knight_Idle_Atlas.png
    Knight_Idle.json
  Walk/
    Knight_Walk_Atlas.png
    Knight_Walk.json
  Attack/
    Knight_Attack_Atlas.png
    Knight_Attack.json
```

Desktop exports create a fresh character folder (with a numeric suffix if occupied). Browser ZIPs contain the character JSON and state directories at their root. State names are sanitised for directories. Every state JSON is the existing SpriteForge sprite/atlas schema v1 and can also be imported independently by the original importer.

The TypeScript contract is [`src/features/character/schema.ts`](../src/features/character/schema.ts).

| Character field | Meaning |
| --- | --- |
| `format`, `version` | `"spriteforge-character"`, `1` |
| `name` | Sanitised character export name |
| `defaultState` | Included state entered on startup and configured one-shot completion |
| `directions` | Ordered bake angles in degrees |
| `frontDirection` | Source front offset, applied once during selection |
| `coordinateSystem` | Y-up source; 0° camera at +Z; positive angles toward +X; top-left UV origin |
| `anchor` | Shared ground pivot `{type, x, y}`, normalised within a cell |
| `recipe` | Full existing rendering recipe snapshot |
| `states` | Array of the state records below |

| State field | Meaning |
| --- | --- |
| `name`, `clip` | Gameplay state and source animation name |
| `fps`, `duration`, `frameCount` | Sample rate, original clip duration and samples per direction |
| `loop`, `returnToDefault` | Loop vs one-shot and completion policy |
| `atlas`, `metadata` | Relative `State/file.png` and `State/file.json` paths |
| `sprite` | Embedded complete existing sprite metadata, identical to the state JSON |

`state.sprite` includes atlas dimensions/cell size/padding, direction-major `frames`, per-frame pixel `rect`, top-left `uv`, `animationFrame`, `directionDegrees`, sample `time`, frame `duration`, shared anchor, original animation definition and appearance texture filtering. Character exports omit standalone frame PNGs; `frames[].file` remains an informational field from the reusable sprite schema.

Sampling uses `N = ceil(duration × fps)` and `time[i] = i / fps` for `0 ≤ i < N`. The last frame's duration is clipped to the original clip end. Loops wrap at clip duration, not `N / fps`. Non-returning one-shots clamp to the final sample. A default state that is itself a one-shot holds rather than returning to itself indefinitely.

Direction selection uses the nearest wrapped angle to:

```text
cameraYaw - characterHeading + frontDirection
```

The playable preview and Unreal actor use the same convention. The atlas pivot maps to the actor origin; the quad billboards without rotating the logical actor heading.

## Unreal representation

`USpriteForgeCharacterAsset` contains character name/version, default state, directions, front convention, anchor, coordinate-system text and a Blueprint-readable map of `FSpriteForgeCharacterState`. Each state references a `USpriteForgeAsset` containing the atlas, material, frames/UVs/pivot and recipe, plus its source clip, FPS, duration, loop and return flags.

The importer preflights all state JSONs and PNG signatures/dimensions before asset import. It rejects unsupported versions, duplicate states/destinations, unsafe paths, mismatched timing, incomplete direction/frame sets, inconsistent anchors/resolutions and absent default states. External state JSONs are the authoritative sprite documents for import; they should remain identical to the embedded `sprite` records. Runtime assets are saved under `/Game/SpriteForge/Characters/<name>/<state>/`, with the character data asset at the character root.

## Portable loadout is a separate document

`Name.spriteforge-character.json` is **source assembly configuration**, with `format: "spriteforge-loadout"`, version 1. `Name.character.json` is **baked runtime output**, with `format: "spriteforge-character"`, version 1. Loadouts reference original source files and require rebuilding; Unreal imports baked character packages. See [Character Factory](CHARACTER_FACTORY.md).
