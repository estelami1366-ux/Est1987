# SIRMAN — NATIVE UPDATE ARCHITECTURE CHANGE GATE

**Date:** 1405/06/21 (2026-09-12)
**Packet:** DESIGN ONLY — native-only update architecture
**Product code modified:** NO
**HTML / Core / Desktop / updater modified:** NO
**Package generated:** NO
**Installed:** NO
**Version bump:** NO

```text
FINAL DECISION: NATIVE UPDATE ARCHITECTURE READY FOR IMPLEMENTATION
Separate native updater executable required: YES (for apply; not for P0)
HTML excluded from native create / validate / apply: YES
First implementation packet: NATIVE-UPDATE-P0-CONTRACT
This packet implemented that architecture: NO
```

Authority: live source + `deliveries/Reports/NATIVE-ONLY-UPDATE-1405.6.16α.md`. Candidate pipeline was checked against Windows PE lock and current install layout; it is accepted with journal-in-AppData and allow-listed files (not a blind directory swap).

---

# 1. CURRENT UPDATE ARCHITECTURE

Two launch paths exist. Native update applies only to the exe path.

```text
A) HTML-only / launcher
   Sirman_Start.bat
     → apply_sirman_update.ps1   (writes Sirman_Final.html)
     → sirman_run.ps1            (HTTP UI on loopback)

B) Desktop exe
   Sirman.exe
     → MainForm startup: UpdateService.TryApplyPendingOnStartup(htmlTarget)
     → menu «اعمال آپدیت در انتظار» / file picker
     → UpdateService.ApplyPackageFile(package, targetHtmlPath)
     → reload HTML in WebView2
```

Package format today: `magic: "SIRMAN_UPDATE"`, `format: 1`, patches `setVersion` / `injectCss` / `runJs` / `replaceFn` / `replaceAppFile` / `notify`.

Assembler: `scripts/write_full_update_json.py` reads `Sirman_Final.html` and embeds it.

Discovery: `Sirman_Pending_Update.json` beside the exe, or `updates/Sirman_Update_*.json` whose first 64 KiB contains `replaceAppFile` or `fullHtml`.

