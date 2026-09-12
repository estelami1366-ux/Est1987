# SIRMAN — NATIVE-ONLY UPDATE `1405.6.16α`

**Date:** 1405/06/21 (2026-09-12)
**Packet:** NATIVE-ONLY UPDATE DELIVERY through the **existing** update mechanism
**Mode:** ANALYZE → STOP (no updater architecture change)
**Product code modified:** NO
**HTML / Core / Desktop / Host modified:** NO
**Updater modified:** NO
**Version bump:** NO
**Package assembled:** NO
**Installed on shop:** NO

```text
FINAL STATUS:  BLOCKED — updater is HTML-coupled
Shop GUI:      NEEDS HUMAN VERIFICATION (not reached; no payload to install)
Native-only update ready: NO
```

This packet does **not** claim the application is HTML-independent. HTML remains the UI. The question was only: can the **existing** updater deliver a native-only payload. It cannot, safely.

---

# 1. PRE-CHECK

Read:

- uploaded `SIRMAN_NATIVE_ONLY_UPDATE_1405.6.16A`
- uploaded `SIRMAN_AGENT_RULES.md` (not in repo as `docs/SIRMAN_AGENT_RULES.md`)
- `docs/ARCHITECTURE_RULES.md` §4.1 (UI remains `Sirman_Final.html` in WebView2)
- `docs/DEVELOPMENT_GOVERNANCE.md`
- `.agents/skills/laegh-software-workflow/SKILL.md` قانون ۱۱ (مرکز آپدیت)
- `updates/README.md`
- Diagnostic P0–P3 reports + `deliveries/Reports/VERIFY-1405.6.16α-DELIVERY-KIT.md`

```text
Branch:                 cursor/diagnostic-center-p3-ui-fault-fa01
HEAD:                   335c207f2625d8492363c0258b1c9d9e5ccb7baf
Short:                  335c207
HEAD message:           docs: add 1405.6.16α Diagnostic P3 shop verification kit
P3 product commit:      f5e3ebaf51dd0787d35957b880b8a164a61b4880
P3 is ancestor of HEAD: YES
Product version:        1405.6.16α
Assembly:               1405.6.16.1
Branch switch:          NO
reset/rebase/merge:     NO
cherry-pick:            NO
```

Unrelated dirty (not staged):

```text
 M deliveries/migration/P1-services/services.candidate.sqlite
 M deliveries/migration/P1-services/services.sha256
?? deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY/   (local unpack of prior VERIFY ZIP)
```

Authoritative product version: `SIRMAN_VERSION.json` → `1405.6.16α` / `1405.6.16.1`.

Latest approved checkpoint that contains Diagnostic P0–P3: HEAD `335c207` (product P3 at `f5e3eba`, plus reconciliation `47f7c33`, plus VERIFY kit docs/ZIP). Native binaries for that checkpoint already exist in `deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY.zip`. That is a **Setup kit**, not an update payload.

---

# 2. SOURCE CHECKPOINT

| Commit | What |
|---|---|
| `6fd23e8` | Diagnostic P0 |
| `7f79098` | Diagnostic P1 |
| `607843d` | Diagnostic P2 (`DiagnosticCenterForm`, `OpenDiagnosticCenter`) |
| `f5e3eba` | Diagnostic P3 (`ReportUiFault` Core + thin HTML adapter) |
| `47f7c33` | post-P3 reconciliation (docs) |
| `335c207` | VERIFY Setup kit + report (HEAD) |

Native files that **would** need replacing to put P2/P3 Desktop/Core on an already-installed exe (without touching HTML on disk):

- `Sirman.exe`
- `Sirman.dll` (WinForms host, `UpdateService`, `DiagnosticCenterForm`, Host inject)
- `Sirman.Core.dll` (`ReportUiFault`, JSONL store, guidance)
- self-contained runtime / `Sirman.deps.json` / `Sirman.runtimeconfig.json` as published
- `WebView2Loader.dll` if the publish set changed it

The existing updater never copies any of those files.

P3 also added `reportUiFaultToHost` in HTML. A native-only payload would leave on-disk HTML unchanged by design. Desktop inject can still hook `window.onerror` after navigation, but that is **not** a reason to invent a new updater in this packet.

---

# 3. VERSION

Unchanged. No bump.

| Location | Value |
|---|---|
| `SIRMAN_VERSION.json` `app` | `1405.6.16α` |
| `SIRMAN_VERSION.json` `assembly` | `1405.6.16.1` |
| HTML `APP_VERSION` | `1405.6.16α` |
| `desktop/Directory.Build.props` | `1405.6.16.1` / Informational `1405.6.16α` |

