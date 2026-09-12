# SIRMAN — NATIVE UPDATE P0 CONTRACT

**Date:** 1405/06/21 (2026-09-12)
**Packet:** NATIVE-UPDATE-P0-CONTRACT
**Product version:** `1405.6.16α` / assembly `1405.6.16.1` (unchanged)
**Apply / SirmanUpdater.exe:** NOT implemented
**HTML / SIRMAN_UPDATE:** unchanged

```text
FINAL STATUS: COMPLETED
NEXT STEP: NATIVE-UPDATE-P1-APPLY (NOT implemented in this packet)
```

---

# 1. PRE-CHECK

Read: uploaded P0 packet, `docs/ARCHITECTURE_RULES.md`, `docs/DEVELOPMENT_GOVERNANCE.md`, `docs/PHASE_3_CHANGE_GATE.md`, `deliveries/Reports/NATIVE-UPDATE-ARCHITECTURE-CHANGE-GATE.md`.

```text
Branch:                 cursor/diagnostic-center-p3-ui-fault-fa01
HEAD before this packet: b64fd10
P3 ancestor:            f5e3eba YES
Branch switch:          NO
reset/rebase/merge:     NO
Version bump:           NO
```

Phase 3 change gate (this packet):

```text
Requested change: native-only update contract (manifest + validate + assemble)
Classification:   infrastructure / update contract
Layer:            Core (new Sirman.Core/Updates)
HTML:             NO
Host methods:     NO
RunBusiness:      NO
Print:            NO
Backup algorithms: NO
SQLite/storage:   NO
Inventory:        NO
SIRMAN_UPDATE:    NO (not modified)
Apply/replace PE: NO
Gate:             PASS
```

Unrelated dirty leftovers (not staged): `deliveries/migration/P1-services/*` and local VERIFY unpack directory.

---

# 2. CONTRACT

New Core types under `desktop/Sirman.Core/Updates/`:

| Type | Role |
|---|---|
| `NativeUpdateManifest` / `NativeUpdateFileEntry` | Versioned package identity + file list |
| `NativeUpdateAllowList` | Path / HTML / allow-list rules |
| `NativeUpdateHasher` | SHA-256 of file bytes (lowercase hex) |
| `NativeUpdateValidator` | Fail-closed parse + integrity from package directory alone |
| `NativeUpdateAssembler` | Create package from a publish/App folder without reading HTML |

CLI assembler: `scripts/assemble_sirman_native_update.py` (does not open `*.html` / `test_laegh.js`).

Package layout:

```text
<package>/
  manifest.json
  files/
    Sirman.exe
    Sirman.dll
    ...
```

Validation does not need `Sirman_Final.html`. Creation does not take HTML as an input artifact.

P1 (`SirmanUpdater.exe`, journal, file replace) is not in this layer.

---

# 3. MANIFEST FORMAT

```json
{
  "magic": "SIRMAN_NATIVE_UPDATE",
  "format": 1,
  "id": "sirman-native-1405.6.16α-p0",
  "version": "1405.6.16α",
  "assembly": "1405.6.16.1",
  "minAssembly": "1405.6.16.1",
  "maxAssembly": "1405.6.16.1",
  "payloadKind": "native-only",
  "replacesHtml": false,
  "files": [
    { "path": "Sirman.exe", "sha256": "<64 lowercase hex>", "bytes": 152064 }
  ]
}
```

Required: `magic`, `format` (1), `id`, `version`, `assembly`, `payloadKind=native-only`, `replacesHtml=false`, non-empty `files[]` with `path` / `sha256` / `bytes`.

Optional: `expectedHtmlVersion` (advisory only; never copies HTML). `minAssembly` / `maxAssembly` (assembler defaults them to `assembly`).

`magic: "SIRMAN_UPDATE"` is rejected as the HTML channel.

---

# 4. ALLOWED PAYLOAD

Default assembler payload (include if present in source root):

- `Sirman.exe`
- `Sirman.dll`
- `Sirman.Core.dll`
- `Sirman.deps.json`
- `Sirman.runtimeconfig.json`
- `SIRMAN_VERSION.json`
- `WebView2Loader.dll`

Validator allow-list also accepts owned runtime PE (`System.*`, `Microsoft.*`, `runtimes/`, `coreclr.dll`, …).

Always rejected:

- `*.html` / `*.htm`
- `Sirman_Final*` / `Laegh_Final*`
- `test_laegh.js`
- `Sirman_Pending_Update.json` / `Sirman_Update_*`
- `*.sqlite` / `*.db`
- path traversal, absolute paths, empty path, duplicate path

HTML sitting *beside* source binaries is skipped, not packaged.

---

# 5. VALIDATION RULES

Fail closed (no apply):

