# SIRMAN — VERIFY / DELIVERY KIT `1405.6.16α` (Diagnostic P0–P3)

**Date:** 1405/06/20 (2026-09-11)  
**Packet:** Windows/shop verification kit of current product `1405.6.16α`, including Diagnostic P0–P3  
**Mode:** BUILD / PACKAGE / DOCUMENT ONLY  
**Product code modified:** NO  
**HTML / Core / Desktop / Host modified:** NO  
**Version bump:** NO  
**Known-good kit overwritten:** NO

```text
Source changed during packaging: NO
Product behavior changed:        NO
Print changed:                   NO
Storage / SQLite changed:        NO
Backup / Recovery changed:       NO
Inventory changed:               NO
Version changed:                 NO
```

Shop artifact (take this ZIP to Windows):

```text
deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY.zip
```

Do **not** use `deliveries/Sirman_Setup_1405.6.16α.zip` for this verification. That file is the pre-Diagnostic known-good kit and was left untouched.

---

# 1. PRE-CHECK

Read before packing:

- uploaded `SIRMAN_VERIFY_1405.6.16_DELIVERY_KIT.md`
- uploaded `SIRMAN_AGENT_RULES.md` (not in repo as `docs/SIRMAN_AGENT_RULES.md`)
- `docs/ARCHITECTURE_RULES.md`
- `docs/DEVELOPMENT_GOVERNANCE.md`
- `deliveries/Reports/POST-P3-CURRENT-STATE-RECONCILIATION.md`
- Diagnostic P0–P3 reports
- `deliveries/Reports/RELEASE-PACKAGING-1405.6.16-alpha.md`

```text
Branch:                 cursor/diagnostic-center-p3-ui-fault-fa01
HEAD at pack:           47f7c332e027552d7959bf967e2edfb854cf89f3
Short HEAD:             47f7c33
HEAD message:           docs: reconcile post-P3 current state without starting a new program
P3 product commit:      f5e3ebaf51dd0787d35957b880b8a164a61b4880
P3 is ancestor of HEAD: YES
Product version:        1405.6.16α
Assembly:               1405.6.16.1
Branch switch:          NO
reset/rebase/merge:     NO
cherry-pick:            NO
```

Unrelated dirty worktree (not staged, not this kit):

```text
 M deliveries/migration/P1-services/services.candidate.sqlite
 M deliveries/migration/P1-services/services.sha256
```

Repo packer `scripts/pack_sirman_setup.py` always writes `deliveries/Sirman_Setup_{APP}/` and would destroy the known-good `1405.6.16α` tree. It was **not** run and **not** modified. Pack used a one-off script at `/tmp/pack_sirman_verify_kit.py` (not in repo).

`scripts/write_full_update_json.py` was **not** run. Repo `Sirman_Pending_Update.json` / `updates/Sirman_Update_1405.6.16α.json` still contain pre-P3 HTML. Kit-only pending/update JSON was generated from current `Sirman_Final.html`.

---

# 2. SOURCE CHECKPOINT

Packed HEAD includes Diagnostic P0–P3 plus the post-P3 reconciliation commit:

| Commit | Packet |
|---|---|
| `6fd23e8` | P0 Core JSONL store, Desktop hooks, Host query/export |
| `7f79098` | P1 `RunBusiness` correlation + additive 9-field `diagnostic` |
| `607843d` | P2 `GuidanceCatalog` + native `DiagnosticCenterForm` |
| `f5e3eba` | P3 `ReportUiFault` + 15s `UiFaultDeduper` + thin HTML adapter |
| `47f7c33` | docs: post-P3 current-state reconciliation (HEAD) |

Product sources included in the package (unchanged vs HEAD):

| Path | Role |
|---|---|
| `Sirman_Final.html` | UI (byte-identical to `Laegh_Final.html`) |
| `desktop/Sirman.Desktop/*` | WinForms + WebView2 host (`OpenDiagnosticCenter`, `ReportUiFault`) |
| `desktop/Sirman.Core/*` | Diagnostic store, `ReportUiFault`, guidance |
| `SIRMAN_VERSION.json` | `1405.6.16α` / `1405.6.16.1` |
| installer / lifecycle / launchers | established delivery process |

