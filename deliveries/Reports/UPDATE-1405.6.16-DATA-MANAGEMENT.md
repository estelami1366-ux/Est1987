# SIRMAN — UPDATE 1405.6.16α Data Management & Phonebook Bulk Delete

**Date:** 1405/06/18 (2026-09-08)  
**Branch:** `cursor/data-management-bulk-delete-fa01`  
**Base branch / product:** `cursor/release-1405-6-16-alpha-fa01` / `1405.6.16α`  
**Source HEAD packaged:** `a4525f6` (implementation already complete; this packet only packages it)  
**Verdict:** **UPDATE READY**

This is an incremental **SIRMAN_UPDATE** inside the same product version. No new installer. No uninstall. No shop-data migration. No version bump. Backup / Recovery / Phonebook Merge / Restore / Print / SQLite / Inventory Core were not reopened.

---

## Version

```text
Base version:     1405.6.16α  (installed kit / release 307c5dd + stamp b5f532c)
Target version:   1405.6.16α  (same; incremental HTML replace)
appFa:            ۱۴۰۵.۶.۱۶α
assembly:         1405.6.16.1  (unchanged)
Package id:       sirman-1405.6.16α-full
minBaseVersion:   1405.5.18ε
magic / format:   SIRMAN_UPDATE / 1
```

`SIRMAN_VERSION.json` was not modified.

---

## Update payload

```text
Path:     deliveries/Sirman_Update_1405.6.16α.json
Size:     1963700 bytes
SHA-256:  bfaf890e71d85cc93b5fcfcf4b86ef8331aacc07654127fc2e1f45b8fbc1c2cf
Sidecar:  deliveries/Sirman_Update_1405.6.16α.sha256
```

Generated only by existing `scripts/write_full_update_json.py` (changelog text updated to describe this incremental packet; protocol unchanged). The packer also refreshes the existing kit copies:

- `updates/Sirman_Update_1405.6.16α.json`
- `Sirman_Pending_Update.json`
- `desktop/Sirman_Install_Kit/…` (pending + updates)
- `desktop/Sirman_Windows_Install/…` (pending + updates)

Those copies are byte-identical to the deliveries JSON (1963700 bytes).

**Not created:** new `setup.exe`, new `Sirman_Setup_*.zip`, SQLite, migration/repair scripts, 2650-clone logic.

---

## Changed application files

The package contains **one** application file:

| Patch op | Target | Role |
|---|---|---|
| `setVersion` | runtime version strings | keep `1405.6.16α` |
| `replaceAppFile` | `Sirman_Final.html` | full current HTML |
| `notify` | UI toast | data-management changelog |

```text
Sirman_Final.html == Laegh_Final.html          YES
Source HTML SHA-256                            6b9420cd2ceb9113c10ed6117fe163e653ae003831c1c35149b00cd7c5d50241
replaceAppFile content SHA-256                 6b9420cd2ceb9113c10ed6117fe163e653ae003831c1c35149b00cd7c5d50241
payload == current Sirman_Final.html           YES
fileName                                       Sirman_Final.html
Baseline 1405.6.16α HTML (b5f532c) SHA-256     71643c78608402fa52073b053b92806d7454b66a20eaf8f378d323b0b2e5d68f
```

UI markers inside the payload (absent from baseline HTML):

- `id="data-mgmt-list"` / `renderDataManagementUI`
- `selectAllPBResults` / `delSelPB`

Top-level JSON keys: `magic, format, id, version, versionFa, minBaseVersion, title, changelog, patches` only.

```text
sirman.sqlite in JSON:              NO
P1 candidate DB:                    NO
shop records / localStorage dump:   NO
IndexedDB dump:                     NO
secrets / API keys:                 NO
unrelated files in patches:         NO
```

---

## How to apply (existing updater only)

**Preferred (installed Windows exe):** put the JSON next to `Sirman.exe` as `Sirman_Pending_Update.json` and start SIRMAN. `UpdateService.ApplyPackageFile` writes `Sirman_Final.html` from `replaceAppFile` and does **not** skip same-version HTML.

