# Sirman one-click setup (Windows PowerShell 5.1+)
# ASCII-safe logic; Persian messages via UTF-8 BOM.
# Copies App\ (exe + HTML) to a folder the user picks. No manual copy-paste.

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { chcp 65001 | Out-Null } catch {}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$App = Join-Path $Root 'App'
$Html = Join-Path $App 'Sirman_Final.html'
$Exe = Join-Path $App 'Sirman.exe'
$StartBat = Join-Path $App 'Sirman_Start.bat'

Write-Host ''
Write-Host '==============================================='
Write-Host '  Sirman Setup  -  kamele nasb'
Write-Host '==============================================='
Write-Host ''

if (-not (Test-Path -LiteralPath $Html)) {
  Write-Host '[ERROR] Sirman_Final.html nist dar poosheye App'
  Write-Host $App
  Read-Host 'Enter'
  exit 1
}

$htmlLen = (Get-Item -LiteralPath $Html).Length
if ($htmlLen -lt 500000) {
  Write-Host '[ERROR] Sirman_Final.html kheili koochak ast.'
  Write-Host 'In file barname nist (shayad JSON 1KB bashad).'
  Write-Host ('Andaze: ' + $htmlLen + ' byte')
  Read-Host 'Enter'
  exit 1
}

$hasExe = Test-Path -LiteralPath $Exe
Write-Host ('HTML: ' + [Math]::Round($htmlLen / 1MB, 2) + ' MB')
if ($hasExe) { Write-Host 'EXE:  Sirman.exe mojood ast' } else { Write-Host 'EXE:  nist — nasb ba Sirman_Start.bat' }
Write-Host ''

Add-Type -AssemblyName System.Windows.Forms | Out-Null
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Choose Sirman install folder (example Documents\Sirman)'
$dialog.ShowNewFolderButton = $true
$defaultDest = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Sirman'
try { New-Item -ItemType Directory -Force -Path $defaultDest | Out-Null; $dialog.SelectedPath = $defaultDest } catch {}
$locFile = Join-Path $env:LOCALAPPDATA 'Sirman\install-location.txt'
if (Test-Path -LiteralPath $locFile) {
  try {
    $prev = (Get-Content -LiteralPath $locFile -Raw).Trim()
    if ($prev -and (Test-Path -LiteralPath $prev)) { $dialog.SelectedPath = $prev }
  } catch {}
}

$dialogResult = $dialog.ShowDialog()
if ($dialogResult -ne [System.Windows.Forms.DialogResult]::OK) {
  Write-Host 'Cancelled.'
  Start-Sleep -Seconds 2
  exit 0
}

$Dest = $dialog.SelectedPath.Trim()
$rootPath = [System.IO.Path]::GetPathRoot($Dest).TrimEnd('\')
if ($Dest.TrimEnd('\') -ieq $rootPath) { $Dest = Join-Path $Dest 'Sirman' }

Write-Host ('Nasb dar: ' + $Dest)
$desk = [System.Windows.Forms.MessageBox]::Show(
  'Shortcut on Desktop too?',
  'Sirman Setup',
  [System.Windows.Forms.MessageBoxButtons]::YesNo,
  [System.Windows.Forms.MessageBoxIcon]::Question
)
$makeDesktop = ($desk -eq [System.Windows.Forms.DialogResult]::Yes)

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Write-Host 'Copying files...'
Copy-Item -Path (Join-Path $App '*') -Destination $Dest -Recurse -Force

foreach ($name in @('راهنمای_نصب_از_صفر.txt', 'راهنمای_نصب_و_آپدیت.docx', '00_اینجا_شروع_کنید.txt')) {
  $src = Join-Path $Root $name
  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $Dest $name) -Force
  }
}

$destHtml = Join-Path $Dest 'Sirman_Final.html'
$destExe = Join-Path $Dest 'Sirman.exe'
$destStart = Join-Path $Dest 'Sirman_Start.bat'
$destUn = Join-Path $Dest 'Uninstall-Sirman.bat'
if (-not (Test-Path -LiteralPath $destHtml)) {
  Write-Host '[ERROR] copy failed — HTML missing'
  Read-Host 'Enter'
  exit 1
}

$target = $destExe
$work = $Dest
if (-not (Test-Path -LiteralPath $destExe)) {
  if (Test-Path -LiteralPath $destStart) { $target = $destStart } else { $target = $destHtml }
}

$appRoot = Join-Path $env:LOCALAPPDATA 'Sirman'
New-Item -ItemType Directory -Force -Path $appRoot | Out-Null
Set-Content -LiteralPath (Join-Path $appRoot 'install-location.txt') -Value $Dest -Encoding UTF8

$shell = New-Object -ComObject WScript.Shell
$startDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Sirman'
New-Item -ItemType Directory -Force -Path $startDir | Out-Null

$l = $shell.CreateShortcut((Join-Path $startDir 'Sirman.lnk'))
$l.TargetPath = $target
$l.WorkingDirectory = $work
$l.Description = 'Sirman'
$l.Save()

if (Test-Path -LiteralPath $destUn) {
  $u = $shell.CreateShortcut((Join-Path $startDir 'Uninstall Sirman.lnk'))
  $u.TargetPath = $destUn
  $u.WorkingDirectory = $work
  $u.Description = 'Uninstall Sirman'
  $u.Save()
}

if ($makeDesktop) {
  $dd = [Environment]::GetFolderPath('DesktopDirectory')
  $d = $shell.CreateShortcut((Join-Path $dd 'Sirman.lnk'))
  $d.TargetPath = $target
  $d.WorkingDirectory = $work
  $d.Description = 'Sirman'
  $d.Save()
}

Write-Host ''
Write-Host '==============================================='
Write-Host '  Nasb tamam shod'
Write-Host '==============================================='
Write-Host ('Path: ' + $Dest)
Write-Host 'Start Menu: Sirman'
Write-Host ''

$run = [System.Windows.Forms.MessageBox]::Show(
  'Open Sirman now?',
  'Sirman Setup',
  [System.Windows.Forms.MessageBoxButtons]::YesNo,
  [System.Windows.Forms.MessageBoxIcon]::Question
)
if ($run -eq [System.Windows.Forms.DialogResult]::Yes) {
  Start-Process -FilePath $target -WorkingDirectory $work
}

Start-Sleep -Seconds 2
exit 0