Install of binaries is a **different** path: Setup kit (`نصب.bat` / `install-setup.ps1` / `InstallService`) copies the whole `App\` tree, and **requires** a large `Sirman_Final.html`. Default install dir is `%LocalAppData%\Sirman\App` (`AppPaths.DefaultInstallDir`). Custom `InstallDir` may be elsewhere.

There is no native file-copy update, no updater exe, no SHA-256 manifest of binaries, no journal for partial native replace.

---

# 2. PROVEN HTML COUPLING

Answers required questions 1–2.

**Where:**

| Layer | Coupling |
|---|---|
| Assembler | `write_full_update_json.py` exits if HTML is small or version string missing; payload is `replaceAppFile` of `Sirman_Final.html` |
| PS1 apply | `apply_sirman_update.ps1` extracts HTML only; no HTML → skip |
| Desktop apply | `UpdateService` comment: apply onto HTML beside the app; no HTML → `Applied=false` |
| Auto-find | requires `replaceAppFile` / `fullHtml` in file head |
| In-app tab | HTML `validateUpdatePackage` / `applyUpdatePatches` — CSS/JS/HTML only |
| Tests / docs | `test_laegh.js` and `updates/README.md` require HTML replace for a “full” update |
| Setup | `install-setup.ps1` refuses if HTML missing or &lt; 500000 bytes |

**Who discovers / validates / applies:**

- Discover: `UpdateService.FindPendingPackage`, `apply_sirman_update.ps1` `Get-PendingUpdatePath`, HTML Settings → آپدیت file picker
- Validate: HTML `validateUpdatePackage` (magic / format / id / version / minBaseVersion vs `APP_BASE_VERSION`); Desktop checks magic then **requires HTML body**
- Apply: HTML JS (IndexedDB + rewrite), PS1 `WriteAllText` to `.html`, Desktop `File.WriteAllText` to `.html`

None of these copy `Sirman.exe` / `Sirman.dll` / `Sirman.Core.dll`.

---

# 3. NATIVE UPDATE REQUIREMENTS

Answers questions 4–6, 9–10 (requirements, not implementation).

Must:

- Replace allow-listed native files next to the running install (`AppPaths.ExeDir` / recorded `InstallDir`)
- Never require HTML as assembler input, validator input, or payload entry
- Never write `Sirman_Final.html` / `Laegh_Final.html` / `Sirman_Final_*.html`
- Never put copy logic in HTML/JS
- Validate SHA-256 of every payload file before any replace
- Not overwrite files while `Sirman.exe` still has them mapped
- Survive crash mid-copy (journal + rollback)
- Keep existing `SIRMAN_UPDATE` HTML channel unchanged
- Leave Backup / Print / Inventory / SQLite **data** and frozen print engines untouched
- Fail closed on hash mismatch, unexpected path (`..`), HTML path, or unwritable install dir

Replaceable (allow-list ∩ payload ∩ install-contract **owned** native names), typical minimum for a Desktop/Core fix such as Diagnostic P2/P3:

- `Sirman.exe`
- `Sirman.dll`
- `Sirman.Core.dll`
- `Sirman.deps.json`, `Sirman.runtimeconfig.json` if the publish graph changed
- `WebView2Loader.dll` only if the publish set changed it
- other owned runtime PE (`coreclr.dll`, `System.*`, `runtimes/`) only when the payload lists them

Never replace:

- `Sirman_Final.html`, `Laegh_Final.html`, versioned HTML copies
- `%LocalAppData%\Sirman` data: WebView2 profile, Backups, print JSONL, diagnostics JSONL, `desktop-settings.json`, `install-location.txt`
- `sirman_media` / user files
- any `*.sqlite` shop/candidate DB
- uninstall / lifecycle scripts unless explicitly listed (default: no)

VERIFY kit inventory at this checkpoint: 3 HTML files + 484 other files under `App\`. A native payload may be a **subset**; it is not required to ship all 484 every time.

HTML-only installs (BAT, no exe) cannot consume a native payload. That is correct, not a defect.

---

# 4. ARCHITECTURE OPTIONS

Answer question 3.

| Option | What | Verdict |
|---|---|---|
| A. Extend in-process `UpdateService` to copy DLLs | Same process holds `Sirman.dll` / `Sirman.Core.dll` mapped | **Reject.** Windows will not safely replace loaded PE. Still sits on the HTML apply type. |
| B. Teach `apply_sirman_update.ps1` to copy binaries | Could run before exe start | **Reject for the mechanism.** Mixes channels, HTML-named script, no journal, weak integrity, still not a dedicated bootstrap. |
| C. Separate native channel: manifest + staging + `SirmanUpdater.exe` after process exit | Matches candidate; updater not loaded from files it overwrites | **Select.** |
| D. Setup kit only (`install-setup.ps1`) | Already copies native files | **Not an update.** Requires HTML, copies whole App, not SHA-256 native manifest. Keep as install/rollback of last resort. |
| E. MSIX / ClickOnce / Squirrel | New installer stack | **Reject.** Out of scope; would replace shop install contract. |

Extending the current updater “a little” is not safe. A **separate** native updater/bootstrap process is required for apply. Validation/assembly can live in Core **before** that exe exists (P0).

---

# 5. SELECTED OPTION

Candidate, refined:

```text
USB / file drop
  Sirman_Native_Update_{version}/
    manifest.json          magic SIRMAN_NATIVE_UPDATE
    files/...              allow-listed relative paths only
→ running Sirman.exe OR a future CLI
    validate magic, version, paths, SHA-256
    copy payload → %LocalAppData%\Sirman\native-staging\{id}\
    write journal (AppData, not inside App\)
    spawn SirmanUpdater.exe FROM STAGING (copy of updater, not the to-be-replaced tree)
    exit Sirman.exe
→ SirmanUpdater.exe
    wait until process Sirman has exited (reuse contract processStop names)
    snapshot current App\ native files → native-backup\{id}\
    replace allow-listed files from staging
    write SIRMAN_VERSION.json from manifest (native fields only)
    health-check (hashes + assembly version)
    mark journal committed
    start Sirman.exe
→ on failure
    restore native-backup\{id}\
    mark journal rolled-back
    do not launch broken tree if restore fails
