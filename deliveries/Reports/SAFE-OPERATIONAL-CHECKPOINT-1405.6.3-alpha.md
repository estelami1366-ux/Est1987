# SIRMAN — Safe Operational Checkpoint `1405.6.3α`

**Date:** 2026-09-06  
**Product:** `1405.6.3α` / assembly `1405.6.3.1`  
**Kind:** VERIFY + PACK ONLY — not a new architecture phase, not ARCH-28, not a new Inventory packet  
**Base source HEAD:** `ad2311d` (`docs: record P2 stocktake Core cutover test totals` on `cursor/p2-stocktake-core-cutover-fa01`)  
**Checkpoint branch:** `cursor/safe-operational-checkpoint-fa01`  
**Decision:** **YELLOW** — usable shop checkpoint with known limitations  
**Final status:** **CHECKPOINT READY**

No business-logic edit. No Backup/Recovery, Phonebook, Print, Restore, SQLite, or Inventory Core semantic change. Packaging used existing `scripts/write_full_update_json.py` + `scripts/pack_sirman_setup.py` so the shop kit HTML matches post-P2 source.

---

## 0. Decision

**YELLOW — safe to install over the current shop application for daily use, with the limitations in §8. Those limitations are not newly fixed.**

Not RED: official suites pass, Desktop win-x64 publish succeeds, Level-1 uninstall preserves synthetic user data, live SoT remains localStorage/IndexedDB (not SQLite), HTML pair is byte-identical.

Not GREEN: this agent cannot run WinForms/WebView2 or a physical printer; print remains `PHYSICAL_PRINT_NOT_VERIFIED`; some EXE inventory qty paths remain parked.

---

## 1. Repository integrity

| Check | Result |
|---|---|
| Branch at verify | `cursor/p2-stocktake-core-cutover-fa01` @ `ad2311d` |
| Checkpoint branch | `cursor/safe-operational-checkpoint-fa01` (from that HEAD) |
| `Sirman_Final.html` == `Laegh_Final.html` | **IDENTICAL** SHA-256 `317ec82f7e48f9b6c72c39278e5ba635d08cf6e53e8597075d676cede3e46850` (1 883 873 bytes) |
| Product version | `1405.6.3α` in `SIRMAN_VERSION.json`, `APP_VERSION`, `<meta name="app-version">`, backup `version`, `Directory.Build.props` InformationalVersion |
| Assembly | `1405.6.3.1` in `Directory.Build.props` and packed `Sirman.dll` strings |
| Expected sources present | `Sirman_Final.html`, `desktop/Sirman.Desktop`, `desktop/Sirman.Core`, `scripts/pack_sirman_setup.py`, `scripts/setup-kit/sirman-install-contract.json` |
| Accidental unrelated dirt (left unstaged) | `deliveries/migration/P1-services/services.candidate.sqlite` (+ sha256); leftover forensic markdown; garbled `deliveries/Sirman_Setup_1405.6.3α` duplicate path with `\316\261`. **Not part of this checkpoint.** |
| HTML / Core / Desktop source tree | Unchanged by this packet except packaging payloads listed in §6 |

Before pack, `deliveries/Sirman_Setup_1405.6.3α/App/Sirman_Final.html` SHA-256 was `37c723cd…` ≠ source. After pack it matches source.

---

## 2. Test baseline

Commands run on this agent (Linux). Tests were not edited.

| Suite | Command | Result |
|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **1118 / 1118** |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **859 / 859** |
| Installer lifecycle (synthetic temp dirs) | `node test_installer_lifecycle.js` | **21 / 21** |

Evidence: `/opt/cursor/artifacts/checkpoint-html-suite.log`, `checkpoint-core-suite.log`, `checkpoint-installer-lifecycle.log`.

---

## 3. Build / package readiness

