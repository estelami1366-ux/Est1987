# SIRMAN 1405.6.3α — recovery-complete release notes

**Product:** SIRMAN  
**Version:** `1405.6.3α` (assembly `1405.6.3.1`)  
**Release name:** `SIRMAN-1405.6.3-alpha-recovery-complete`  
**Date:** 2026-09-06  
**Source freeze:** tag `release-1405.6.3-alpha-recovery-complete` @ `9fb9f6d3d08e1a7f8c46755d49c115934eb97f83`

This is a packaging / installable build of the exact post-ARCH-26 application. No feature, architecture, Restore, Phonebook, backup-engine, SQLite, or print changes.

---

## Architecture state

- UI: single-file `Sirman_Final.html` (byte-identical `Laegh_Final.html`)
- Shell: `desktop/Sirman.Desktop` → `Sirman.exe`, `net8.0-windows`, WebView2 Host Object `sirmanHost`
- Core: `desktop/Sirman.Core` (RestorePlan still does not apply; HTML Merge/Replace remains the apply engine)
- Data SoT unchanged: live shop data stays in the existing runtime stores (not beside a new installer-owned database)
- Runtime: **self-contained win-x64** (existing shop-kit design). .NET 8 desktop runtime is inside `App/`. Evergreen Microsoft Edge WebView2 Runtime must still be present on the PC.

---

## Backup / Recovery completion status

ARCH-26 copy-only synthetic Recovery Acceptance:

**BACKUP / RECOVERY = COMPLETE**

All blocking criteria **A–S PASS**.

This release has passed copy-only synthetic Recovery Acceptance.
It has not been verified by restoring a real shop dataset.

---

## ARCH-26 acceptance status

| Item | Result |
|---|---|
| Report | `ARCH-26_RECOVERY_ACCEPTANCE_REPORT.md` (copy in this folder) |
| HTML suite | 1094 / 1094 |
| Core suite | 844 / 844 |
| A–S | all PASS |
| Shop restore | not shop-VERIFIED |

---

## Major completed safety items (already in this source; not new in this packet)

- Backup generation via `_buildFullBackupData` + Host finalize when the Host path is used
- SHA-256 checksum attach / fail-closed verify
- Restore validation and `migrateBackup`
- Restore Merge and Restore Replace
- Phonebook Policy B; missing Phonebook section KEEP LIVE; explicit `phonebook: []` clears intentionally
- Attachment references and `sirman_media` sidecar support
- Level-1 uninstall does not delete backups, media, or shop data

---

## Known explicit exceptions

- Copy-only synthetic recovery; **not** verified against a real shop backup.
- Pretty-printed disk JSON is not the checksum input (canonical payload is).
- Core `RestorePlan.Applied` remains `false`. Apply is HTML Merge/Replace.
- Phonebook has no stable row id.
- Missing media sidecar is **PARTIAL WITH EXPLICIT MEDIA FAILURE**, not full recovery.
- Replace restores `warehouseDocs` / `stockMoves` in RAM; it does not call `svWarehouse` / `svStockMoves` (ARCH-26 post-closure note; not patched in this packet).
- Live Windows install / `Sirman.exe` launch / WebView2 UI / live uninstall were **not** executed on the Linux packer host.
- PE `ProductVersion` includes SDK SourceRevisionId: `1405.6.3α+f79d80a73a1186d1673dd687845e389b043598b1`. In-app version remains `1405.6.3α`.

---

## Installation instructions

Installer technology is the **existing** one-click ZIP kit (not MSI / Inno).

1. Copy `Sirman_Setup_1405.6.3α-recovery-complete.zip` to the Windows PC.
2. Extract All.
3. Double-click `نصب.bat` (or `SETUP.bat`).
4. Choose the install folder (suggested: `Documents\Sirman`). This is a **per-user** folder copy, not Program Files.
5. Confirm whether to also create a Desktop shortcut. Start Menu `Programs\Sirman` is always created.
6. Open **SIRMAN** from the Start Menu.

Portable ZIP: extract `Sirman_Portable_1405.6.3α-recovery-complete.zip` and run `Sirman.exe` from `Sirman_Portable_1405.6.3α\`. Same self-contained runtime. No installer shortcuts unless you create them yourself.

If the window is blank, install Evergreen WebView2 Runtime:  
https://developer.microsoft.com/microsoft-edge/webview2/

Installation is **not** a reset. It does not import/export backup, run Restore, migrate shop data, recreate Phonebook, or initialize a new production database.

---

## Uninstall behavior

- **Level 1** (Start Menu → Uninstall SIRMAN): removes program files and shortcuts. **Does not** delete backups, backup folders, `sirman_media`, WebView2 profile data, or other shop data.
- **Level 2** (SIRMAN Full Cleanup): only after typing `CONFIRM`. That path is explicit data destruction and is not the normal uninstall.

---

## Backup recommendation

Before installing this package over a PC that already has live shop data, take a full backup from **ورود/خروج داده** (and copy the backup folder + `sirman_media` off the machine). Keep that copy until you have opened the app and confirmed the shop looks normal.

---

## Required statement

This release has passed copy-only synthetic Recovery Acceptance.
It has not been verified by restoring a real shop dataset.
