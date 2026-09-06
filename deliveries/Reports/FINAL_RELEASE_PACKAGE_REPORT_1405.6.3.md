# FINAL RELEASE PACKAGE REPORT — 1405.6.3α recovery-complete

**Date:** 2026-09-06  
**Kind:** PACKAGING / RELEASE BUILD ONLY  
**Application source freeze:** `9fb9f6d3d08e1a7f8c46755d49c115934eb97f83`  
**Final status:** **RELEASE PACKAGE READY**

No feature development. No architecture / Restore / Phonebook / backup-engine / SQLite / print changes. The eight ARCH-26 function SHA-256 locks matched before pack. `Sirman_Final.html` == `Laegh_Final.html` == HEAD freeze HTML.

---

## 1. Release identity

| Field | Value |
|---|---|
| Product | SIRMAN |
| Version | `1405.6.3α` |
| Assembly | `1405.6.3.1` |
| Release name | `SIRMAN-1405.6.3-alpha-recovery-complete` |
| Output directory | `deliveries/Releases/1405.6.3-alpha-recovery-complete/` |
| In-app version | `1405.6.3α` (`APP_VERSION` / meta app-version) |
| PE ProductVersion | `1405.6.3α+f79d80a73a1186d1673dd687845e389b043598b1` (SDK SourceRevisionId; not a version bump) |

---

## 2. Git commit / tag

| Field | Value |
|---|---|
| Freeze commit | `9fb9f6d3d08e1a7f8c46755d49c115934eb97f83` (`docs: record ARCH-26 HTML 1094 and Core 844 suite totals`) |
| Tag | `release-1405.6.3-alpha-recovery-complete` (annotated; points at freeze commit) |
| Packaging branch | `cursor/release-1405-6-3-alpha-recovery-complete-fa01` |
| Packaging commit | `f79d80a73a1186d1673dd687845e389b043598b1` |
| Historical rewrite | none |

Packaging commit only replaced the `replaceAppFile` HTML body inside same-version `Sirman_Pending_Update.json` and `updates/Sirman_Update_1405.6.3α.json` so the bundled update cannot downgrade to the previous 1,654,477-character snapshot. Version / magic / changelog / application HTML file were not bumped.

---

## 3. Build environment

| Field | Value |
|---|---|
| OS | Linux cursor 6.12.94+ (Ubuntu 24.04), x86_64 |
| SDK | .NET 8.0.424 (`/home/ubuntu/.dotnet`) |
| Host runtime | Microsoft.NETCore.App 8.0.30 |
| Windows targeting | `-p:EnableWindowsTargeting=true` |
| Packer | `python3 scripts/pack_sirman_setup.py` (unchanged) |
| Node | used for `test_laegh.js` / `test_installer_lifecycle.js` |

This host cannot execute WinForms + WebView2.

---

## 4. Build command

```text
python3 scripts/pack_sirman_setup.py
```

which runs:

```text
dotnet publish desktop/Sirman.Desktop/Sirman.Desktop.csproj
  -c Release
  -r win-x64
  --self-contained true
  -p:EnableWindowsTargeting=true
  -p:DebugType=none
  -p:DebugSymbols=false
  -o /tmp/sirman-fd-publish
```

Result: OK. `Sirman.exe` 152064 bytes. Kit 495 files. Publish completed without error.

`desktop/build-win.bat` (`--self-contained false`) was **not** used. The production shop kit is self-contained.

---

## 5. Installer technology

**Existing** ZIP setup kit (not MSI, not Inno Setup, not a new installer):

- `scripts/pack_sirman_setup.py`
- `scripts/setup-kit/نصب.bat` / `SETUP.bat` / `install-setup.ps1`
- PowerShell 5.1 `FolderBrowserDialog` copy into a user-chosen folder (default `Documents\Sirman`)
- Per-user installation (not per-machine Program Files)
- Start Menu `Programs\Sirman` (`SIRMAN.lnk`, `Uninstall SIRMAN.lnk`, `SIRMAN Full Cleanup.lnk`)
- Desktop shortcut optional
- Level-1 uninstall via `Uninstall-Sirman.ps1` + `Sirman-InstallLifecycle.ps1`

---

## 6. Installer filename

`deliveries/Releases/1405.6.3-alpha-recovery-complete/Sirman_Setup_1405.6.3α-recovery-complete.zip`  
Size: 72618482 bytes. Entries: 495.

---

## 7. Portable ZIP filename

`deliveries/Releases/1405.6.3-alpha-recovery-complete/Sirman_Portable_1405.6.3α-recovery-complete.zip`  
Size: 72093598 bytes.  
Layout: `Sirman_Portable_1405.6.3α/` = published `App/` runtime (`Sirman.exe`, HTML, self-contained .NET, WebView2 loader, uninstall scripts). No git, tests, Cursor artifacts, or shop data.