| Item | Result |
|---|---|
| `dotnet publish` Desktop | **OK** — `net8.0-windows` / `win-x64` / `--self-contained true` / `EnableWindowsTargeting=true` |
| Output | `/tmp/sirman-checkpoint-publish/` then packer `/tmp/sirman-fd-publish/` → kit `App/` |
| `Sirman.exe` | present, 152 064 bytes, SHA-256 `d1ee673a8395a7a414f86564301d86c2abc30cc9ecb39c18d0cbf57231136d75` |
| `Sirman.dll` ProductVersion string | `1405.6.3.1` |
| WebView2 | `Microsoft.Web.WebView2` 1.0.2903.40; `WebView2Loader.dll` in publish/kit |
| WinForms | `<UseWindowsForms>true</UseWindowsForms>` |
| Runtime config | `Microsoft.NETCore.App` 8.0.30 + `Microsoft.WindowsDesktop.App` 8.0.30 (self-contained) |
| HTML beside EXE | kit `App/Sirman_Final.html` == source |
| Configuration | `Sirman.runtimeconfig.json`, `Sirman.deps.json`, `sirman-install-contract.json` |
| Pre-existing build warning | MSB3277 WindowsBase 4 vs 5 (WebView2 WPF ref). Publish still succeeded. Not treated as a release blocker. |
| Execute EXE here | **Not possible** (Linux agent, no WinForms/WebView2 runtime) |

Packer used (unchanged scripts):

1. `python3 scripts/write_full_update_json.py` — pending/update JSON now embed current HTML  
2. `python3 scripts/pack_sirman_setup.py` — self-contained kit + zip  

No new installer architecture.

---

## 4. Release safety (install over / uninstall)

Verified from **source + synthetic tests only**. No real shop directory was touched.

| Requirement | Evidence |
|---|---|
| Preserve localStorage / IndexedDB | WebView2 user-data folder is `%LOCALAPPDATA%\Sirman\WebView2`. Contract `level1NeverDelete.localAppDataSirmanChildren: ["WebView2"]`. Lifecycle test: Level-1 keeps `WebView2/.../local-storage.json`. |
| Does not overwrite shop data | `install-setup.ps1` copies **program files** into the chosen install folder (`Copy-Item App\*`). It does not wipe `%LOCALAPPDATA%\Sirman\WebView2` or `%APPDATA%\Sirman\backup`. |
| Does not require SQLite | CHANGELOG + baseline: SQLite is **candidate**; live SoT is localStorage. Desktop does not open a shop SQLite as SoT. |
| Does not change live SoT | No Core/HTML persist-path edit in this packet. |
| Install over current app | Setup copies EXE/HTML/runtime onto the install folder and refreshes `Sirman_Pending_Update.json` (full HTML, not the 1KB stub). Old tiny pending JSON is replaced/removed (`< 100000` bytes). |
| Level-1 uninstall does not remove user data | `Invoke-SirmanLevel1Uninstall` removes owned program files only. Wholesale `%LOCALAPPDATA%\Sirman` / `%APPDATA%\Sirman` is forbidden. User-selected backup excluded. Other install path is not silently deleted. **21/21** synthetic tests. |
| Level-2 full cleanup | Requires typing exact `CONFIRM` (not `confirm`, not `تایید`). Wrong token deletes nothing. |

Isolated dirs only (`os.tmpdir()` / `mkdtempSync`). No live shop uninstall.

---

## 5. Smoke checklist (source-level / automated)

Physical Windows GUI and printer were **not** exercised on this agent.

| # | Item | How verified | Result |
|---|---|---|---|
| 1 | Application starts | HTML group 0 loads the full script in a mock DOM (`vm`); Desktop publish produces `Sirman.exe` | **PASS (source/CI)** — live WinForms start **not** run here |
| 2 | WebView2 loads | `MainForm.InitWebViewAsync` uses `CoreWebView2Environment` at `%LOCALAPPDATA%\Sirman\WebView2`; `WebView2Loader.dll` shipped | **PASS (source/pack)** — runtime load **not** run here |
| 3 | Existing data readable | Backup/restore + IndexedDB tests in HTML 1118; Level-1 keeps WebView2 folder | **PASS (automated)** |
| 4 | Inventory manual edit | P0 group: EXE `inventory.adjust` via `invAdjustOnItem` | **PASS** |
| 5 | Inventory Excel import | P1 group: new `inventory[code]` through Core | **PASS** |
| 6 | Stocktake | P2 group: absolute `inventory.adjust`; HTML-only `_applyStockMovement` preserved | **PASS** |
| 7 | Invoice close | EXE `invoice.close`; HTML-only deduct still present as fallback | **PASS (automated)** |
| 8 | Warehouse operation | EXE `inventory.applyWarehouseDoc` / `applyByWarehouse` tests | **PASS** |
| 9 | Backup generation | `_buildFullBackupData` / checksum / IDB groups | **PASS** |
| 10 | Recovery validation | fail-closed validators + recovery acceptance Core tests | **PASS** |
| 11 | Print remains isolated | HTML tests lock `IPrintService` / `PRINT MODULE ISOLATED`; print sources not edited | **PASS (isolation)** — **PHYSICAL_PRINT_NOT_VERIFIED** |
| 12 | HTML-only fallback | `hasBusinessCore` false paths remain for stocktake, manual adjust, import, invoice, warehouse | **PASS (architecture preserved)** |