| Condition | Error |
|---|---|
| Missing/malformed manifest | `native-manifest-missing` / `native-manifest-invalid` |
| Wrong magic (including `SIRMAN_UPDATE`) | `native-magic` |
| `format != 1` | `native-format` |
| Empty files | `native-empty` |
| `replacesHtml: true` | `native-replaces-html` |
| HTML / test_laegh.js path | `native-html-forbidden` |
| `..` / rooted / `:` path | `native-path-illegal` |
| Not allow-listed | `native-file-unsupported` |
| Listed but absent | `native-file-missing` |
| Extra file under `files/` | `native-file-unexpected` |
| Byte length ≠ `bytes` | `native-size-mismatch` |
| SHA-256 ≠ listed | `native-hash-mismatch` |
| Current assembly outside min/max or would downgrade | `native-version` |

Package-only validation does not require an install dir. Compatibility is an optional `CurrentAssembly` argument.

Hashes are of raw file bytes, not HTML canonical JSON.

---

# 6. HTML EXCLUSION PROOF

Assembler source with planted `Sirman_Final.html` / `Laegh_Final.html` / `test_laegh.js` (Core tests): output has **zero** `.html` files; unique HTML markers do not appear in `manifest.json` or `files/`.

Python CLI against VERIFY kit `App\` (HTML is present in source):

```text
source: deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY/App
out:    /tmp/sirman-native-p0-from-verify   (not a shop installer; not committed)
skippedHtml: 3
html_in_package: none
<!DOCTYPE html> in manifest: NO
```

Payload files (SHA-256 of bytes):

| File | Bytes | SHA-256 |
|---|---|---|
| `Sirman.exe` | 152064 | `d82825bd1f907868b49b9ca549ded38a93ff74799733647c218a08ee249b8244` |
| `Sirman.dll` | 223744 | `63ddbf4a451ced37cdfc3bfe9863f3ef800f03122bdb43b9533469fb4b2b840a` |
| `Sirman.Core.dll` | 410112 | `aff053f86f142593cdbf5587626ff22869256545bc5bbb89aa6fc28d6efdde57` |
| `Sirman.deps.json` | 36652 | `0095fbce3a206e159c59e61aeb3c365beee490b432dbdafe50039eaa06aa35d7` |
| `Sirman.runtimeconfig.json` | 450 | `6b9ee3cd3e3fb77d663625028b4825d76249b26cab7bbf508e53755b2d982b70` |
| `SIRMAN_VERSION.json` | 340 | `3ba12e732d5c7e784192a2d6b1f40005983fc0bd32a83df51c2749f783d63d82` |
| `WebView2Loader.dll` | 165968 | `462b36fd1be6ca9f7563466a89e57c41ef4a4def3e0a84fa885d203aea4a3aaf` |

`scripts/write_full_update_json.py` was **not** run. `apply_sirman_update.ps1` and `UpdateService.cs` were **not** modified.

---

# 7. TESTS

| Suite | Result |
|---|---|
| `NativeUpdateP0Tests` | **14 / 14** |
| `dotnet test desktop/Sirman.Core.Tests` | **921 / 921** (was 907; +14) |
| `node test_laegh.js Sirman_Final.html` | **1120 / 1120** |
| `node test_installer_lifecycle.js` | **21 / 21** |

P0 cases: parse, assemble+validate without HTML, hash mismatch, missing file, unexpected file, HTML in manifest, path traversal/absolute, unsupported file, HTML magic, version mismatch, malformed JSON, `replacesHtml`, assembler without HTML present, Python CLI skip HTML.

Existing HTML updater tests were not weakened.

---

# 8. BUILD

```text
dotnet test desktop/Sirman.Core.Tests -c Release
Build succeeded. 0 errors.
```

No Desktop/Host/HTML build change required. `git diff --check` on new files: clean. No shop Setup ZIP created.

---

# 9. PROTECTED AREAS

Not modified:

- HTML / `test_laegh.js`
- `UpdateService`, `apply_sirman_update.ps1`, `write_full_update_json.py`, `updates/README.md`
- Backup / Recovery
- Print
- Inventory / business facades
- SQLite persistence
- Host allow-list
- Product version
- Shop data / install dirs

---

# 10. KNOWN LIMITATIONS

- No apply. Running EXE/DLL are not replaced.
- No `SirmanUpdater.exe`, no journal, no rollback.
- No Host method and no Settings-tab wiring.
- Default payload is the small allow-listed set, not the full ~484-file self-contained tree.
- No Authenticode.
- HTML-only (BAT) installs cannot consume this package (by design).
- Linux tests ≠ Windows shop apply (P1+).

---

# 11. NEXT STEP

**NATIVE-UPDATE-P1-APPLY**

P1 is **NOT** implemented in this packet.

P1 (from the architecture gate) is the separate updater process: wait for `Sirman.exe` to exit, replace allow-listed files from a validated staging package, journal + native backup/restore. Not started.

---

# 12. FINAL STATUS

| Item | Value |
|---|---|
| Packet | NATIVE-UPDATE-P0-CONTRACT |
| Status | **COMPLETED** |
| Native create without HTML | YES |
| Native validate without HTML | YES |
| Apply | NO |
| SirmanUpdater.exe | NO |
| Version | `1405.6.16α` unchanged |
| Core tests | 921 passed |
| HTML tests | 1120 passed |

**COMPLETED.**

**STOP.** P1 not started. No shop installer. Nothing installed.
