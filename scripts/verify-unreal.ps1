param(
    [Parameter(Mandatory=$true)][string]$Project,
    [string]$Engine = 'C:\Program Files\Epic Games\UE_5.8'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$editor = Join-Path $Engine 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
if (!(Test-Path $editor)) { throw "UnrealEditor-Cmd not found: $editor" }
if (!(Test-Path $Project)) { throw "Project not found: $Project" }
foreach ($sample in @('Runestone','Sentinel')) {
    $metadata = Join-Path $repo "docs\examples\$sample\$sample.json"
    & $editor $Project '-run=SpriteForgeImport' "-Metadata=$metadata" '-unattended' '-nullrhi' '-nosplash'
    if ($LASTEXITCODE -ne 0) { throw "SpriteForge import failed for $sample (exit $LASTEXITCODE)" }
}
$script = Join-Path $repo 'tests\unreal\verify_runtime.py'
& $editor $Project '-run=pythonscript' "-script=$script" '-unattended' '-nullrhi' '-nosplash'
if ($LASTEXITCODE -ne 0) { throw "SpriteForge actor verification failed (exit $LASTEXITCODE)" }
Write-Host 'SpriteForge Unreal import and actor verification passed.'