---

# 4. UPDATE FORMAT

Established format (`updates/README.md`, قانون ۱۱, `scripts/write_full_update_json.py`):

```json
{
  "magic": "SIRMAN_UPDATE",
  "format": 1,
  "id": "...",
  "version": "1405.6.16α",
  "minBaseVersion": "1405.5.18ε",
  "patches": [
    { "op": "setVersion" },
    { "op": "injectCss" },
    { "op": "runJs" },
    { "op": "replaceFn" },
    { "op": "replaceAppFile", "fileName": "Sirman_Final.html", "content": "<!DOCTYPE html>..." },
    { "op": "notify" }
  ]
}
```

Supported patch ops in HTML `applyUpdatePatches`: `setVersion`, `injectCss`, `runJs`, `replaceFn`, `notify`, `replaceAppFile` / `fullHtml`.

There is **no** op for `Sirman.exe`, `Sirman.dll`, `Sirman.Core.dll`, or any native file list + SHA-256.

Apply paths (all HTML-targeted):

| Path | Behavior if payload has no HTML |
|---|---|
| HTML Settings → آپدیت (`validateUpdatePackage` / `applyUpdatePackage`) | Validates magic/version only; apply stores JSON and runs JS/CSS patches; `replaceAppFile` writes HTML. No binary copy. |
| `apply_sirman_update.ps1` | Searches for `replaceAppFile` / `fullHtml`. If none: **exit 0, skip** — “Update has no full HTML payload”. |
| `Sirman.Desktop.UpdateService` | Same. If no HTML: **Applied=false** — “این آپدیت HTML کامل ندارد (فقط پچ کوچک).” Auto-discover **requires** `replaceAppFile` or `fullHtml` in the first 64 KiB. |

Assembler `scripts/write_full_update_json.py` **reads `Sirman_Final.html` as a required input**, refuses if HTML is too small or version string missing, and writes `replaceAppFile` with the full HTML into six JSON targets.

`test_laegh.js` asserts full updates contain `replaceAppFile` with `<!DOCTYPE html`.

---

# 5. NATIVE PAYLOAD CONTENTS

**None assembled.**

A native-only `SIRMAN_UPDATE` JSON (magic + version + changelog, no `replaceAppFile`) would be skipped by PowerShell and rejected as “no full HTML” by Desktop `UpdateService`. HTML-side apply would not copy binaries.

Inventing a parallel ZIP of DLLs/exe and calling it an “update package” would **not** use the established update mechanism. That is a new architecture. This packet forbids that.

How native files actually reach a PC today: **full Setup kit** (`نصب.bat` / `install-setup.ps1` / `pack_sirman_setup.py`), which also copies `Sirman_Final.html`. The VERIFY kit already does that:

```text
deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY.zip
SHA-256: 42f06f5335086cca8102b6a62d9838fcf0000eef90a3a43f76e24150d2530856
```

That kit is not a native-only update payload.

---

# 6. HTML INDEPENDENCE CHECK

| Requirement | Result |
|---|---|
| Payload contains no HTML file | N/A — no payload |
| Payload contains no HTML-derived artifact | N/A |
| Assembler does not read `Sirman_Final.html` / `Laegh_Final.html` / `test_laegh.js` | **FAIL** — `write_full_update_json.py` requires `Sirman_Final.html` |
| Validation does not require HTML hash/content | **FAIL** — `apply_sirman_update.ps1` and `UpdateService` require HTML content to apply; auto-find requires `replaceAppFile`/`fullHtml` |
| Updater can copy native Desktop/Core without HTML | **FAIL** — no such op or file-copy path |
| Existing tests allow a non-HTML full update | **FAIL** — `test_laegh.js` requires `replaceAppFile` + doctype |

Exact coupling (do not “work around” in this packet):

1. **Assembler input:** `scripts/write_full_update_json.py` opens `Sirman_Final.html`.
2. **Payload body:** established full update is the HTML file embedded as JSON `content`.
3. **PS1 apply:** writes only `Sirman_Final.html` (and `Sirman_Final_{version}.html`).
4. **Desktop apply:** `UpdateService` class comment: “اعمال بسته SIRMAN_UPDATE روی فایل HTML کنار برنامه”. Target argument is `targetHtmlPath`. Result field is `HtmlPath`.
5. **In-app apply:** JS patches CSS/JS/HTML; `replaceAppFile` fileName defaults to `Sirman_Final.html`.
6. **Discovery:** pending search ignores JSON that lacks HTML markers.
7. **Tests / docs:** قانون ۱۱ and `updates/README.md` define the update as HTML/CSS/JS patch or full HTML replace.

