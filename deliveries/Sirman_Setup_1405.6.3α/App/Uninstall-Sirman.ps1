# Uninstall-Sirman.ps1 — Level 1 (program) or Level 2 (Full Cleanup)
# Target for Level 1 is THIS script's directory. install-location.txt never redirects it.
param(
  [ValidateSet('Level1', 'Level2')]
  [string]$Mode = 'Level1',
  [string]$Confirmation = '',
  [string]$LocalAppDataRoot = '',
  [string]$RoamingAppDataRoot = '',
  [switch]$NonInteractive,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { chcp 65001 | Out-Null } catch {}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$life = Join-Path $here 'Sirman-InstallLifecycle.ps1'
if (-not (Test-Path -LiteralPath $life)) {
  Write-Host '[ERROR] Sirman-InstallLifecycle.ps1 missing next to Uninstall-Sirman.ps1'
  Write-Host $here
  if (-not $NonInteractive) { Read-Host 'Enter' }
  exit 1
}
. $life

if ($Mode -eq 'Level2') {
  $r = Invoke-SirmanLevel2FullCleanup `
    -TypedConfirmation $Confirmation `
    -LocalAppDataRoot $LocalAppDataRoot `
    -RoamingAppDataRoot $RoamingAppDataRoot `
    -NonInteractive:$NonInteractive `
    -DryRun:$DryRun
  if (-not $NonInteractive) { Read-Host 'Enter' }
  if ($r.Aborted) { exit 2 }
  exit 0
}

$r1 = Invoke-SirmanLevel1Uninstall `
  -ArtifactDirectory $here `
  -LocalAppDataRoot $LocalAppDataRoot `
  -NonInteractive:$NonInteractive `
  -DryRun:$DryRun
if (-not $NonInteractive) { Read-Host 'Enter' }
if ($r1.Aborted) { exit 2 }
exit 0
