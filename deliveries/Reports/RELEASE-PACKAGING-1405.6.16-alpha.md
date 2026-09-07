# SIRMAN Release Packaging Record `1405.6.16α`

**Date:** 2026-09-07 / 1405/06/16  
**Final status:** **RELEASE READY — 1405.6.16α**

## Git

| Item | Value |
|---|---|
| Branch | `cursor/release-1405-6-16-alpha-fa01` |
| Base checkpoint | `d499b6f` (`docs: record final 1405.6.3α checkpoint after Inventory P2`) |
| Release commit | `307c5dd480ae4756491bfc66af5ab03b1e8695c2` (`release: 1405.6.16-alpha`) |
| Release tag | `release-1405.6.16-alpha` |

## Version locations

| Location | Value |
|---|---|
| `SIRMAN_VERSION.json` `app` | `1405.6.16α` |
| `SIRMAN_VERSION.json` `assembly` | `1405.6.16.1` |
| `SIRMAN_VERSION.json` `date` | `1405/06/16` |
| HTML `<meta name="app-version">` / `APP_VERSION` / `APP_BASE_VERSION` | `1405.6.16α` |
| HTML `APP_VERSION_FA` / sidebar | `۱۴۰۵.۶.۱۶α` |
| Backup assembler `version` / `applicationVersion` | `1405.6.16α` |
| `desktop/Directory.Build.props` Version / FileVersion | `1405.6.16.1` |
| `desktop/Directory.Build.props` InformationalVersion | `1405.6.16α` |
| `Sirman_Start.bat` / `OPEN_SIRMAN.bat` / `sirman_run.ps1` | `1405.6.16α` |
| Packaged `Sirman.dll` ProductVersion | `1405.6.16.1` |

Historical reports were not rewritten. Help changelog keeps `۱۴۰۵.۶.۳α` as history.

## Hashes

| Item | SHA-256 |
|---|---|
| Source HTML | `71643c78608402fa52073b053b92806d7454b66a20eaf8f378d323b0b2e5d68f` |
| Package HTML | `71643c78608402fa52073b053b92806d7454b66a20eaf8f378d323b0b2e5d68f` |
| EXE | `887018314bce728da8421d40f2e1578174c418b880c914a50670b522cc61b273` |
| ZIP | `0f66467a5f891facbb2c58f02e145fa6c5bfaf7de01e5d9b13812b0a8908f937` |

`Sirman_Final.html` == `Laegh_Final.html` == kit `App/Sirman_Final.html`.

## Tests

| Suite | Result |
|---|---|
| `node test_laegh.js Sirman_Final.html` | **1118 / 1118** |
| `dotnet test desktop/Sirman.Core.Tests` | **859 / 859** |
| `node test_installer_lifecycle.js` | **21 / 21** |

## Build

Desktop `win-x64` self-contained publish **OK**. WebView2 **1.0.2903.40**. `Sirman.exe` and `WebView2Loader.dll` present in kit.

## Package path

- Kit: `deliveries/Sirman_Setup_1405.6.16α/`
- ZIP (packer): `/workspace/Sirman_Setup_1405.6.16α.zip`
- ZIP (requested copy): `deliveries/Sirman_Setup_1405.6.16α.zip`

No shop data / localStorage / IndexedDB / secrets in the kit.

## Known limitations

- Print physical verification **NOT VERIFIED**
- SQLite **NOT** canonical
- Daqi `deductFromGeneralStock` parked
- `delWarehouseEntity` parked
- `importParts` separate parts-domain path
- Restore `warehouseDocs`/`stockMoves` LS persist gap parked
- WinForms/WebView2 runtime not executed on Linux agent
