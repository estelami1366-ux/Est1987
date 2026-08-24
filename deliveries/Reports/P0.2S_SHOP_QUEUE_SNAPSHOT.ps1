# SIRMAN P0.2S — read-only Windows snapshot
# Does NOT print. Does NOT change Sirman.exe.
# Run on the shop PC immediately AFTER exactly one Native Invoice click.
$ErrorActionPreference = 'Continue'
$stamp = Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz'
$outDir = Join-Path $env:TEMP 'sirman-p0-2s'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$out = Join-Path $outDir ("snapshot-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
$lines = New-Object System.Collections.Generic.List[string]
function Add-Line([string]$s) { [void]$lines.Add($s) }

Add-Line "P0.2S_SHOP_QUEUE_SNAPSHOT"
Add-Line "Timestamp: $stamp"
Add-Line "Machine: $env:COMPUTERNAME"
Add-Line "User: $env:USERNAME"
Add-Line ""

Add-Line "=== Get-Printer ==="
try { Get-Printer | Format-Table Name, DriverName, PrinterStatus, JobCount -AutoSize | Out-String | ForEach-Object { Add-Line $_ } }
catch { Add-Line ("Get-Printer ERROR: " + $_.Exception.GetType().FullName + ": " + $_.Exception.Message) }

Add-Line "=== Get-PrintJob (all printers) ==="
try {
  $jobs = Get-PrintJob -ErrorAction SilentlyContinue
  if (-not $jobs) { Add-Line "Job ID: NONE OBSERVED" }
  else { $jobs | Format-List PrinterName, Id, JobStatus, DocumentName, UserName, Size, PagesPrinted, SubmittedTime | Out-String | ForEach-Object { Add-Line $_ } }
}
catch { Add-Line ("Get-PrintJob ERROR: " + $_.Exception.GetType().FullName + ": " + $_.Exception.Message) }

$printDir = Join-Path $env:LOCALAPPDATA 'Sirman\print'
Add-Line "=== app logs: $printDir ==="
foreach ($name in @('print-jobs.jsonl', 'PHASE_0_OBSERVE.log', 'PRINT_DIAGNOSTIC.log')) {
  $p = Join-Path $printDir $name
  Add-Line ("--- " + $name + " ---")
  if (Test-Path $p) {
    Add-Line ("path=" + $p)
    Get-Content -Path $p -Tail 20 -Encoding UTF8 | ForEach-Object { Add-Line $_ }
  } else { Add-Line "EVIDENCE UNAVAILABLE (file missing)" }
}

Add-Line "=== PrintService Operational (last 15 minutes) ==="
try {
  $start = (Get-Date).AddMinutes(-15)
  $ev = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-PrintService/Operational'; StartTime = $start } -ErrorAction SilentlyContinue |
    Select-Object -First 30 TimeCreated, Id, LevelDisplayName, Message
  if (-not $ev) { Add-Line "EVIDENCE UNAVAILABLE (no events or log disabled)" }
  else { $ev | ForEach-Object { Add-Line ("Event ID: " + $_.Id); Add-Line ("Level: " + $_.LevelDisplayName); Add-Line ("Timestamp: " + $_.TimeCreated); Add-Line ("Exact message: " + $_.Message); Add-Line "" } }
}
catch { Add-Line ("Get-WinEvent ERROR: " + $_.Exception.GetType().FullName + ": " + $_.Exception.Message) }

$lines | Set-Content -Path $out -Encoding UTF8
Write-Output $out
Write-Output "Copy this file back for P0.2S. Do not print again."