InformationalVersion in packed PE includes SourceRevisionId `47f7c332e027552d7959bf967e2edfb854cf89f3`. If a shop exe ProductVersion does not contain that SHA, STOP — wrong executable.

---

# 3. VERSION

Unchanged. Diagnostic P0–P3 did not bump version.

| Location | Value |
|---|---|
| `SIRMAN_VERSION.json` `app` | `1405.6.16α` |
| `SIRMAN_VERSION.json` `assembly` | `1405.6.16.1` |
| `SIRMAN_VERSION.json` `date` | `1405/06/16` |
| HTML `<meta name="app-version">` / `APP_VERSION` | `1405.6.16α` |
| HTML `APP_VERSION_FA` | `۱۴۰۵.۶.۱۶α` |
| `desktop/Directory.Build.props` Version / FileVersion | `1405.6.16.1` |
| `desktop/Directory.Build.props` InformationalVersion | `1405.6.16α` |
| Packed PE strings | `1405.6.16.1` and `1405.6.16α` (UTF-16) |
| Packed InformationalVersion | `1405.6.16α+47f7c332e027552d7959bf967e2edfb854cf89f3` |

Wrong-build stop: shop ProductVersion must contain `47f7c332e027552d7959bf967e2edfb854cf89f3`.

---

# 4. PACKAGE CONTENTS

```text
ZIP:       deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY.zip
Sidecar:   deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY.sha256
Extracted: deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY/   (local unpack; shop uses the ZIP)
Size:      73220843 bytes
Entries:   496
sqlite / .git / secrets in names: none
```

Present in ZIP (root prefix `Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY/`):

| Path | Present |
|---|---|
| `نصب.bat` | YES |
| `SETUP.bat` | YES |
| `install-setup.ps1` | YES |
| `sirman-install-contract.json` | YES |
| `Sirman-InstallLifecycle.ps1` | YES |
| `App/Sirman.exe` | YES (152064) |
| `App/Sirman.dll` | YES (223744) |
| `App/Sirman.Core.dll` | YES (410112) |
| `App/WebView2Loader.dll` | YES |
| `App/Sirman_Final.html` | YES (`ReportUiFault` / `reportUiFaultToHost`; no `GuidanceCatalog`) |
| `App/SIRMAN_VERSION.json` | YES (`1405.6.16α`) |
| `App/Sirman_Pending_Update.json` | YES (`ReportUiFault`, version `1405.6.16α`) |
| `App/updates/Sirman_Update_1405.6.16α.json` | YES (same bytes as pending) |
| `updates/Sirman_Update_1405.6.16α.json` | YES (same bytes as pending) |
| `App/Sirman_Start.bat` / `App/OPEN_SIRMAN.bat` / `App/sirman_run.ps1` | YES |
| `App/Uninstall-Sirman.bat` / `App/Uninstall-Sirman.ps1` | YES |
| `App/Sirman-Full-Cleanup.bat` | YES |
| `App/Sirman-InstallLifecycle.ps1` | YES |

PE markers:

| Binary | `ReportUiFault` | `OpenDiagnosticCenter` | `DiagnosticCenterForm` | version SHA |
|---|---|---|---|---|
| `Sirman.Core.dll` | YES | YES | — | YES |
| `Sirman.dll` | YES | YES | YES | YES |
| `Sirman.exe` | — | — | — | YES |

Known-good pre-Diagnostic kit **untouched**:

```text
deliveries/Sirman_Setup_1405.6.16α.zip
SHA-256: 0f66467a5f891facbb2c58f02e145fa6c5bfaf7de01e5d9b13812b0a8908f937
HTML in that kit: 71643c78… (no ReportUiFault)
```

---

# 5. BUILD / PUBLISH

```text
dotnet publish desktop/Sirman.Desktop
  -c Release -r win-x64 --self-contained true
  -p:EnableWindowsTargeting=true
output: /tmp/sirman-fd-publish-p3-verify
Result: OK
Sirman.exe: 152064 bytes
```

Packer: `/tmp/pack_sirman_verify_kit.py` (one-off; repo `scripts/pack_sirman_setup.py` not used).