---

## 8. Executable SHA-256

`d68f2c8f34ca171dcb5617e5ac27d0c10100fa0a1ade574b151fadf6421c9891`  
`App/Sirman.exe` (152064 bytes)

---

## 9. Installer SHA-256

`59ba82ab159c0b161660cf2b8384b3c267812c9f7ef545c6a97487985d861815`

---

## 10. ZIP SHA-256 (portable)

`77cc67b26f7adf497a9fee3251b6b3d6c040636acb055200228ba7c9653dc29c`

Also recorded in `SHA256SUMS.txt` in the same folder.

---

## 11. Automated test totals

| Suite | Command | Passed | Failed | Total |
|---|---|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **1094** | 0 | 1094 |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **844** | 0 | 844 |
| Installer lifecycle | `node test_installer_lifecycle.js` | **21** | 0 | 21 |

All PASS. Counts match the ARCH-26 freeze HTML/Core totals (1094 / 844).

---

## 12. Installation test results

Linux packer host: **no disposable Windows desktop**. WinExe + WebView2 cannot launch here.

| # | Check | Result |
|---|---|---|
| 1 | Installer package present (`نصب.bat` / `SETUP.bat` / `install-setup.ps1`) | PASS (extracted) |
| 2 | Installation completes | **NOT VERIFIED live.** Simulated extract + copy of `App\` to a throwaway dest succeeded |
| 3 | `Sirman.exe` launches | **NOT VERIFIED** (Linux) |
| 4 | WebView2 loads | **NOT VERIFIED** (Linux) |
| 5 | Main UI opens | **NOT VERIFIED** (Linux). Packaged HTML is the freeze file (1,875,323 bytes, SHA-256 below) |
| 6 | No startup exception | **NOT VERIFIED** (Linux) |
| 7 | Backup/restore entry points exist | PASS (static): `_buildFullBackupData`, `applyBackupMergeSections`, `applyBackupReplaceSections`, `finalizeBackupPackage`, Phonebook collectors, `disk://` / `sirman_media` |
| 8 | Version shown is `1405.6.3α` | PASS in packaged HTML (`var APP_VERSION = '1405.6.3α'`). Live UI **NOT VERIFIED** |
| 9 | Uninstall works | Contract tests PASS (21). Live Windows uninstall **NOT VERIFIED** |
| 10 | Uninstall does not delete user data | PASS in lifecycle tests + simulated Level-1 owned-file removal (see §13) |

`install-setup.ps1` contains no `importData` / `exportData` / `resetAll` / Restore calls.

---

## 13. Uninstall test

`node test_installer_lifecycle.js`: **21 / 21 PASS**, including:

- Level 1 keeps WebView2 profile and AppData backup
- Level 1 does not delete user-selected backup folder
- Level 1 does not blindly delete user files in the install folder
- Level 2 requires exact `CONFIRM`

Linux simulation after extracting this installer:

- Fake `%AppData%\Sirman\backup\shop-keep.json` survived
- `sirman_media/keep.bin` survived (`preserveDirNames`)
- User file `my-shop-notes.txt` beside the exe survived
- `Sirman.exe` / `Sirman_Final.html` were removed as owned program files

Live Windows Add/Remove Programs / Start Menu uninstall: **NOT VERIFIED**.

---

## 14. WebView2 verification

| Item | Result |
|---|---|
| Project reference | `Microsoft.Web.WebView2` **1.0.2903.40** (unchanged) |
| `Sirman.deps.json` | `Microsoft.Web.WebView2/1.0.2903.40` (+ Core / WinForms / Wpf) |
| Packaged | `WebView2Loader.dll` SHA-256 `462b36fd1be6ca9f7563466a89e57c41ef4a4def3e0a84fa885d203aea4a3aaf` |
| Runtime packaging | Loader + managed WebView2 assemblies in `App/`. Evergreen OS WebView2 Runtime is still required on the PC (same as previous kits) |
| Version change | none |

---

## 15. Security / package-content scan

Scanned both release ZIPs (names + small text files + secret regexes).

