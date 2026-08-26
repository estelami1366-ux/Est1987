# SIRMAN FINAL BUILD — 2026-08-26

Packaging-only rebuild of the approved product at `2ef63e9`. No product source edits.

## Git
```text
Branch:
cursor/final-build-2026-08-26-fa01

HEAD:
a10eab8 (packaging commit)
Approved product source: 2ef63e9

Worktree:
Product source: clean
Unrelated (not packaged): deliveries/migration/P1-services/services.candidate.sqlite + .sha256; deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT.zip + .sha256; scripts/__pycache__/; scripts/bump_version_1405_6_2.py
```

Approved product HEAD identification:

```text
Current branch at start: cursor/shop-complete-setup-fa01
Short HEAD: 2ef63e9
Full HEAD: 2ef63e900bce36cc3cbbda5e8aa9ba87ddeac403
P0.1 checkpoint 56832e5 ancestor: YES
P0.5 pre-migration 80f4782 ancestor: YES
P0.5 product commit b7499da ancestor: YES
```

## Version
```text
Product version:
1405.6.3α

Assembly version:
1405.6.3.1
```

Source of version: `SIRMAN_VERSION.json` and `desktop/Directory.Build.props`. Version was not bumped.

## Approved changes
```text
P0.1:
YES — A4/A5 driver-installed paper form selection is in this HEAD (56832e5 ancestor).

P0.5:
YES — Native Postal Label (`kind=postalLabel`, PostalLabelPrintModel, native renderer). HTML postal preview and old HTML print path retained. Product commit b7499da is an ancestor.

Other approved changes:
Native Test Page; Native Invoice; disk media storage in HTML; self-contained shop packer already on this line. Live data remains localStorage. SQLite remains candidate-only (P1 services). Shop-importable HTML update zip from 2ef63e9 is not this Windows kit.
```

## Tests
```text
HTML Sirman:
647/647 (node test_laegh.js Sirman_Final.html) exit 0

HTML Laegh:
647/647 (node test_laegh.js Laegh_Final.html) exit 0
Sirman_Final.html byte-identical to Laegh_Final.html

Core:
202/202 (dotnet test desktop/Sirman.Core.Tests -c Release) Failed 0, Skipped 0
```

`dotnet restore` and `dotnet build -c Release` succeeded (Desktop + Core.Tests). Existing warnings only; 0 errors. Tests were not weakened.

## Package
```text
Package:
deliveries/Sirman_Setup_1405.6.3α_2026-08-26.zip

Installer:
existing zip kit with نصب.bat / SETUP.bat (no separate MSI)

SHA-256:
39abb917bc3bbc134e027f476902a6425ac6a457aad72731d7f1cc2c362b165d

Size:
72475487 bytes

Manifest:
deliveries/Sirman_Setup_1405.6.3α_2026-08-26_MANIFEST.md
```

Zip `testzip()` passed. 489 entries. Required runtime files present: `App/Sirman.exe`, `App/Sirman_Final.html`, `Microsoft.Web.WebView2.Core.dll`, `نصب.bat`, `SETUP.bat`, `SIRMAN_VERSION.json`. Packaged HTML matches source bytes.

## Runtime
```text
Database included:
NO

Canonical storage:
localStorage/current runtime

SQLite cutover:
NO

Dual-write:
NO
```

## Isolated smoke test
```text
Sirman.exe starts: NOT TESTED
WebView2 host opens: NOT TESTED
main UI loads: NOT TESTED
Print Center opens: NOT TESTED
```

Host is Linux. win-x64 WinForms/WebView2 `Sirman.exe` cannot be launched here. Production user storage was not touched.

## Physical verification
```text
Native Test Page:
NEEDS HUMAN VERIFICATION

Native Invoice:
NEEDS HUMAN VERIFICATION

Native Postal Label:
NEEDS HUMAN VERIFICATION

Old HTML Postal Label:
NEEDS HUMAN VERIFICATION
```

No real Windows printer was used during this build. P0.5 remains NEEDS HUMAN VERIFICATION until Native Postal Label physically prints and is visually checked on Windows. `PRINT_SUBMITTED` is not physical PASS.

## Package cleanliness

Inspected staging tree `deliveries/Sirman_Setup_1405.6.3α` and the dated zip:

- No secrets / AI keys / credentials found
- No developer caches (`__pycache__`) in the zip
- No migration candidate DB
- No `.git`
- No `sirman.sqlite`
- No `.pdb`

Unrelated worktree artifacts were not copied into the package.

## Packaging files changed

Intended commit contents (product source unchanged):

- `deliveries/Sirman_Setup_1405.6.3α_2026-08-26.zip`
- `deliveries/Sirman_Setup_1405.6.3α_2026-08-26.sha256`
- `deliveries/Sirman_Setup_1405.6.3α_2026-08-26_MANIFEST.md`
- `deliveries/FINAL_BUILD_2026-08-26_REPORT.md`

Existing packer `scripts/pack_sirman_setup.py` was used as-is. Packer also regenerated the already-tracked kit at repo root / `deliveries/Sirman_Setup_1405.6.3α`; those trees were restored to HEAD so this delivery only adds the dated artifacts.

## Product source changed during packaging
```text
NO
```
