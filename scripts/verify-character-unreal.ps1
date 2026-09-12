param(
    [Parameter(Mandatory=$true)][string]$Project,
    [Parameter(Mandatory=$true)][string]$CharacterMetadata,
    [string]$Engine = 'C:\Program Files\Epic Games\UE_5.8'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$editor = Join-Path $Engine 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
if (!(Test-Path $editor)) { throw "UnrealEditor-Cmd not found: $editor" }
if (!(Test-Path $Project)) { throw "Project not found: $Project" }
if (!(Test-Path $CharacterMetadata)) { throw "Character metadata not found: $CharacterMetadata" }
& $editor $Project '-run=SpriteForgeImport' "-Character=$CharacterMetadata" '-unattended' '-nullrhi' '-nosplash'
if ($LASTEXITCODE -ne 0) { throw "Character import failed (exit $LASTEXITCODE)" }
$script = Join-Path $repo 'tests\unreal\verify_character.py'
# The runtime assertions use the supplied ForgeKnight demo exported at 4 FPS.
& $editor $Project '-run=pythonscript' "-script=$script" '-unattended' '-nullrhi' '-nosplash'
if ($LASTEXITCODE -ne 0) { throw "Character runtime verification failed (exit $LASTEXITCODE)" }
Write-Host 'Character Forge import and runtime verification passed.'