| Class | Found in package? |
|---|---|
| API / AI keys (`sk-`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AIza`, GitHub PAT, Slack) | NO |
| Private keys | NO |
| `.env` / `secrets.json` / `credentials.json` | NO |
| `.sqlite` / `.db` shop databases | NO |
| Shop backup JSON (`invoices`/`warranties`/`phonebook` without `SIRMAN_UPDATE` magic) | NO |
| Real customer / invoice / phonebook rows | NO |

Hits: **0**. The HTML and same-version update JSON are the application itself, not a shop dump.

---

## 16. ARCH-26 linkage

| Item | Value |
|---|---|
| Report | `deliveries/Reports/ARCH-26_RECOVERY_ACCEPTANCE_REPORT.md` (copy in the release folder) |
| Verdict | **BACKUP / RECOVERY = COMPLETE** |
| A–S | all PASS |
| HTML / Core at freeze | 1094 / 844 |
| Function SHA locks | all eight matched on freeze HTML before pack (see below) |

Freeze HTML SHA-256: `817cf16c9b3c668f290b9754686cfced36178ceeab66dcead67b0f6cce6935c8`  
Packaged `App/Sirman_Final.html` is byte-identical to that freeze.

| Function | SHA-256 |
|---|---|
| `_buildFullBackupData` | `f354ba9875b25c3160581b6f06a62e991c11fb7a6181f9172db0db93c78cbd41` |
| `applyBackupMergeSections` | `0505b31f8f46e96dd097294e37c17549c79810b422073f2cc33111cdab90dc49` |
| `applyBackupReplaceSections` | `b067f92b2e1bbf60c9d6edcc77dba68b5e839b44c8d0d61ab95967e47426b7af` |
| `savePBContact` | `1883f9d3dd575719ae6d653a30318faa38fed4dd9e046ead32a7070730e4cf81` |
| `collectPhonebookSnapshot` | `7595af4ed999d5c3213af78fe8ef5f74e1da4252d53961df466c998cc5e7a79c` |
| `collectRequiredBusinessSnapshot` | `92dd552685fce56b5cff75a41c4a767d658233affc6d3870d015dc379199c631` |
| `collectOptionalBusinessSnapshot` | `d885fa4c4c5f128f36db7799a5732adc3765025b9bebe204779a77c01a79b508` |
| `collectAttachmentIndex` | `ed781c62b8a0da9e80b458339cf3bf36bbabd38183ee5f5c1b81b9e686877d8f` |

---

## 17. Known explicit exceptions

1. Copy-only synthetic recovery; **not shop-VERIFIED**.
2. Live Windows install / exe launch / WebView2 UI / live uninstall **NOT VERIFIED** on this packer host.
3. Pretty disk JSON ≠ checksum canonical bytes.
4. Core RestorePlan does not apply (`Applied = false`).
5. Phonebook has no stable id.
6. Missing sidecar = PARTIAL WITH EXPLICIT MEDIA FAILURE.
7. Replace RAM `warehouseDocs` / `stockMoves` without `svWarehouse` / `svStockMoves` (ARCH-26 post-closure note; not patched here).
8. Physical print remains `PHYSICAL_PRINT_NOT_VERIFIED` / frozen (unchanged).
9. PE ProductVersion includes git SourceRevisionId of the packaging commit; UI version is still `1405.6.3α`.

---

## 18. Data-safety statement

The installer **does not**:

- initialize a new empty production database
- overwrite existing localStorage / IndexedDB
- delete existing backups or media
- reset Phonebook
- run Restore or migration against shop data
- alter existing shop configuration

Installation is not a reset. Mutable shop data is not placed as a new store beside the exe. Runtime SoT is unchanged. Level-1 uninstall must not delete backups, backup folders, shop data, media, or recovery snapshots (`level1NeverDelete` + `preserveDirNames: sirman_media`).

---

## 19. Rollback / uninstall strategy

1. Keep a full backup (JSON + `sirman_media`) **before** installing over a live PC.
2. Normal rollback of the program: Start Menu → **Uninstall SIRMAN** (Level 1). Shop data remains.
3. If the new exe/HTML must be reverted, copy the previous `App` tree back into the same install folder (or re-run the previous kit). Data stores are not owned by Level 1.
4. Level 2 Full Cleanup (`CONFIRM`) is **not** rollback; it destroys data by design.

---

## 20. Final release verdict

```text
RELEASE PACKAGE READY
```

Application behavior is the ARCH-26 freeze. Packaging used the existing self-contained kit. Automated HTML 1094, Core 844, and installer-lifecycle 21 all passed. Live Windows GUI install remains an explicit exception, not a forced PASS.

### Artifact paths

```text
deliveries/Releases/1405.6.3-alpha-recovery-complete/Sirman_Setup_1405.6.3α-recovery-complete.zip
deliveries/Releases/1405.6.3-alpha-recovery-complete/Sirman_Portable_1405.6.3α-recovery-complete.zip
deliveries/Releases/1405.6.3-alpha-recovery-complete/RELEASE_MANIFEST_1405.6.3-alpha.json
deliveries/Releases/1405.6.3-alpha-recovery-complete/RELEASE_NOTES_1405.6.3-alpha-recovery-complete.md
deliveries/Releases/1405.6.3-alpha-recovery-complete/SHA256SUMS.txt
deliveries/Releases/1405.6.3-alpha-recovery-complete/ARCH-26_RECOVERY_ACCEPTANCE_REPORT.md
deliveries/Reports/FINAL_RELEASE_PACKAGE_REPORT_1405.6.3.md
```