```

UI/JS does not copy files. A later Host method may only **schedule** a already-validated staging folder (allow-list addition). P0 has no Host method.

`SIRMAN_UPDATE` / `UpdateService` / `apply_sirman_update.ps1` stay as they are.

---

# 6. UPDATE PACKAGE CONTRACT

Draft contract (not implemented):

```json
{
  "magic": "SIRMAN_NATIVE_UPDATE",
  "format": 1,
  "id": "sirman-native-1405.6.16α-p3",
  "version": "1405.6.16α",
  "assembly": "1405.6.16.1",
  "minAssembly": "1405.6.16.1",
  "maxAssembly": "1405.6.16.1",
  "payloadKind": "native-only",
  "replacesHtml": false,
  "files": [
    { "path": "Sirman.exe", "sha256": "...", "bytes": 152064 },
    { "path": "Sirman.dll", "sha256": "...", "bytes": 223744 },
    { "path": "Sirman.Core.dll", "sha256": "...", "bytes": 410112 }
  ]
}
```

Rules:

- `magic` must not be `SIRMAN_UPDATE`
- `replacesHtml` must be false; validator rejects any `files[].path` matching `*.html`, `*.htm`, `Sirman_Final*`, `Laegh_Final*`
- paths relative, no `..`, no absolute roots, no AppData
- assembler: `dotnet publish` Desktop, hash files, write manifest — **must not open** `Sirman_Final.html` / `Laegh_Final.html` / `test_laegh.js`
- optional `expectedHtmlVersion` is advisory only; apply must not fail or rewrite HTML if it differs
- version check: compare `SIRMAN_VERSION.json` `assembly` (and PE InformationalVersion) to `minAssembly` / `maxAssembly`; refuse downgrade unless `allowDowngrade: true` (default false)
- idempotent: if every listed SHA already matches install, skip replace

Existing HTML `compareSirmanVersions` stays on the HTML channel only.

---

# 7. WINDOWS REPLACEMENT STRATEGY

Answer question 6.

Facts:

- `Sirman.exe` loads `Sirman.dll` and `Sirman.Core.dll`. In-process overwrite is unsafe.
- Default install `%LocalAppData%\Sirman\App` is user-writable → no UAC for the common shop path.
- Custom `InstallDir` under Program Files may deny write → fail closed with a Persian message; do not silent-elevate in v1.
- True atomic directory rename is not reliable across volumes on Windows.

Strategy:

1. Stage complete payload and re-hash.
2. Copy `SirmanUpdater.exe` into staging so replace does not delete the running updater.
3. Close Sirman (user confirm; then `CloseApp` / process wait from install-contract `processNames: ["Sirman"]`).
4. File-by-file: existing → `native-backup\{id}\`, then staging → install.
5. Do not delete extra runtime files not in the payload (subset update).
6. After hashes match, launch `Sirman.exe` from `ExeDir`.
7. If install dir is not writable, stop before any rename.

Rename-while-running tricks are not the design. Wait for exit.

---

# 8. ROLLBACK / RECOVERY

Answers questions 7–8.

Journal path (outside `App\`):

`%LocalAppData%\Sirman\native-update-journal.json`

States: `staged` → `replacing` → `verifying` → `committed` | `rolling-back` | `rolled-back` | `failed`.

On next Sirman or updater start:

- `staged` with no replace: ignore / clean staging
- `replacing` or `verifying` or `failed`: restore `native-backup\{id}` onto `App\`, re-hash, then `rolled-back`
- `committed`: delete staging/backup after a successful launch (keep last backup until next native update)

Backup of HTML inside `UpdateService` (`Sirman_Final_before_*`) is **not** used. Native rollback restores PE only.

Interrupted copy is detected solely from the journal, not from HTML magic.

---

# 9. SECURITY / INTEGRITY

Answer question 5.

- SHA-256 per file; fail closed on mismatch (same spirit as backup P1C-7, different package)
- Reject HTML and path escape
- Do not execute `runJs` / `injectCss` from a native package
- v1: no Authenticode requirement (today’s HTML JSON is also unsigned USB drop). Hash is the integrity gate.
- Do not load payload DLLs for validation; hash bytes on disk
- Updater must not follow `sirmanHost` from JS to copy files
- New Host methods, if ever added, go on `sirmanHost` allow-list — **not** a parallel REST API (architecture §4.1)

---

# 10. TRANSITION FROM CURRENT UPDATER

Answer question 11.

Keep both. Do not delete `SIRMAN_UPDATE`.

| Channel | File names | Apply |
|---|---|---|
| HTML (unchanged) | `Sirman_Pending_Update.json`, `Sirman_Update_*.json` | `UpdateService` / PS1 / Settings tab |
| Native (new) | `Sirman_Native_Update_*.json` + `files/` or zip | Core validator + `SirmanUpdater.exe` |

`FindPendingPackage` already ignores JSON without HTML markers, so a native manifest beside the exe will not be eaten by the HTML applier.

Mass-deploy story later: drop native folder next to exe, shop runs Sirman once to stage, or run `SirmanUpdater.exe --apply` when Sirman is closed. Do not overload `Sirman_Start.bat` in P0.

HTML-only PCs stay on JSON HTML updates / Setup kit.

---

# 11. MINIMUM IMPLEMENTATION SEQUENCE

Answer question 12. **Do not implement in this packet.**

| Packet | Scope | Out |
|---|---|---|
| **NATIVE-UPDATE-P0-CONTRACT** (first) | Manifest schema; Core parse + SHA-256 + path/HTML rejection; assembler script from `dotnet publish` that never reads HTML; Core tests | No updater exe, no file replace, no Host method, no HTML, no Setup change, no version bump |
| P1 | `SirmanUpdater.exe` apply-from-staging when Sirman is not running; journal; backup/restore of listed files | No in-app UI |
| P2 | Desktop: validate → stage → spawn updater → exit; writable-dir check | No JS copy |
| P3 | Health-check + auto rollback on failed hashes; shop Windows verification | No Print/Backup/SQLite work |

Exact first implementation packet:

**NATIVE-UPDATE-P0-CONTRACT** — Core contract + tests + HTML-free assembler. No apply.

---

# 12. RISKS

- Shop copies a native payload onto an HTML-only BAT install: must no-op with a clear message.
- Subset payload leaving mixed runtime: allowed only if `deps.json`/runtime files are hashed when they change; P0 tests must reject incomplete graphs when `Sirman.deps.json` is listed but missing.
- AV locking PE after exit: retry with the existing install-contract retry/delay pattern; then fail closed.
- Custom Program Files install: v1 fail closed (no UAC). Setup kit remains the path there.
- Native P3 without HTML P3 adapter: on-disk HTML unchanged by design; Desktop inject can still observe UI faults. Do not “fix” that by stuffing HTML into the native payload.
- Parallel-system pressure vs architecture “don’t duplicate”: this is a second **update channel**, not a second Host/database. Document in `ARCHITECTURE_RULES.md` only when P0 lands — not in this design packet.
- Self-contained ~484 files: full-tree native zips are large; prefer subset when runtime is unchanged.

---

# 13. HUMAN VERIFICATION

Not done (design only; nothing to install).

Later shop checks (P1+):

1. HTML `SIRMAN_UPDATE` still applies and does not touch exe/dll
2. Native payload with no HTML applies PE hashes
3. Running Sirman cannot be half-replaced; updater waits for exit
4. Kill updater mid-copy → next start rolls back
5. HTML files byte-identical before/after native apply
6. Print/Backup/Inventory smoke unchanged
7. Physical print only if a printer exists

Linux ≠ shop.

---

# 14. FINAL DECISION

| Question | Decision |
|---|---|
| 1. HTML coupling | Assembler, PS1, `UpdateService`, in-app JS, tests, Setup HTML size gate |
| 2. Discover / validate / apply | `FindPendingPackage` + HTML `validateUpdatePackage` + PS1/Desktop HTML write |
| 3. Extend vs separate | **Separate native updater/bootstrap required for apply** |
| 4. Replaceable files | Allow-listed native PE/config; never HTML or shop data |
| 5. Integrity | SHA-256 per file; fail closed |
| 6. Running EXE/DLL | Stage → exit Sirman → `SirmanUpdater.exe` from staging |
| 7. Rollback | AppData journal + `native-backup\{id}` |
| 8. Partial update | Journal states; restore backup |
| 9. Version | `assembly` / `minAssembly` / `maxAssembly` vs `SIRMAN_VERSION.json`; HTML version advisory |
| 10. HTML absent | **YES** for native create, validate, apply |
| 11. Coexistence | Keep `SIRMAN_UPDATE`; new magic and file names |
| 12. Smallest sequence | **NATIVE-UPDATE-P0-CONTRACT** only |

**Separate native updater executable required:** YES for apply (P1). Not in P0.

**HTML can be completely excluded from native update creation, validation, and application:** YES.

**Exact first implementation packet (not started):** `NATIVE-UPDATE-P0-CONTRACT`.

```text
FINAL DECISION: NATIVE UPDATE ARCHITECTURE READY FOR IMPLEMENTATION
```

Not BLOCKED: the HTML updater stays; native is a new channel with a known Windows apply strategy.

Not PARITY/DESIGN GAP: remaining work is implementation packets, not missing design to choose an option.

**STOP.** Architecture not implemented. No next packet started.
