# Sirman-InstallLifecycle.ps1
# Shared installer/uninstaller contract for shop zip + in-app install.
# ASCII-safe logic. Persian confirmation/descriptions via UTF-8 BOM.
# This is NOT a second installer. Callers remain install-setup.ps1 / InstallService / shortcut helper.

$ErrorActionPreference = 'Stop'

function Get-SirmanLifecycleRoot {
  if ($PSCommandPath) { return Split-Path -Parent $PSCommandPath }
  if ($MyInvocation.MyCommand.Path) { return Split-Path -Parent $MyInvocation.MyCommand.Path }
  return (Get-Location).Path
}

function Get-SirmanInstallContract {
  param([string]$ContractPath = '')
  $candidates = @()
  if ($ContractPath) { $candidates += $ContractPath }
  $root = Get-SirmanLifecycleRoot
  $candidates += (Join-Path $root 'sirman-install-contract.json')
  $candidates += (Join-Path (Split-Path -Parent $root) 'sirman-install-contract.json')
  foreach ($p in $candidates) {
    if ($p -and (Test-Path -LiteralPath $p)) {
      return Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json
    }
  }
  throw 'sirman-install-contract.json not found'
}

function Get-SirmanCanonicalStartMenuDir {
  param($Contract = $null)
  if (-not $Contract) { $Contract = Get-SirmanInstallContract }
  $programs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
  return Join-Path $programs $Contract.canonical.startMenuFolderName
}