**In-app:** Settings → تب ⬆️ آپدیت → «بارگذاری فایل آپدیت». `applyUpdatePackage` stores a slim package record, then `applyFullAppHtmlNow` replaces the running HTML. If this same package `id` was already applied, the existing duplicate prompt asks to reapply.

This update changes **application files only**. It does not clear or migrate:

localStorage business keys · IndexedDB business stores · shop data · invoices · sales · warranties · accounts · inventory · phonebook

`applyUpdatePackage` may write updater metadata only (`laegh_upd_pkg_*`, `laegh_applied_updates`, `laegh_fullapp_ver`). It does not `localStorage.clear`, does not `removeItem` on `lb/li/lp/lv/la/lc`, and does not `indexedDB.deleteDatabase`.

---

## Tests

Exact runs after packing (Linux agent):

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 1159
  ✅ موفق: 1159
  ❌ ناموفق: 0

/home/ubuntu/.dotnet/dotnet test desktop/Sirman.Core.Tests -c Release
  Passed!  Failed: 0, Passed: 859, Skipped: 0, Total: 859

node test_installer_lifecycle.js
  OK 21
```

Existing update-contract tests inside `test_laegh.js` (گروه ε / ι and the `1405.6.16α` packer assertion for `updates/Sirman_Update_{app}.json`) ran as part of the 1159. Tests were not weakened.

The 1159 HTML suite includes DATA RESET 1–23 and PHONEBOOK 24–39.

---

## Update simulation (isolated, synthetic only)

Directory: `/tmp/sirman-update-sim-1405-6-16/install`  
No real shop data.

1. Install baseline `1405.6.16α` HTML from `git show b5f532c:Sirman_Final.html`.
2. Populate synthetic sidecar files: `user_data/localStorage.json` (lb/li/lp/lv/la/lc/tasks/company), `user_data/indexeddb-marker.txt`, `Backups/synthetic-shop-backup.json`.
3. Apply `replaceAppFile` using the same write contract as desktop `UpdateService.ApplyPackageFile`.
4. HTML SHA changed baseline → current (`71643c78…` → `6b9420cd…`).
5. Synthetic sidecar SHA-256 values unchanged (`DATA_PRESERVATION=PASS`).
6. After HTML contains Data Management UI (`data-mgmt-list`, `renderDataManagementUI`).
7. After HTML contains Phonebook bulk-delete UI (`selectAllPBResults`, `delSelPB`).
8. No required sidecar file removed. Extra file: `Sirman_Final_1405.6.16α.html` (existing UpdateService versioned copy).

In-app `validateUpdatePackage` + `applyUpdatePackage({silent:true})` against synthetic localStorage:

```text
validateUpdatePackage OK
fullReplace true, fileName Sirman_Final.html
BUSINESS_DATA_PRESERVED true
unchanged keys: lb, li, lp, lv, la, lc, laegh_tasks, laegh_company, laegh_logo
extra updater keys: laegh_upd_pkg_sirman-1405.6.16α-full, laegh_applied_updates, laegh_fullapp_ver
INAPP_SIM_OK true
```

---

## Known limitations

1. **`apply_sirman_update.ps1` same-version skip.** If installed `Sirman_Final.html` already has `<meta name="app-version" content="1405.6.16α">`, the BAT/PowerShell launcher prints `already at 1405.6.16α — skip` and does not rewrite HTML. This is the existing launcher contract, not a new protocol. Work around it with the desktop exe pending apply or Settings → آپدیت file load. Do not invent a PS1 bypass.
2. **Same package `id`.** `sirman-1405.6.16α-full` matches the original 16α full-update id. In-app duplicate detection may ask «دوباره اعمال شود؟». Confirming reapplies. Desktop `UpdateService` always writes HTML.
3. **Installer kit not rebuilt.** `deliveries/Sirman_Setup_1405.6.16α` remains the original installer. This packet is an update, not a new setup.
4. **Physical print / live shop:** not exercised in this packaging pass.

---

## Git

Single packaging commit message:

`update: data management and phonebook bulk delete`

Unrelated dirty files (`deliveries/migration/P1-services/*`, leftover forensic markdown) were not staged.