---

## 6. Release artifacts

| Artifact | Path |
|---|---|
| Checkpoint report | `deliveries/Reports/SAFE-OPERATIONAL-CHECKPOINT-1405.6.3-alpha.md` |
| SHA-256 list | `deliveries/Reports/SAFE-OPERATIONAL-CHECKPOINT-1405.6.3-alpha.SHA256.txt` |
| Installer kit | `deliveries/Sirman_Setup_1405.6.3α/` (`نصب.bat` / `SETUP.bat`) |
| Portable ZIP | `Sirman_Setup_1405.6.3α.zip` (72 625 605 bytes) |
| Install contract | `deliveries/Sirman_Setup_1405.6.3α/sirman-install-contract.json` |
| Full-HTML update payload | `updates/Sirman_Update_1405.6.3α.json` and `Sirman_Pending_Update.json` (now = current HTML) |

ZIP SHA-256: `2594381d52c3e1ae037a7d44e1edf58732535feaf347f270620aaf9e0abe6d9b`

No shop invoices, phonebook, or secrets are in the kit. Pending JSON is an HTML `replaceAppFile` package (`magic: SIRMAN_UPDATE`), not a business backup.

### Release notes (pack only — version not bumped)

Shop kit HTML/EXE/update JSON now match post-P2 source `ad2311d` (`1405.6.3α`). Inventory EXE paths already in that source: manual adjust, Excel new-product qty, stocktake. Install/uninstall contracts unchanged in intent (Level-1 preserves data). Print unchanged.

---

## 7. Remaining EXE inventory qty paths (unchanged by this checkpoint)

From P2 cutover report — **not claimed fixed here**:

| Path | Class |
|---|---|
| `saveInvItem` / `importProducts` (new) / `applyStocktakeAdjustments` / `closeInv` EXE / warehouse docs / consume-addStock | CORE-OWNED |
| same functions when Host is off | HTML-ONLY FALLBACK |
| `importParts` | PARKED |
| `deductFromGeneralStock` (Daqi) | PARKED |
| `delWarehouseEntity` | PARKED |

---

## 8. Limitations that must NOT be read as newly fixed

1. **Physical print** — still `PHYSICAL_PRINT_NOT_VERIFIED`. Print module still FROZEN/ISOLATED.  
2. **WebView2 / WinForms live start** — not executed on this Linux agent. Shop PC still needs WebView2 Runtime.  
3. **SQLite** — still candidate, not live SoT.  
4. **HTML-only fallback** — still required by architecture; offline qty rules are not Core.  
5. **Daqi `deductFromGeneralStock`**, **`delWarehouseEntity`**, **`importParts`** — still not Core-owned.  
6. **Product version date** remains `1405/06/03` / `1405.6.3α` by instruction; not a same-day letter bump.  
7. **MSB3277 WindowsBase** warning on Desktop publish — pre-existing, not a new fix.  
8. **Older EXE + this HTML** — shell of this same version is still required for Host/print behavior (baseline known issue).

---

## 9. Final verdict

**YELLOW / CHECKPOINT READY**

Use `Sirman_Setup_1405.6.3α.zip` from this checkpoint to install **over** the current app. Level-1 uninstall will not delete WebView2/localStorage or backups. Do not interpret this as print verification, SQLite cutover, or completion of all inventory qty paths.