function Convert-SirmanFullPath {
  param([string]$PathValue)
  if ([string]::IsNullOrWhiteSpace($PathValue)) { return $null }
  try { return [IO.Path]::GetFullPath($PathValue.Trim().TrimEnd('\', '/')) } catch { return $null }
}

function Test-SirmanSamePath {
  param([string]$A, [string]$B)
  $x = Convert-SirmanFullPath $A
  $y = Convert-SirmanFullPath $B
  if (-not $x -or -not $y) { return $false }
  return [string]::Equals($x, $y, [StringComparison]::OrdinalIgnoreCase)
}

function Get-SirmanInstallRecordPaths {
  param([string]$LocalAppDataRoot = '')
  if (-not $LocalAppDataRoot) { $LocalAppDataRoot = $env:LOCALAPPDATA }
  $root = Join-Path $LocalAppDataRoot 'Sirman'
  return [pscustomobject]@{
    AppRoot = $root
    LocationFile = Join-Path $root 'install-location.txt'
    LegacyPathFile = Join-Path $root 'install_path.txt'
  }
}

function Read-SirmanTextPathFile {
  param([string]$FilePath)
  if (-not (Test-Path -LiteralPath $FilePath)) { return $null }
  try {
    $raw = (Get-Content -LiteralPath $FilePath -Raw -ErrorAction SilentlyContinue)
    if ($null -eq $raw) { return $null }
    $t = $raw.Trim()
    if ([string]::IsNullOrWhiteSpace($t)) { return $null }
    return $t
  } catch { return $null }
}

function Write-SirmanInstallLocation {
  param(
    [Parameter(Mandatory = $true)][string]$Dest,
    [string]$LocalAppDataRoot = ''
  )
  $paths = Get-SirmanInstallRecordPaths -LocalAppDataRoot $LocalAppDataRoot
  New-Item -ItemType Directory -Force -Path $paths.AppRoot | Out-Null
  $full = Convert-SirmanFullPath $Dest
  Set-Content -LiteralPath $paths.LocationFile -Value $full -Encoding UTF8
  # Explicit compatibility copy. Uninstall never uses this file as the delete target.
  Set-Content -LiteralPath $paths.LegacyPathFile -Value $full -Encoding UTF8
}

function New-SirmanLnk {
  param(
    [Parameter(Mandatory = $true)][string]$LinkPath,
    [Parameter(Mandatory = $true)][string]$Target,
    [Parameter(Mandatory = $true)][string]$WorkDir,
    [string]$Description = ''
  )
  $dir = Split-Path -Parent $LinkPath
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $w = New-Object -ComObject WScript.Shell
  $sc = $w.CreateShortcut($LinkPath)
  $sc.TargetPath = $Target
  $sc.WorkingDirectory = $WorkDir
  $sc.WindowStyle = 1
  $sc.Description = $Description
  try { $sc.IconLocation = $Target + ',0' } catch {}
  $sc.Save()
}

function Remove-SirmanExactFile {
  param([string]$PathValue)
  if ([string]::IsNullOrWhiteSpace($PathValue)) { return }
  if (Test-Path -LiteralPath $PathValue) {
    Remove-Item -LiteralPath $PathValue -Force -ErrorAction SilentlyContinue
  }
}

function Get-SirmanDesktopCandidates {
  $out = New-Object System.Collections.Generic.List[string]
  try { $out.Add([Environment]::GetFolderPath('DesktopDirectory')) } catch {}
  try { $out.Add([Environment]::GetFolderPath('Desktop')) } catch {}
  $out.Add((Join-Path $env:USERPROFILE 'Desktop'))
  $out.Add((Join-Path $env:USERPROFILE 'OneDrive\Desktop'))
  return $out | Where-Object { $_ } | Select-Object -Unique
}

function Remove-SirmanLegacyShortcuts {
  param($Contract = $null)
  if (-not $Contract) { $Contract = Get-SirmanInstallContract }
  # Exact legacy names only: سیرمان.lnk , حذف سیرمان.lnk (never a wildcard).
  $programs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
  $canonDir = Join-Path $programs $Contract.canonical.startMenuFolderName

  foreach ($folderName in $Contract.legacyStartMenuFolderNames) {
    $legacyDir = Join-Path $programs $folderName
    if (Test-SirmanSamePath $legacyDir $canonDir) { continue }
    if (-not (Test-Path -LiteralPath $legacyDir)) { continue }
    foreach ($n in @($Contract.legacyStartMenuLaunchNames + $Contract.legacyStartMenuUninstallNames + @(
      $Contract.canonical.startMenuLaunchShortcut,
      $Contract.canonical.startMenuUninstallShortcut,
      $Contract.canonical.startMenuFullCleanupShortcut
    ))) {
      Remove-SirmanExactFile (Join-Path $legacyDir $n)
    }
    $left = @(Get-ChildItem -LiteralPath $legacyDir -Force -ErrorAction SilentlyContinue)
    if ($left.Count -eq 0) {
      Remove-Item -LiteralPath $legacyDir -Force -ErrorAction SilentlyContinue
    }
  }

  if (Test-Path -LiteralPath $canonDir) {
    foreach ($n in $Contract.legacyStartMenuLaunchNames) {
      Remove-SirmanExactFile (Join-Path $canonDir $n)
    }
    foreach ($n in $Contract.legacyStartMenuUninstallNames) {
      $p = Join-Path $canonDir $n
      $canonUn = Join-Path $canonDir $Contract.canonical.startMenuUninstallShortcut
      if (-not (Test-SirmanSamePath $p $canonUn)) {
        Remove-SirmanExactFile $p
      }
    }
  }

  foreach ($desk in Get-SirmanDesktopCandidates) {
    foreach ($n in $Contract.legacyDesktopNames) {
      Remove-SirmanExactFile (Join-Path $desk $n)
    }
  }
}

function Remove-SirmanCanonicalShortcuts {
  param($Contract = $null)
  if (-not $Contract) { $Contract = Get-SirmanInstallContract }
  $startDir = Get-SirmanCanonicalStartMenuDir -Contract $Contract
  foreach ($n in @(
    $Contract.canonical.startMenuLaunchShortcut,
    $Contract.canonical.startMenuUninstallShortcut,
    $Contract.canonical.startMenuFullCleanupShortcut
  )) {
    Remove-SirmanExactFile (Join-Path $startDir $n)
  }
  if (Test-Path -LiteralPath $startDir) {
    $left = @(Get-ChildItem -LiteralPath $startDir -Force -ErrorAction SilentlyContinue)
    if ($left.Count -eq 0) {
      Remove-Item -LiteralPath $startDir -Force -ErrorAction SilentlyContinue
    }
  }
  foreach ($desk in Get-SirmanDesktopCandidates) {
    Remove-SirmanExactFile (Join-Path $desk $Contract.canonical.desktopShortcut)
  }
  Remove-SirmanLegacyShortcuts -Contract $Contract
}

function New-SirmanCanonicalShortcuts {
  param(
    [Parameter(Mandatory = $true)][string]$LaunchTarget,
    [Parameter(Mandatory = $true)][string]$WorkDir,
    [switch]$Desktop,
    [string]$UninstallBat = '',
    [string]$FullCleanupBat = '',
    $Contract = $null
  )
  if (-not $Contract) { $Contract = Get-SirmanInstallContract }
  Remove-SirmanLegacyShortcuts -Contract $Contract
  $startDir = Get-SirmanCanonicalStartMenuDir -Contract $Contract
  New-Item -ItemType Directory -Force -Path $startDir | Out-Null

  New-SirmanLnk `
    -LinkPath (Join-Path $startDir $Contract.canonical.startMenuLaunchShortcut) `
    -Target $LaunchTarget `
    -WorkDir $WorkDir `
    -Description $Contract.canonical.launchDescription

  if (-not $UninstallBat) { $UninstallBat = Join-Path $WorkDir 'Uninstall-Sirman.bat' }
  if (Test-Path -LiteralPath $UninstallBat) {
    New-SirmanLnk `
      -LinkPath (Join-Path $startDir $Contract.canonical.startMenuUninstallShortcut) `
      -Target $UninstallBat `
      -WorkDir $WorkDir `
      -Description $Contract.canonical.uninstallDescription
  }

  if (-not $FullCleanupBat) { $FullCleanupBat = Join-Path $WorkDir 'Sirman-Full-Cleanup.bat' }
  if (Test-Path -LiteralPath $FullCleanupBat) {
    New-SirmanLnk `
      -LinkPath (Join-Path $startDir $Contract.canonical.startMenuFullCleanupShortcut) `
      -Target $FullCleanupBat `
      -WorkDir $WorkDir `
      -Description $Contract.canonical.fullCleanupDescription
  }

  if ($Desktop) {
    $desk = [Environment]::GetFolderPath('DesktopDirectory')
    if (-not $desk) { $desk = [Environment]::GetFolderPath('Desktop') }
    New-SirmanLnk `
      -LinkPath (Join-Path $desk $Contract.canonical.desktopShortcut) `
      -Target $LaunchTarget `
      -WorkDir $WorkDir `
      -Description $Contract.canonical.launchDescription
  }
}

function Get-SirmanRelativePath {
  param([string]$Root, [string]$Full)
  $r = (Convert-SirmanFullPath $Root) + [IO.Path]::DirectorySeparatorChar
  $f = Convert-SirmanFullPath $Full
  if ($f.StartsWith($r, [StringComparison]::OrdinalIgnoreCase)) {
    return $f.Substring($r.Length).Replace('\', '/')
  }
  return [IO.Path]::GetFileName($f)
}

function Test-SirmanPreserveDir {
  param([string]$FullPath, $Contract)
  $parts = $FullPath.Replace('/', '\').Split('\')
  foreach ($p in $parts) {
    foreach ($keep in $Contract.preserveDirNames) {
      if ([string]::Equals($p, $keep, [StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
  }
  return $false
}

function Get-SirmanContractInt {
  param($Contract, [string]$Name, [int]$Default)
  try {
    $v = $Contract.$Name
    if ($null -ne $v -and "$v" -ne '') { return [int]$v }
  } catch {}
  return $Default
}

function Test-SirmanOwnedName {
  param(
    [string]$Name,
    $Contract,
    [string]$RelativePath = ''
  )
  if (-not $Contract -or [string]::IsNullOrWhiteSpace($Name)) { return $false }
  foreach ($exact in @($Contract.ownedExactFiles)) {
    if ($exact -and [string]::Equals($Name, [string]$exact, [StringComparison]::OrdinalIgnoreCase)) { return $true }
  }
  foreach ($prefix in @($Contract.ownedNamePrefixes)) {
    if ($prefix -and $Name.StartsWith([string]$prefix, [StringComparison]::OrdinalIgnoreCase)) { return $true }
  }
  $lower = $Name.ToLowerInvariant()
  foreach ($suf in @($Contract.ownedNameSuffixes)) {
    if ($suf -and $lower.EndsWith(([string]$suf).ToLowerInvariant())) { return $true }
  }
  if ($RelativePath) {
    $rel = $RelativePath.Replace('\', '/')
    $top = $rel.Split('/')[0]
    foreach ($d in @($Contract.ownedExactDirs)) {
      if ($d -and [string]::Equals($top, [string]$d, [StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
    if ($rel.StartsWith('updates/Sirman_Update_', [StringComparison]::OrdinalIgnoreCase)) { return $true }
  }
  return $false
}

function Read-SirmanSourcePackageManifest {
  param(
    [Parameter(Mandatory = $true)][string]$DestDir,
    $Contract
  )
  $empty = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $manName = [string]$Contract.canonical.manifestFileName
  $manPath = Join-Path $DestDir $manName
  if (-not (Test-Path -LiteralPath $manPath)) {
    return [pscustomobject]@{ Ok = $false; Reason = 'absent'; Path = $manPath; Files = $empty }
  }
  try {
    $raw = Get-Content -LiteralPath $manPath -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) {
      return [pscustomobject]@{ Ok = $false; Reason = 'empty'; Path = $manPath; Files = $empty }
    }
    $man = $raw | ConvertFrom-Json
    $set = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($f in @($man.files)) {
      if ($f) { [void]$set.Add(([string]$f).Replace('\', '/')) }
    }
    if ($set.Count -eq 0) {
      return [pscustomobject]@{ Ok = $false; Reason = 'empty'; Path = $manPath; Files = $empty }
    }
    return [pscustomobject]@{ Ok = $true; Reason = 'ok'; Path = $manPath; Files = $set }
  } catch {
    return [pscustomobject]@{ Ok = $false; Reason = 'corrupt'; Path = $manPath; Files = $empty }
  }
}

function Remove-SirmanPathWithRetry {
  param(
    [Parameter(Mandatory = $true)][string]$PathValue,
    [int]$Retries = 5,
    [int]$DelayMs = 400
  )
  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    return [pscustomobject]@{ Ok = $true; Skipped = $true; Path = $PathValue; Retries = 0; Error = $null }
  }
  if (-not (Test-Path -LiteralPath $PathValue)) {
    return [pscustomobject]@{ Ok = $true; Skipped = $true; Path = $PathValue; Retries = 0; Error = $null }
  }
  $isDir = Test-Path -LiteralPath $PathValue -PathType Container
  $last = 'unknown'
  $used = 0
  for ($i = 0; $i -le $Retries; $i++) {
    $used = $i
    try {
      if (-not (Test-Path -LiteralPath $PathValue)) {
        return [pscustomobject]@{ Ok = $true; Skipped = $false; Path = $PathValue; Retries = $i; Error = $null }
      }
      if ($isDir) {
        Remove-Item -LiteralPath $PathValue -Force -Recurse -ErrorAction Stop
      } else {
        Remove-Item -LiteralPath $PathValue -Force -ErrorAction Stop
      }
      return [pscustomobject]@{ Ok = $true; Skipped = $false; Path = $PathValue; Retries = $i; Error = $null }
    } catch {
      $last = [string]$_.Exception.Message
      if ($i -lt $Retries) { Start-Sleep -Milliseconds $DelayMs }
    }
  }
  return [pscustomobject]@{ Ok = $false; Skipped = $false; Path = $PathValue; Retries = $used; Error = $last }
}

function Stop-SirmanKnownProcesses {
  param($Contract = $null)
  $waitSeconds = 8
  if ($Contract) {
    try {
      if ($Contract.processStop -and $null -ne $Contract.processStop.waitExitSeconds) {
        $waitSeconds = [int]$Contract.processStop.waitExitSeconds
      }
    } catch {}
  }

  $names = @('Sirman')
  if ($Contract -and $Contract.processStop -and $Contract.processStop.processNames) {
    $names = @($Contract.processStop.processNames | ForEach-Object { [string]$_ })
  }
  foreach ($n in $names) {
    if ([string]::IsNullOrWhiteSpace($n)) { continue }
    try { Get-Process -Name $n -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } catch {}
  }

  $patterns = @('Sirman-Server-', 'sirman_run.ps1')
  if ($Contract -and $Contract.processStop -and $Contract.processStop.childCommandLinePatterns) {
    $patterns = @($Contract.processStop.childCommandLinePatterns | ForEach-Object { [string]$_ })
  }
  try {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object {
        $_.Name -and
        ($_.Name -match '^(powershell|pwsh|Sirman)\.exe$') -and
        $_.CommandLine
      } |
      ForEach-Object {
        $cmd = [string]$_.CommandLine
        $hit = $false
        foreach ($pat in $patterns) {
          if ($pat -and $cmd.IndexOf($pat, [StringComparison]::OrdinalIgnoreCase) -ge 0) { $hit = $true; break }
        }
        if ($hit -and $_.ProcessId) {
          try { Stop-Process -Id ([int]$_.ProcessId) -Force -ErrorAction SilentlyContinue } catch {}
        }
      }
  } catch {}

  try {
    Get-Process -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle -like 'Sirman-Server-*' } |
      ForEach-Object { try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {} }
  } catch {}

  $deadline = (Get-Date).AddSeconds($waitSeconds)
  do {
    $left = @()
    foreach ($n in $names) {
      try { $left += @(Get-Process -Name $n -ErrorAction SilentlyContinue) } catch {}
    }
    if ($left.Count -eq 0) { break }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)

  $still = 0
  foreach ($n in $names) {
    try { $still += @(Get-Process -Name $n -ErrorAction SilentlyContinue).Count } catch {}
  }
  return [pscustomobject]@{ SirmanStillRunning = ($still -gt 0); WaitedSeconds = $waitSeconds }
}

function Write-SirmanInstallManifest {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDir,
    [Parameter(Mandatory = $true)][string]$DestDir,
    $Contract = $null
  )
  if (-not $Contract) { $Contract = Get-SirmanInstallContract }
  $files = @()
  Get-ChildItem -LiteralPath $SourceDir -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $files += (Get-SirmanRelativePath -Root $SourceDir -Full $_.FullName)
  }
  $obj = [pscustomobject]@{
    schemaVersion = 1
    writtenAtUtc = [DateTime]::UtcNow.ToString('o')
    sourceDir = (Convert-SirmanFullPath $SourceDir)
    destDir = (Convert-SirmanFullPath $DestDir)
    files = $files
  }
  $out = Join-Path $DestDir $Contract.canonical.manifestFileName
  ($obj | ConvertTo-Json -Depth 6) | Set-Content -LiteralPath $out -Encoding UTF8
}

function Remove-SirmanStaleOwnedFiles {
  param(
    [Parameter(Mandatory = $true)][string]$DestDir,
    [string]$SourceDir = '',
    $Contract = $null
  )
  if (-not $Contract) { $Contract = Get-SirmanInstallContract }
  $dest = Convert-SirmanFullPath $DestDir
  if (-not (Test-Path -LiteralPath $dest)) { return }

  $sourceRel = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  if ($SourceDir -and (Test-Path -LiteralPath $SourceDir)) {
    Get-ChildItem -LiteralPath $SourceDir -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
      [void]$sourceRel.Add((Get-SirmanRelativePath -Root $SourceDir -Full $_.FullName))
    }
  }

  $manifestRel = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $manPath = Join-Path $dest $Contract.canonical.manifestFileName
  if (Test-Path -LiteralPath $manPath) {
    try {
      $man = Get-Content -LiteralPath $manPath -Raw -Encoding UTF8 | ConvertFrom-Json
      foreach ($f in @($man.files)) { if ($f) { [void]$manifestRel.Add([string]$f) } }
    } catch {}
  }

  Get-ChildItem -LiteralPath $dest -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $full = $_.FullName
    if (Test-SirmanPreserveDir -FullPath $full -Contract $Contract) { return }
    $rel = Get-SirmanRelativePath -Root $dest -Full $full
    $inSource = $sourceRel.Contains($rel)
    $owned = (Test-SirmanOwnedName -Name $_.Name -Contract $Contract -RelativePath $rel)
    if (-not $owned) { return }
    if ($inSource) { return }
    if ($sourceRel.Count -eq 0 -and $manifestRel.Contains($rel)) { return }
    Remove-Item -LiteralPath $full -Force -ErrorAction SilentlyContinue
  }

  foreach ($d in $Contract.ownedExactDirs) {
    $p = Join-Path $dest $d
    if (Test-Path -LiteralPath $p) {
      $left = @(Get-ChildItem -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer })
      if ($left.Count -eq 0) {
        Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
      }
    }
  }
}

function Resolve-SirmanLevel1Target {
  param(
    [Parameter(Mandatory = $true)][string]$ArtifactDirectory,
    [string]$LocalAppDataRoot = ''
  )
  $target = Convert-SirmanFullPath $ArtifactDirectory
  $paths = Get-SirmanInstallRecordPaths -LocalAppDataRoot $LocalAppDataRoot
  $recorded = Read-SirmanTextPathFile $paths.LocationFile
  $legacy = Read-SirmanTextPathFile $paths.LegacyPathFile
  if (-not $recorded -and $legacy) {
    $recorded = $legacy
  }
  $other = $null
  if ($recorded) {
    $recFull = Convert-SirmanFullPath $recorded
    if ($recFull -and -not (Test-SirmanSamePath $recFull $target)) {
      $other = $recFull
    }
  }
  return [pscustomobject]@{
    TargetDir = $target
    RecordedDir = $(if ($recorded) { Convert-SirmanFullPath $recorded } else { $null })
    OtherDetectedDir = $other
    LocationFile = $paths.LocationFile
    LegacyPathFile = $paths.LegacyPathFile
    SilentRedirect = $false
  }
}

function Remove-SirmanInstallerOwnedInDir {
  param(
    [Parameter(Mandatory = $true)][string]$DestDir,
    $Contract = $null
  )
  if (-not $Contract) { $Contract = Get-SirmanInstallContract }
  $dest = Convert-SirmanFullPath $DestDir
  $removed = New-Object 'System.Collections.Generic.List[string]'
  $failed = New-Object 'System.Collections.Generic.List[object]'
  $preserved = New-Object 'System.Collections.Generic.List[string]'
  if (-not $dest -or -not (Test-Path -LiteralPath $dest)) {
    return [pscustomobject]@{
      OwnershipMode = 'none'
      RemovedCount = 0
      FailedCount = 0
      PreservedCount = 0
      Removed = @()
      Failed = @()
      Preserved = @()
    }
  }

  $retries = Get-SirmanContractInt -Contract $Contract -Name 'level1RemovalRetries' -Default 5
  $delay = Get-SirmanContractInt -Contract $Contract -Name 'level1RetryDelayMs' -Default 400
  $manifest = Read-SirmanSourcePackageManifest -DestDir $dest -Contract $Contract
  $mode = $(if ($manifest.Ok) { 'manifest' } else { 'fallback:' + $manifest.Reason })

  $toDelete = @()
  Get-ChildItem -LiteralPath $dest -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $full = $_.FullName
    if (Test-SirmanPreserveDir -FullPath $full -Contract $Contract) { return }
    $rel = (Get-SirmanRelativePath -Root $dest -Full $full).Replace('\', '/')
    $owned = $false
    if ($manifest.Ok -and $manifest.Files.Contains($rel)) { $owned = $true }
    if (Test-SirmanOwnedName -Name $_.Name -Contract $Contract -RelativePath $rel) { $owned = $true }
    if ($owned) { $toDelete += $_ }
  }

  foreach ($item in $toDelete) {
    $rel = Get-SirmanRelativePath -Root $dest -Full $item.FullName
    $r = Remove-SirmanPathWithRetry -PathValue $item.FullName -Retries $retries -DelayMs $delay
    if ($r.Ok) {
      if (-not $r.Skipped) { $removed.Add($rel) }
    } else {
      $failed.Add([pscustomobject]@{ Path = $rel; Error = $r.Error; Retries = $r.Retries })
    }
  }

  foreach ($d in @($Contract.ownedExactDirs)) {
    if (-not $d) { continue }
    $p = Join-Path $dest ([string]$d)
    if (Test-Path -LiteralPath $p) {
      $left = @(Get-ChildItem -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer })
      if ($left.Count -eq 0) {
        $r = Remove-SirmanPathWithRetry -PathValue $p -Retries $retries -DelayMs $delay
        if (-not $r.Ok) {
          $failed.Add([pscustomobject]@{ Path = [string]$d; Error = $r.Error; Retries = $r.Retries })
        }
      }
    }
  }

  $updates = Join-Path $dest 'updates'
  if (Test-Path -LiteralPath $updates) {
    $leftU = @(Get-ChildItem -LiteralPath $updates -Force -ErrorAction SilentlyContinue)
    if ($leftU.Count -eq 0) {
      [void](Remove-SirmanPathWithRetry -PathValue $updates -Retries $retries -DelayMs $delay)
    }
  }

  Get-ChildItem -LiteralPath $dest -Recurse -Directory -Force -ErrorAction SilentlyContinue |
    Sort-Object { $_.FullName.Length } -Descending |
    ForEach-Object {
      if (Test-SirmanPreserveDir -FullPath $_.FullName -Contract $Contract) { return }
      $left = @(Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue)
      if ($left.Count -eq 0) {
        [void](Remove-SirmanPathWithRetry -PathValue $_.FullName -Retries $retries -DelayMs $delay)
      }
    }

  if (Test-Path -LiteralPath $dest) {
    Get-ChildItem -LiteralPath $dest -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
      $preserved.Add((Get-SirmanRelativePath -Root $dest -Full $_.FullName))
    }
    $leftRoot = @(Get-ChildItem -LiteralPath $dest -Force -ErrorAction SilentlyContinue)
    if ($leftRoot.Count -eq 0) {
      $r = Remove-SirmanPathWithRetry -PathValue $dest -Retries $retries -DelayMs $delay
      if (-not $r.Ok) {
        $failed.Add([pscustomobject]@{ Path = $dest; Error = $r.Error; Retries = $r.Retries })
      }
    }
  }

  return [pscustomobject]@{
    OwnershipMode = $mode
    RemovedCount = $removed.Count
    FailedCount = $failed.Count
    PreservedCount = $preserved.Count
    Removed = $removed.ToArray()
    Failed = $failed.ToArray()
    Preserved = $preserved.ToArray()
  }
}

function Read-SirmanBackupFolderFromSettings {
  param([string]$LocalAppDataRoot = '')
  if (-not $LocalAppDataRoot) { $LocalAppDataRoot = $env:LOCALAPPDATA }
  $settings = Join-Path $LocalAppDataRoot 'Sirman\desktop-settings.json'
  if (-not (Test-Path -LiteralPath $settings)) { return $null }
  try {
    $j = Get-Content -LiteralPath $settings -Raw -Encoding UTF8 | ConvertFrom-Json
    $bf = [string]$j.BackupFolder
    if ([string]::IsNullOrWhiteSpace($bf)) { return $null }
    return $bf.Trim()
  } catch { return $null }
}

function Get-SirmanLevel2Categories {
  param(
    [string]$LocalAppDataRoot = '',
    [string]$RoamingAppDataRoot = '',
    $Contract = $null
  )
  if (-not $Contract) { $Contract = Get-SirmanInstallContract }
  if (-not $LocalAppDataRoot) { $LocalAppDataRoot = $env:LOCALAPPDATA }
  if (-not $RoamingAppDataRoot) { $RoamingAppDataRoot = $env:APPDATA }
  $userBackup = Read-SirmanBackupFolderFromSettings -LocalAppDataRoot $LocalAppDataRoot
  $localSirman = Join-Path $LocalAppDataRoot 'Sirman'
  $roamSirman = Join-Path $RoamingAppDataRoot 'Sirman'

  $cats = @(
    [pscustomobject]@{ Id = 'A'; Name = 'WebView2 business data'; Paths = @((Join-Path $localSirman 'WebView2')) },
    [pscustomobject]@{ Id = 'B'; Name = 'backup data'; Paths = @(
      (Join-Path $roamSirman 'backup'),
      (Join-Path $localSirman 'Backups')
    ) },
    [pscustomobject]@{ Id = 'C'; Name = 'media'; Paths = @(
      (Join-Path $roamSirman 'backup\sirman_media'),
      (Join-Path $localSirman 'Backups\sirman_media')
    ) },
    [pscustomobject]@{ Id = 'D'; Name = 'prefs/config'; Paths = @(
      (Join-Path $roamSirman 'prefs.json'),
      (Join-Path $localSirman 'desktop-settings.json'),
      (Join-Path $roamSirman 'secrets')
    ) },
    [pscustomobject]@{ Id = 'E'; Name = 'diagnostic history'; Paths = @((Join-Path $localSirman 'diagnostics\history.jsonl')) },
    [pscustomobject]@{ Id = 'F'; Name = 'candidate SQLite'; Paths = @((Join-Path $roamSirman 'data\sirman.sqlite')) },
    [pscustomobject]@{ Id = 'G'; Name = 'update state/cache'; Paths = @(
      (Join-Path $localSirman 'WebView2-print'),
      (Join-Path $localSirman 'WebView2-print-diag')
    ) }
  )
  if ($userBackup) {
    $cats[1].Paths += $userBackup
    $cats[2].Paths += (Join-Path $userBackup 'sirman_media')
  }
  return $cats
}

function Test-SirmanLevel2Confirmation {
  param(
    [string]$Typed,
    $Contract = $null
  )
  if (-not $Contract) { $Contract = Get-SirmanInstallContract }
  return [string]::Equals(($Typed + '').Trim(), [string]$Contract.canonical.level2ConfirmationWord, [StringComparison]::Ordinal)
}

function Remove-SirmanPathIfExists {
  param([string]$PathValue)
  if ([string]::IsNullOrWhiteSpace($PathValue)) { return }
  if (-not (Test-Path -LiteralPath $PathValue)) { return }
  Remove-Item -LiteralPath $PathValue -Recurse -Force -ErrorAction SilentlyContinue
}

function Invoke-SirmanLevel1Uninstall {
  param(
    [Parameter(Mandatory = $true)][string]$ArtifactDirectory,
    [string]$LocalAppDataRoot = '',
    [switch]$NonInteractive,
    [switch]$DryRun,
    $Contract = $null
  )
  if (-not $Contract) { $Contract = Get-SirmanInstallContract }
  $resolved = Resolve-SirmanLevel1Target -ArtifactDirectory $ArtifactDirectory -LocalAppDataRoot $LocalAppDataRoot

  Write-Host ''
  Write-Host '==============================================='
  Write-Host '  SIRMAN Uninstall  -  Level 1'
  Write-Host '==============================================='
  Write-Host ''
  Write-Host 'This copy (will be removed if you confirm):'
  Write-Host ('  ' + $resolved.TargetDir)
  Write-Host ''
  Write-Host 'Normal uninstall does NOT delete:'
  Write-Host '  %LOCALAPPDATA%\Sirman\WebView2'
  Write-Host '  %APPDATA%\Sirman\backup'
  Write-Host '  user-selected backup folders'
  Write-Host '  sirman_media / prefs / secrets / diagnostic history'
  Write-Host ''
  if ($resolved.OtherDetectedDir) {
    Write-Host 'Also detected (NOT deleted by this uninstall):'
    Write-Host ('  ' + $resolved.OtherDetectedDir)
    Write-Host 'To remove that copy, run Uninstall-Sirman.bat from THAT folder.'
    Write-Host ''
  }

  if (-not $NonInteractive) {
    $ans = Read-Host 'Type Y to uninstall THIS copy (anything else aborts)'
    if ($ans -ne 'Y' -and $ans -ne 'y') {
      Write-Host 'Aborted. Nothing deleted.'
      return [pscustomobject]@{ Ok = $true; Aborted = $true; TargetDir = $resolved.TargetDir; DeletedOther = $false }
    }
  }

  if ($DryRun) {
    return [pscustomobject]@{ Ok = $true; DryRun = $true; TargetDir = $resolved.TargetDir; OtherDetectedDir = $resolved.OtherDetectedDir; SilentRedirect = $false }
  }

  try {
    $temp = $env:TEMP
    if ([string]::IsNullOrWhiteSpace($temp)) { $temp = [IO.Path]::GetTempPath() }
    if ($temp) { Set-Location -LiteralPath $temp }
  } catch {}

  $stopped = Stop-SirmanKnownProcesses -Contract $Contract
  if ($stopped.SirmanStillRunning) {
    Write-Host 'WARNING: Sirman process still running after wait. File removal may fail on locked DLLs.'
  }

  Remove-SirmanCanonicalShortcuts -Contract $Contract
  $del = Remove-SirmanInstallerOwnedInDir -DestDir $resolved.TargetDir -Contract $Contract

  if ($resolved.LocationFile -and (Test-Path -LiteralPath $resolved.LocationFile)) {
    $cur = Read-SirmanTextPathFile $resolved.LocationFile
    if ($cur -and (Test-SirmanSamePath $cur $resolved.TargetDir)) {
      Remove-SirmanExactFile $resolved.LocationFile
    }
  }
  if ($resolved.LegacyPathFile -and (Test-Path -LiteralPath $resolved.LegacyPathFile)) {
    $cur2 = Read-SirmanTextPathFile $resolved.LegacyPathFile
    if ($cur2 -and (Test-SirmanSamePath $cur2 $resolved.TargetDir)) {
      Remove-SirmanExactFile $resolved.LegacyPathFile
    }
  }

  Write-Host 'Level 1 uninstall finished.'
  Write-Host 'Business data was preserved.'
  Write-Host ''
  Write-Host 'Removed:'
  Write-Host ([string]$del.RemovedCount)
  Write-Host ''
  Write-Host 'Could not remove:'
  Write-Host ([string]$del.FailedCount)
  foreach ($f in @($del.Failed)) {
    Write-Host ('  ' + $f.Path + ' | ' + $f.Error + ' | retries=' + $f.Retries)
  }
  Write-Host ''
  Write-Host 'Preserved user files:'
  Write-Host ([string]$del.PreservedCount)
  foreach ($p in @($del.Preserved)) {
    Write-Host ('  ' + $p)
  }
  if ($del.OwnershipMode) {
    Write-Host ''
    Write-Host ('Ownership source: ' + $del.OwnershipMode)
  }
  return [pscustomobject]@{
    Ok = $true
    Aborted = $false
    TargetDir = $resolved.TargetDir
    OtherDetectedDir = $resolved.OtherDetectedDir
    DeletedOther = $false
    SilentRedirect = $false
    OwnershipMode = $del.OwnershipMode
    RemovedCount = $del.RemovedCount
    FailedCount = $del.FailedCount
    PreservedCount = $del.PreservedCount
    Failed = $del.Failed
    Preserved = $del.Preserved
  }
}

function Invoke-SirmanLevel2FullCleanup {
  param(
    [string]$TypedConfirmation = '',
    [string]$LocalAppDataRoot = '',
    [string]$RoamingAppDataRoot = '',
    [switch]$NonInteractive,
    [switch]$DryRun,
    $Contract = $null
  )
  if (-not $Contract) { $Contract = Get-SirmanInstallContract }
  $word = [string]$Contract.canonical.level2ConfirmationWord
  $cats = Get-SirmanLevel2Categories -LocalAppDataRoot $LocalAppDataRoot -RoamingAppDataRoot $RoamingAppDataRoot -Contract $Contract

  Write-Host ''
  Write-Host '==============================================='
  Write-Host '  SIRMAN Full Cleanup  -  Level 2'
  Write-Host '==============================================='
  Write-Host ''
  Write-Host 'THIS IS NOT normal uninstall.'
  Write-Host 'Normal uninstall (Level 1) does NOT delete the paths below.'
  Write-Host 'Business data WILL be deleted if you type the confirmation word.'
  Write-Host ''
  foreach ($c in $cats) {
    Write-Host ('[' + $c.Id + '] ' + $c.Name)
    foreach ($p in $c.Paths) { Write-Host ('    ' + $p) }
  }
  Write-Host ''
  Write-Host ('Type this exact word to continue: ' + $word)
  Write-Host 'Any other input aborts with no deletion.'
  Write-Host ''

  $typed = $TypedConfirmation
  if (-not $NonInteractive) {
    $typed = Read-Host 'Confirmation'
  }
  if (-not (Test-SirmanLevel2Confirmation -Typed $typed -Contract $Contract)) {
    Write-Host 'Aborted. Nothing deleted.'
    return [pscustomobject]@{ Ok = $true; Aborted = $true; Deleted = $false }
  }

  if ($DryRun) {
    return [pscustomobject]@{ Ok = $true; DryRun = $true; Aborted = $false; Categories = $cats }
  }

  [void](Stop-SirmanKnownProcesses -Contract $Contract)

  foreach ($c in $cats) {
    foreach ($p in $c.Paths) { Remove-SirmanPathIfExists $p }
  }

  Write-Host 'Level 2 Full Cleanup finished.'
  return [pscustomobject]@{ Ok = $true; Aborted = $false; Deleted = $true }
}