Desktop `win-x64` self-contained. `WebView2Loader.dll` present.

---

# 6. HASHES

| Item | SHA-256 |
|---|---|
| Shop ZIP | `42f06f5335086cca8102b6a62d9838fcf0000eef90a3a43f76e24150d2530856` |
| Known-good ZIP (untouched) | `0f66467a5f891facbb2c58f02e145fa6c5bfaf7de01e5d9b13812b0a8908f937` |
| Source `Sirman_Final.html` | `cd21964ad11213b9844429ec862eee51473c3ae217f67e809fa396fdd9ff53cf` |
| Source `Laegh_Final.html` | `cd21964ad11213b9844429ec862eee51473c3ae217f67e809fa396fdd9ff53cf` |
| Kit `App/Sirman_Final.html` | `cd21964ad11213b9844429ec862eee51473c3ae217f67e809fa396fdd9ff53cf` |
| Kit `Sirman.exe` | `d82825bd1f907868b49b9ca549ded38a93ff74799733647c218a08ee249b8244` |
| Kit `Sirman.dll` | `63ddbf4a451ced37cdfc3bfe9863f3ef800f03122bdb43b9533469fb4b2b840a` |
| Kit `Sirman.Core.dll` | `aff053f86f142593cdbf5587626ff22869256545bc5bbb89aa6fc28d6efdde57` |
| Kit pending / update JSON | `b1f86375e513a317cedd4a82e4dd69ad0d4a39f1b9c1d5c45b93c401ccf5a9d8` |
| Repo `Sirman_Pending_Update.json` (not rewritten) | `b7fd28fb458322f6a1654f6f495bfb3dad7ffd5faf645773c8fe8ff7c20c3f1a` |
| `SirmanHostObject.cs` | `ee792fc98f6463a92727f0cb3bd4e5872a02618554c75d0881b62e6a0e6ff0ff` |
| `DiagnosticCenterForm.cs` | `ff123189df4fb41beee9932d936a9df8c34d9761a0147a227712ac4fea608944` |
| `UiFaultRecorder.cs` | `28b8a98a089a6d8dc010df36bbf07072479b76ede7857f3a21ef43728a752c2e` |

`Sirman_Final.html` == `Laegh_Final.html` == kit `App/Sirman_Final.html`.

Kit pending JSON ≠ repo pending JSON: expected. Repo source was not rewritten; kit pending is current HTML with `ReportUiFault`.

---

# 7. PRODUCT-CODE-DIFF CHECK

```text
git diff --stat on product paths: empty
git diff --check on product paths: clean (exit 0)
scripts/pack_sirman_setup.py: not modified
scripts/write_full_update_json.py: not run
HTML / Core / Desktop / Host source SHAs: unchanged vs pre-pack
Known-good 1405.6.16α ZIP SHA: unchanged
```

Pre-pack product hashes (`/tmp/prepack-product-hashes.txt`) matched post-pack sources.

If packaging had required a source fix: STOP — BLOCKED. It did not.

---

# 8. TEST / VALIDATION RESULTS

**Automated Linux/cloud validation ≠ Windows/shop verification.**

| Suite | Result |
|---|---|
| `node test_laegh.js Sirman_Final.html` | **1120 / 1120** (0 failed) |
| `dotnet test desktop/Sirman.Core.Tests -c Release` | **907 / 907** (0 failed) |
| `node test_installer_lifecycle.js` | **21 / 21** |
| ZIP entry count / no sqlite-secrets names | 496 / clean |
| Kit HTML contains `ReportUiFault` | YES |
| Kit HTML contains `GuidanceCatalog` | NO (correct; Core-only) |
| Kit pending contains `ReportUiFault` + `1405.6.16α` | YES |
| P3 commit ancestor of HEAD | YES |

WinForms / WebView2 GUI was **not** executed on this Linux agent.

---

# 9. SHOP VERIFICATION PROCEDURE

Install from the **VERIFY** ZIP only. Do not overwrite a known-good shop install until this checklist passes. Do **not** run Full Cleanup / Level-2 `CONFIRM` / `resetAll`. Do **not** restore over live data for this check.

Non-destructive smoke only.

