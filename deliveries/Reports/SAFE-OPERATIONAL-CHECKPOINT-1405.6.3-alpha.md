# SIRMAN — Final Safe Operational Checkpoint after Inventory P2

**Date:** 2026-09-06  
**Product:** `1405.6.3α` / assembly `1405.6.3.1`  
**Kind:** VERIFY + RECORD ONLY — not a new architecture phase, not ARCH-28, not a new Inventory packet  
**Post-P2 source:** `ad2311d` (`docs: record P2 stocktake Core cutover test totals`)  
**Pack commit (existing kit):** `b056b31` (`chore: refresh 1405.6.3α setup kit to post-P2 HTML`)  
**Verify HEAD before this report:** `e0158b0` (`docs: record 1405.6.3α safe operational checkpoint`)  
**Branch:** `cursor/safe-operational-checkpoint-fa01`  
**Decision:** **YELLOW** — usable shop checkpoint with explicitly listed limitations  
**Final status:** **CHECKPOINT READY**

No business-logic edit in this packet. No Backup / Recovery / Phonebook / Print / Restore / SQLite / Inventory Core semantics / Daqi / `delWarehouseEntity` / `importParts` / Sales / Warranty / Accounts / Services change. No new migration packet. Existing shop kit was **verified** (HTML already byte-identical to source); packer was **not** re-run.

---

## 0. Decision

**YELLOW — safe operational checkpoint after the planned Inventory Core migration window (P0 manual adjust, P1 Excel product qty, P2 stocktake), with the limitations in §7. Those limitations were not fixed here.**

Not RED: official suites pass, Desktop win-x64 publish succeeds, HTML pair is byte-identical, live SoT remains localStorage/IndexedDB (not SQLite), kit HTML matches source, no accidental business-tree edits.

Not GREEN: this agent cannot run WinForms/WebView2 or a physical printer; print remains `PHYSICAL_PRINT_NOT_VERIFIED`; parked EXE qty paths remain (`deductFromGeneralStock`, `delWarehouseEntity`, `importParts`); Restore `warehouseDocs`/`stockMoves` LS persist gap remains parked.

---

## 1. Repository state

| Check | Result |
|---|---|
| `git status` (business tree) | Clean. Unrelated leftover dirt **left unstaged**: `deliveries/migration/P1-services/services.candidate.sqlite` (+ sha256); forensic markdown under `deliveries/Reports/` (phonebook / P1B / backup). **Not part of this checkpoint.** |
| Branch | `cursor/safe-operational-checkpoint-fa01` tracking `origin/cursor/safe-operational-checkpoint-fa01` |
| Verify HEAD | `e0158b0e25e9c1d963e9abf263a83ef37d81272e` |
| Inventory P2 feat | `3bc8ccc` (`feat: route EXE stocktake qty through Core inventory.adjust`) |
| Inventory P1 feat | `b11a65d` (`feat: route EXE Excel product qty import through Core`) |
| Inventory P0 feat | `48bc9b2` (`feat: route EXE manual inventory qty edits through Core`) |
| `Sirman_Final.html` == `Laegh_Final.html` | **IDENTICAL** — 1 883 873 bytes, SHA-256 `317ec82f7e48f9b6c72c39278e5ba635d08cf6e53e8597075d676cede3e46850` |
| Accidental unrelated changes in HTML/.NET | **None** (`git diff HEAD -- Sirman_Final.html Laegh_Final.html desktop SIRMAN_VERSION.json scripts test_laegh.js` empty) |
| Expected sources present | `Sirman_Final.html`, `desktop/Sirman.Desktop`, `desktop/Sirman.Core`, `scripts/pack_sirman_setup.py`, `scripts/setup-kit/sirman-install-contract.json` |

---

## 2. Version

| Location | Value |
|---|---|
| `SIRMAN_VERSION.json` `app` | `1405.6.3α` |
| `SIRMAN_VERSION.json` `assembly` | `1405.6.3.1` |
| HTML `<meta name="app-version">` | `1405.6.3α` |
| HTML `APP_VERSION` / `APP_BASE_VERSION` | `1405.6.3α` |
| `desktop/Directory.Build.props` `InformationalVersion` | `1405.6.3α` |
| `desktop/Directory.Build.props` `Version` / `FileVersion` | `1405.6.3.1` |
| Packed `Sirman.dll` ProductVersion string | `1405.6.3.1` |
| Fresh publish `Sirman.dll` | contains `1405.6.3.1` |

Version was **not** bumped (same-day α by instruction).

---

## 3. Test results

Commands run on this Linux agent. Tests were not edited. Evidence under `/opt/cursor/artifacts/`.

