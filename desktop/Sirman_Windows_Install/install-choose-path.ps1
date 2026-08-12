# install-choose-path.ps1 — پنجره انتخاب پوشه نصب سیرمان
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms | Out-Null

$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = 'پوشه نصب سیرمان را انتخاب کنید (مثلاً D:\Sirman یا Documents\Sirman)'
$dlg.ShowNewFolderButton = $true

$suggested = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Sirman'
$locFile = Join-Path $env:LOCALAPPDATA 'Sirman\install-location.txt'
if (Test-Path -LiteralPath $locFile) {
  try {
    $prev = (Get-Content -LiteralPath $locFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ($prev -and (Test-Path -LiteralPath $prev)) { $dlg.SelectedPath = $prev }
  } catch {}
}
if (-not $dlg.SelectedPath) {
  try {
    New-Item -ItemType Directory -Force -Path $suggested | Out-Null
    $dlg.SelectedPath = $suggested
  } catch {}
}

$r = $dlg.ShowDialog()
if ($r -ne [System.Windows.Forms.DialogResult]::OK) { exit 1 }
$path = $dlg.SelectedPath
if ([string]::IsNullOrWhiteSpace($path)) { exit 1 }
Write-Output $path
exit 0