1. **Launch** — extract ZIP, run `نصب.bat` (or `SETUP.bat`), start SIRMAN. Confirm ProductVersion contains `47f7c332e027552d7959bf967e2edfb854cf89f3` and UI version `1405.6.16α`.
2. **WebView2 / UI loads** — main window paints; sidebar and pages are usable. Not a white/blank WebView.
3. **Basic navigation** — open two existing screens (for example دفترچه تلفن and one invoice/list page). No save, no delete, no stock mutation.
4. **Diagnostic Center opens** — menu **راهنما → مرکز گزارش و تشخیص…**. Native WinForms window, not an HTML page.
5. **Controlled UI error → Center / JSONL** — with the exe running, open WebView2 DevTools and in Console run: `throw new Error('shop-verify-ui-fault');` then reopen/refresh the Center. Expect a `SYS-UI-UNSCOPED` row. Do not flood the console; Core dedupes the same fingerprint for 15 seconds.
6. **Guidance + correlationId visible** — select that row. Operator guidance text and a `C-…` correlationId are shown.
7. **Export Diagnostic Report** — use the Center export control. File writes; no crash.
8. **Existing critical workflow smoke** — one read-only pass of a daily screen the shop actually uses (list/search only). No destructive data operation.
9. **Print** — verify **only** if the physical printer is actually attached and paper is loaded. Otherwise skip. Do not treat Microsoft Print to PDF as shop print success.
10. **Stop** — close the Center and the app. Do not uninstall as part of this checklist.

Pass the kit only if steps 1–8 succeed on the real Windows shop PC.

---

# 10. KNOWN LIMITATIONS

- Linux/cloud automated tests are **not** shop verification.
- WinForms Diagnostic Center and `window.onerror` → JSONL were not GUI-verified on Windows in this packet.
- UI fault codes remain unscoped `SYS-UI-UNSCOPED`.
- HTML-only (no exe) still has no disk diagnostic store.
- Full JS stack is hashed, not stored.
- Dedup is process-local (resets on restart).
- Listeners register after HTML load / successful navigation; parse-time errors before that can still be missed.
- Repo `Sirman_Pending_Update.json` is still pre-P3 HTML; only the kit pending/update JSON carries `ReportUiFault`. Do not run in-app update from the old repo JSON expecting P3.
- Print physical verification **NOT VERIFIED** unless the shop printer is present.
- SQLite is **not** canonical SoT.
- Phase 3 B-migration remains COMPLETE (last B product `1fcf054`). Tracker version `1405.5.27γ` is stale. No B21.

---

# 11. ROLLBACK

If shop verification fails, do **not** keep this VERIFY kit as the live install.

| Rollback to | Path | SHA-256 |
|---|---|---|
| Last shipped `1405.6.16α` (pre-Diagnostic P0–P3) | `deliveries/Sirman_Setup_1405.6.16α.zip` | `0f66467a5f891facbb2c58f02e145fa6c5bfaf7de01e5d9b13812b0a8908f937` |

That known-good ZIP was not deleted or overwritten.

Git rollback of this packaging commit does not require reverting `f5e3eba`; this commit adds kit + report only.

---

# 12. FINAL STATUS

| Item | Value |
|---|---|
| Packet | VERIFY / DELIVERY KIT `1405.6.16α` + Diagnostic P0–P3 |
| Product code / HTML / Core / Desktop | unchanged |
| Version | `1405.6.16α` / `1405.6.16.1` |
| HEAD packed | `47f7c33` (contains `f5e3eba`) |
| Shop ZIP | `deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY.zip` |
| ZIP SHA-256 | `42f06f5335086cca8102b6a62d9838fcf0000eef90a3a43f76e24150d2530856` |
| Linux automated tests | HTML 1120, Core 907, installer 21 — all pass |
| Windows / shop GUI | **NOT PERFORMED** |
| Checkpoint | **YELLOW** |

**YELLOW** because the kit is packed from the correct HEAD, hashes match, and Linux suites are green, but shop Windows + WebView2 verification is still **NEEDS HUMAN VERIFICATION**.

**STOP.** Package + report complete. No next architecture or implementation packet started.