| Suite | Command | Result |
|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **1118 / 1118** (0 failed) |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **859 / 859** (0 failed) |
| Installer lifecycle (synthetic) | `node test_installer_lifecycle.js` | **21 / 21** |

HTML inventory groups observed in this run:

- P0 manual adjust — all pass, including HTML-only `Object.assign` fallback
- P1 Excel product qty — all pass, including HTML-only create-record fallback
- P2 stocktake — all pass, including HTML-only `_applyStockMovement` fallback

Core locks that support EXE qty: `InventoryCore.AdjustStock`, `ApplyByWarehouse`, `AddStock`, `Consume`, `invoice.close` (`Phase2CompleteTests`, `BusinessCoreTests`, `InventoryStocktakeAdjustTests`).

Pre-existing analyzer warnings in Core.Tests (xUnit2013/2000) and `CS8602` in `ServiceRowHash.cs` — not treated as suite failure.

---

## 4. Build result

| Item | Result |
|---|---|
| `dotnet publish` Desktop | **OK** — `net8.0-windows` / `win-x64` / `--self-contained true` / `EnableWindowsTargeting=true` |
| Output | `/tmp/sirman-checkpoint-publish/` |
| `Sirman.exe` | present, 152 064 bytes |
| `UseWindowsForms` | `true` |
| WebView2 | `Microsoft.Web.WebView2` 1.0.2903.40; `WebView2Loader.dll` shipped |
| Runtime | `Microsoft.NETCore.App` 8.0.30 + `Microsoft.WindowsDesktop.App` 8.0.30 (self-contained) |
| HTML beside EXE (kit) | `deliveries/Sirman_Setup_1405.6.3α/App/Sirman_Final.html` == source SHA `317ec82f…` |
| Pre-existing warning | MSB3277 WindowsBase 4 vs 5 (WebView2 WPF ref). Publish succeeded. Not a release blocker. |
| Execute EXE here | **Not possible** (Linux agent, no WinForms/WebView2 runtime) |

PE hashes of a fresh publish differ from the already-packed kit EXE (typical non-deterministic PE timestamp). Kit HTML is the integrity gate; it still matches source. Packer was **not** re-run.

---

## 5. Operational areas verified (source + tests)

Confirmed from live `Sirman_Final.html` and official suites. **EXE** means `hasBusinessCore()` true (Host `RunBusiness`). **HTML-only** means Host off — fallback still present.

| Area | UI / function | EXE Core ownership | HTML-only fallback | Evidence |
|---|---|---|---|---|
| Manual inventory adjustment | `saveInvItem` | `invAdjustOnItem` → `inventory.adjust` / `InventoryCore.AdjustStock`. Fail-closed: no HTML qty write | `Object.assign(..., {qty})` + `sv()` | HTML P0 group; Core adjust tests |
| Excel product inventory creation | `importProducts` (new codes, no existing `inventory[code]`) | `invAdjustOnItem` → `inventory.adjust`. Existing product codes not mutated | `inventory[code]={qty,min,note}` plant | HTML P1 group |
| Stocktake | `applyStocktakeAdjustments` | Absolute `invAdjustOnItem` / `inventory.adjust` with empty `whId` (general stock). Mixed rows: success persists, failure leaves row | `_applyStockMovement` + HTML `.qty` | HTML P2 group; `InventoryStocktakeAdjustTests` |
| Invoice close | `closeInv` | `invoice.close` then `applyCoreRecordOnto` on invoice + inventory | HTML `inventory[code].qty = max(0, qty-1)` + `_applyStockMovement` | HTML closeInv contract; `InvoiceClose_ConsumesInventoryAndSetsStatus` |
| Warehouse documents | `saveWarehouseDoc` | `inventory.applyWarehouseDoc` after preflight `invStockSnapshot` | HTML loop via `applyStockByWarehouse` / reserve helpers + `svWarehouse()` | HTML warehouse EXE tests; Core warehouse apply |
| Warehouse transfer | `transferBetweenWarehouses` | Per item: `applyStockByWarehouse('out')` then `('in')` → EXE `inventory.applyByWarehouse` | Same helper’s HTML delta / `_sumByWh` path when Host off | HTML `applyByWarehouse` in/out tests; Core `ApplyByWarehouse_*` |
| Stock consume (sale) | `_deductStock` | `inventory.consume` + `applyCoreItemOnto` | HTML `parts[idx].qty = max(0, available - qty)` | HTML consume tests; Core `Consume_UsesMaxZero_LikeSaleDeduct` |
| Stock add / restock | `_restockFromSale` | `inventory.addStock` | HTML `parts[idx].qty += qty` | HTML addStock success/fail tests; Core `AddStock_*` |
| Warranty part consume | `saveWar` → `applyPartReqs` | `inventory.consume` on `parts[idx]` | HTML `parts[idx].qty = max(0, available-qty)` | HTML warranty consume contract tests |

