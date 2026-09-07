# SIRMAN Release `1405.6.16α`

**Release date:** 1405/06/16 (2026-09-07)  
**App version:** `1405.6.16α`  
**Assembly / File version:** `1405.6.16.1`  
**Informational version:** `1405.6.16α`  
**Kind:** Windows release / packaging only — no business-logic change  
**Base:** post–Inventory P2 + Safe Operational Checkpoint (`d499b6f` on `cursor/safe-operational-checkpoint-fa01`)  
**Branch:** `cursor/release-1405-6-16-alpha-fa01`  
**Tag:** `release-1405.6.16-alpha`

---

## Changes included

This build packages the exact current source after:

- ARCH-26 Backup / Recovery **COMPLETE**
- P0 Inventory Manual Adjust **COMPLETE**
- P1 Inventory Excel Import **COMPLETE**
- P2 Stocktake Core Cutover **COMPLETE**
- Safe Operational Checkpoint **COMPLETE**

No architecture phase, no Inventory packet, no Backup/Recovery/Phonebook/Print/Restore/SQLite/Daqi/`importParts`/`delWarehouseEntity`/Sales/Warranty/Accounts/Services logic change. Only version metadata, current-version test locks (assembler SHA after the backup `version` stamp), launchers, changelog/baseline, update JSON, and the Windows kit.

---

## Tests

| Suite | Command | Result |
|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **1118 / 1118** |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **859 / 859** |
| Installer lifecycle | `node test_installer_lifecycle.js` | **21 / 21** |

---

## Build result

| Item | Result |
|---|---|
| `dotnet publish` Desktop | **OK** — `net8.0-windows` / `win-x64` / `--self-contained true` / `EnableWindowsTargeting=true` |
| `Sirman.exe` | present, 152 064 bytes |
| `WebView2Loader.dll` | present |
| `Microsoft.Web.WebView2` | **1.0.2903.40** |
| ProductVersion | `1405.6.16.1` |
| Informational / app | `1405.6.16α` |
| Runtime | `Microsoft.NETCore.App` 8.0.30 + `Microsoft.WindowsDesktop.App` 8.0.30 |
| Pre-existing warning | MSB3277 WindowsBase 4 vs 5 — publish succeeded |
| Execute EXE here | **Not possible** (Linux agent) |

Packer: existing `scripts/write_full_update_json.py` + `scripts/pack_sirman_setup.py`. Installer system not replaced. Contract `scripts/setup-kit/sirman-install-contract.json` unchanged in policy (Level-1 keeps WebView2 + backups).

---

## Package contents

Directory: `deliveries/Sirman_Setup_1405.6.16α/`  
ZIP: `Sirman_Setup_1405.6.16α.zip` and `deliveries/Sirman_Setup_1405.6.16α.zip` (identical)

Includes: `Sirman.exe`, `Sirman_Final.html`, `WebView2Loader.dll`, self-contained runtime, installer scripts (`نصب.bat` / `SETUP.bat` / `install-setup.ps1`), `sirman-install-contract.json`, `Sirman-InstallLifecycle.ps1`, full-HTML `Sirman_Pending_Update.json` / `updates/Sirman_Update_1405.6.16α.json`, launchers, `SIRMAN_VERSION.json`.

Does **not** include shop data, localStorage, IndexedDB, invoices, customers, phonebook records, backups, API keys, passwords, or secrets.

Install-over does not wipe `%LOCALAPPDATA%\Sirman\WebView2` or `%APPDATA%\Sirman\backup`. Level-1 uninstall preserves that policy (synthetic **21/21**).

---

## SHA-256

| Artifact | SHA-256 | Bytes |
|---|---|---|
| Source `Sirman_Final.html` | `71643c78608402fa52073b053b92806d7454b66a20eaf8f378d323b0b2e5d68f` | 1 884 243 |
| Packaged kit HTML | `71643c78608402fa52073b053b92806d7454b66a20eaf8f378d323b0b2e5d68f` | 1 884 243 |
| `Laegh_Final.html` | identical to source | 1 884 243 |
| Kit `Sirman.exe` | `887018314bce728da8421d40f2e1578174c418b880c914a50670b522cc61b273` | 152 064 |
| Kit `Sirman.dll` | `8e45713678d8a660fbaad1b043c6c4433aa541805bb62926af0a846b3aec4eef` | 209 408 |
| ZIP | `0f66467a5f891facbb2c58f02e145fa6c5bfaf7de01e5d9b13812b0a8908f937` | 72 627 123 |

Source HTML == packaged HTML byte-for-byte.

---

## Known limitations

- Backup / Recovery **COMPLETE** (not reopened)
- Inventory Manual Adjust **COMPLETE**
- Inventory Excel Import **COMPLETE**
- Inventory Stocktake **COMPLETE**
- Print physical verification **NOT VERIFIED** (`PHYSICAL_PRINT_NOT_VERIFIED`)
- SQLite **NOT** canonical (live SoT remains localStorage / IndexedDB)
- Daqi direct quantity path (`deductFromGeneralStock`) **parked**
- `delWarehouseEntity` **parked**
- `importParts` remains a separate parts-domain path
- Restore `warehouseDocs` / `stockMoves` persistence gap remains **parked**
- WinForms / WebView2 runtime was **not** executed by this Linux agent
