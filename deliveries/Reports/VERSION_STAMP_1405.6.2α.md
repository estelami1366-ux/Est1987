# SIRMAN — VERSION STAMP 1405.6.2α

**Jalali:** 1405/06/02  
**Gregorian:** 24 August 2026  
**Live version:** `1405.6.2α`  
**Assembly:** `1405.6.2.1`

```text
Gate: version label + packaging only
Q3 persistence live: NO
Q4 print engine: NO
Canonical SQLite: NO
```

## What changed

- `SIRMAN_VERSION.json`
- `Sirman_Final.html` / `Laegh_Final.html` (meta, sidebar, backup version, print template stamps)
- `desktop/Directory.Build.props`
- `Sirman_Start.bat`
- `CHANGELOG.md`
- `docs/STABLE_BASELINE.md` / `docs/PHASE_3_CHANGE_GATE.md` live version line
- `desktop/Sirman.Persistence.Sqlite/SqliteCandidateDatabase.cs` application_version label only

## Shop zip

Official packer: `scripts/pack_sirman_setup.py`  
Expected output: `Sirman_Setup_1405.6.2α.zip`

This report records the version stamp. The zip is produced by the packer in the same session when publish succeeds.

## Install (after zip exists)

1. Copy zip to the shop Windows PC.
2. Extract All.
3. Run `نصب.bat` or `SETUP.bat`.
4. Requires .NET 8 Desktop Runtime x64 + WebView2.