HTML-only fallbacks **remain available** on every row above (`hasBusinessCore` false branches still in source). Architecture rule 6 preserved.

---

## 6. Package

Existing packer only: `scripts/write_full_update_json.py` + `scripts/pack_sirman_setup.py`. Already used at `b056b31`. This verify pass did **not** invent an installer and did **not** re-pack (source HTML unchanged).

| Artifact | Path / hash |
|---|---|
| Installer kit | `deliveries/Sirman_Setup_1405.6.3α/` (`نصب.bat` / `SETUP.bat`) |
| Portable ZIP | `Sirman_Setup_1405.6.3α.zip` (72 625 605 bytes) SHA-256 `2594381d52c3e1ae037a7d44e1edf58732535feaf347f270620aaf9e0abe6d9b` |
| Kit HTML | SHA-256 `317ec82f…` = source |
| Kit `Sirman.exe` | SHA-256 `d1ee673a8395a7a414f86564301d86c2abc30cc9ecb39c18d0cbf57231136d75` |
| Update JSON | `Sirman_Pending_Update.json` / `updates/Sirman_Update_1405.6.3α.json` — full HTML `replaceAppFile`, not shop backup |

Never included: shop invoices, phonebook, localStorage, IndexedDB, secrets, API keys.

Install-over / Level-1 uninstall still as previously recorded from contract + synthetic 21/21: WebView2 user-data (`%LOCALAPPDATA%\Sirman\WebView2`) and backups are not deleted by Level-1.

---

## 7. Known limitations (recorded, **not** fixed)

1. **`deductFromGeneralStock` (Daqi)** — still PARKED. EXE still does `inventory[code].qty -=` / `parts.qty -=` directly. Not Core-owned.
2. **`delWarehouseEntity`** — still PARKED. EXE still rewrites `byWh` and `qty = _sumByWh`. Not Core-owned.
3. **`importParts`** — still a separate parts-catalog plant (`parts.push({qty: ...})`), not the product `inventory[code]` Core path.
4. **Physical printer** — still `PHYSICAL_PRINT_NOT_VERIFIED`. Print module remains FROZEN / ISOLATED. Not claimed.
5. **Restore warehouse persistence note** — still PARKED (Restore-owned, ARCH-26 post-closure / ARCH-27 V5). Production Replace/Merge assign `warehouseDocs` and `stockMoves` in RAM (`applyBackupReplaceSections` / `applyBackupMergeSections`) but do not call `svWarehouse` / `svStockMoves`. A later reload hydrates those two collections from LS unless another UI save runs. Not treated as Inventory P0/P1/P2 work. Not patched here.
6. **SQLite** — still candidate, not live SoT.
7. **Live WinForms / WebView2 start** — not executed on this Linux agent. Shop PC still needs WebView2 Runtime.
8. **Older EXE + this HTML** — shell of this same version is still required for Host/print behavior (baseline known issue).
9. **MSB3277 WindowsBase** — pre-existing publish warning; not a new fix.
10. **Product version date** remains `1405/06/03` / `1405.6.3α` by instruction.

---

## 8. Deployment risk

| Risk | Level | Note |
|---|---|---|
| Official HTML/Core suites | Low | 1118 / 859 green on this tree |
| Kit HTML drift vs source | Low | Identical SHA |
| Live Windows GUI / WebView2 | Medium | Not executed here |
| Physical print | Unchanged / unverified | FROZEN; do not claim paper output |
| Parked Daqi / warehouse-entity delete / parts Excel | Medium for those UIs only | Daily product qty EXE paths are Core-owned; these three are not |
| Restore `warehouseDocs`/`stockMoves` LS | Known parked | RAM restore works; those two LS keys may drop on reload until a later persist |
| GitHub ZIP size | Informational | ~72.6 MB (same class as prior self-contained kits) |

---

## 9. Final recommendation

Use the existing `Sirman_Setup_1405.6.3α.zip` (hash above) to install **over** the current shop application. Do not interpret this checkpoint as print verification, SQLite cutover, Restore warehouse-LS fix, or “inventory universally complete.”

Planned Inventory Core window for daily EXE product qty (manual edit, Excel new-product qty, stocktake) is **closed**. Related EXE qty already Core-owned: invoice close, warehouse documents, warehouse transfer, sale consume/restock, warranty part consume. HTML-only fallbacks remain.

---

## 10. Final verdict

**YELLOW / CHECKPOINT READY**

GREEN is refused: live Windows/WebView2 and physical print were not evidenced here, and parked limitations in §7 remain.

RED is refused: integrity, official suites, and Desktop publish succeeded; no accidental business edits.