---

# 7. HASH / INTEGRITY

No native-only update SHA-256 manifest exists, because no payload was built.

Updater-path hashes at HEAD (unchanged by this packet):

| File | SHA-256 |
|---|---|
| `apply_sirman_update.ps1` | `bc7188c3e632e2f110223c0e0daecfcf4b280a9288226d3a19fd1352fed703ac` |
| `scripts/write_full_update_json.py` | `246be69d0626792782cee1ae3225f1d04887302c7d7885ccbcaf69542c6859e0` |
| `desktop/Sirman.Desktop/UpdateService.cs` | `494ac57b29918b97c77252fa54d0b3eb672c3fcc63a436e2813efab5a08b4dfc` |
| `updates/README.md` | `70c962c18019e8b533677ead6cf08d421ed43c0b106af44349f6894baad0f8f5` |
| `SIRMAN_VERSION.json` | `3ba12e732d5c7e784192a2d6b1f40005983fc0bd32a83df51c2749f783d63d82` |

Existing **HTML** update JSON (not native-only; contains `replaceAppFile`):

```text
updates/Sirman_Update_1405.6.16α.json
repo pending: Sirman_Pending_Update.json
```

Repo pending JSON is still pre-P3 HTML (not rewritten in the VERIFY packet). Kit pending inside the VERIFY ZIP is current HTML. Neither is a native-only payload.

---

# 8. BUILD / VALIDATION

```text
scripts/write_full_update_json.py     NOT RUN (would embed HTML and rewrite source JSON)
dotnet publish                        NOT RUN for a native-only update (no apply path)
New ZIP / JSON payload                NOT CREATED
git diff --check (product paths)      clean
product-code diff                     none (report only)
```

A publish of Desktop/Core already exists inside the VERIFY Setup kit. Publishing again would not make `UpdateService` copy those binaries.

`git diff --check` on this report after add: expected clean.

---

# 9. ROLLBACK

No new update was applied. Nothing to roll back on shop.

If a future native updater is designed, rollback would need **binary** restore (exe/dll), not the current HTML-only backup in `UpdateService` (`Sirman_Final_before_{version}_{stamp}.html`).

Current shop rollback for a full install remains the known-good / VERIFY Setup ZIPs — those are not native-only updates.

| Artifact | Role |
|---|---|
| `deliveries/Sirman_Setup_1405.6.16α.zip` | last shipped pre-Diagnostic Setup (HTML SHA `71643c78…`) |
| `deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY.zip` | Setup including Diagnostic P0–P3 native **and** HTML |

---

# 10. BLOCKERS / LIMITATIONS

**Blocker (this packet):** the existing updater is intrinsically coupled to HTML. A native-only payload cannot be created, validated, or applied through that mechanism without changing updater architecture. Packet instruction: STOP — do not modify the updater.

**Separate architecture decision required (not taken here):**

1. New package magic/format (not `SIRMAN_UPDATE` format 1 HTML patches), e.g. a native file manifest with per-file SHA-256.
2. Assembler that publishes Desktop/Core and hashes binaries **without** reading HTML / `test_laegh.js`.
3. Apply path (Desktop and/or PS1) that copies/replaces `Sirman.exe` / `Sirman.dll` / `Sirman.Core.dll` / runtime **without** writing `Sirman_Final.html`.
4. Discovery that does not require `replaceAppFile` / `fullHtml`.
5. Validation independent of HTML hash.
6. Binary rollback (not HTML backup).
7. Tests that do not require `replaceAppFile` + `<!DOCTYPE html`.
8. Explicit product decision: HTML on disk stays; in-app “آپدیت” tab either ignores native packages or gains a second, isolated native channel — not a silent overload of `SIRMAN_UPDATE`.
9. Compatibility: HTML-only (no exe) installs cannot consume a native payload; exe installs with older HTML remain the UI.

Until that decision exists, native Desktop/Core reaches shop only via **Setup kit**, which includes HTML.

**Not blockers, but out of scope:** Print frozen, Backup closed, SQLite not SoT, no B21, no version bump.

---

# 11. FINAL STATUS

| Item | Value |
|---|---|
| Packet | Native-only update via existing mechanism |
| Native-only update ready | **NO** |
| Blocked | **YES — updater is HTML-coupled** |
| Needs human verification | YES (shop apply not possible; no payload) |
| Product / HTML / Core / updater source | unchanged |
| Version | `1405.6.16α` / `1405.6.16.1` |
| Payload | none |
| Next packet started | NO |

**BLOCKED — updater is HTML-coupled.**

**STOP.** Report only. Not installed. No architecture packet started.
