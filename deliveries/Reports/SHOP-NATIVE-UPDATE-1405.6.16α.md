# SIRMAN — SHOP NATIVE UPDATE `1405.6.16α`

**Date:** 1405/06/21 (2026-09-12)
**Packet:** SHOP-NATIVE-UPDATE-1405.6.16α
**Mode:** DELIVERY / PACKAGING ONLY
**Product code modified:** NO
**HTML / updater architecture modified:** NO
**Applied on shop / this VM:** NO
**Version bump:** NO
**P2 started:** NO

```text
FINAL STATUS: COMPLETED + NEEDS HUMAN VERIFICATION
Package created: YES
HTML in payload: NO
Shop apply executed: NO
Windows process-replace: NEEDS HUMAN VERIFICATION
```

---

# 1. SOURCE CHECKPOINT

```text
Branch:                 cursor/diagnostic-center-p3-ui-fault-fa01
HEAD packed:            43e390b636371b74d6308d786409e00866863e1f
Short HEAD:             43e390b
HEAD message:           feat: add native-only update P1 apply engine and SirmanUpdater
Branch switch:          NO
reset/rebase/merge:     NO
silent checkout:        NO
```

Ancestors present on this HEAD:

| Commit | Packet |
|---|---|
| `6fd23e8` | Diagnostic P0 |
| `7f79098` | Diagnostic P1 |
| `607843d` | Diagnostic P2 |
| `f5e3eba` | Diagnostic P3 |
| `a86684f` | Native update P0 contract |
| `43e390b` | Native update P1 apply (HEAD) |

Unrelated dirty leftovers (**not staged, not packed**):

```text
 M deliveries/migration/P1-services/services.candidate.sqlite
 M deliveries/migration/P1-services/services.sha256
?? deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY/   (local unpack)
```

Those paths are not in the native payload. Packaging continued (not BLOCKED).

Existing shop kits **not overwritten**:

| File | SHA-256 (still) |
|---|---|
| `deliveries/Sirman_Setup_1405.6.16α.zip` | `0f66467a5f891facbb2c58f02e145fa6c5bfaf7de01e5d9b13812b0a8908f937` |
| `deliveries/Sirman_Setup_1405.6.16α_DIAGNOSTIC-P3_VERIFY.zip` | `42f06f5335086cca8102b6a62d9838fcf0000eef90a3a43f76e24150d2530856` |

Publish used for payload (not committed):

```text
dotnet publish desktop/Sirman.Desktop -c Release -r win-x64 --self-contained true -p:EnableWindowsTargeting=true
  → /tmp/sirman-fd-publish-native-p1

dotnet publish desktop/Sirman.Updater -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
  → /tmp/sirman-updater-win-p1/SirmanUpdater.exe
```

Assembler: `scripts/assemble_sirman_native_update.py` (unchanged). HTML beside the publish tree was skipped (`skippedHtml=1`). `SIRMAN_VERSION.json` was copied into the publish folder because `dotnet publish` does not emit it.

---

# 2. VERSION

Authoritative `SIRMAN_VERSION.json`:

```text
app:       1405.6.16α
assembly:  1405.6.16.1
```

Package identity:

```text
magic:        SIRMAN_NATIVE_UPDATE
format:       1
id:           sirman-native-1405.6.16α-shop
version:      1405.6.16α
assembly:     1405.6.16.1
minAssembly:  1405.6.16.1
maxAssembly:  1405.6.16.1
payloadKind:  native-only
replacesHtml: false
```

Same-assembly apply is allowed (P0/P1). No version-scheme change.

---

# 3. PACKAGE FILE

Take this file to Windows:

```text
deliveries/Sirman_Native_Update_1405.6.16α.snu
```

| Item | Value |
|---|---|
| Format | ZIP bytes, extension `.snu` (P0 directory layout inside) |
| Size | **30 052 026** bytes (29 MiB) |
| SHA-256 | `4e04c703de052cf7b78a6aac617406b25b609f9071ecab37486aa74f551db7f5` |
| Sidecar | `deliveries/Sirman_Native_Update_1405.6.16α.snu.sha256` |

Archive layout:

```text
manifest.json
files/          ← P0 payload (allow-list only)
SirmanUpdater.exe   ← P1 consumer (self-contained win-x64); NOT in manifest; NOT copied into App by apply
APPLY-WINDOWS.txt   ← Windows command card; not a payload file
```

If Explorer does not open `.snu`, rename to `.zip` then Extract.

Native updater EXE path **inside the package** (after extract):

```text
<extracted>\SirmanUpdater.exe
```

Repo project (not the shop file): `desktop/Sirman.Updater` → assembly name `SirmanUpdater`.

---

# 4. PACKAGE CONTENTS

P0 payload (`files/` + `manifest.json` `files[]`):

| Path | Bytes | SHA-256 |
|---|---|---|
| `Sirman.exe` | 152064 | `0fc4f89f8b8ec1ffb5cd03ccb57aaca7a24105e1d438ea1fc8dd893896c7df5c` |
| `Sirman.dll` | 224256 | `3a95521c8484ec74275f1faeb38bb18665afe82dfd52d9c3505de3a22cc8f652` |
| `Sirman.Core.dll` | 444416 | `ca96048e28a9a01fe6ba6eacf3ce4bc821785f682f90ffc7507575178281b82e` |
| `Sirman.deps.json` | 36652 | `0095fbce3a206e159c59e61aeb3c365beee490b432dbdafe50039eaa06aa35d7` |
| `Sirman.runtimeconfig.json` | 450 | `6b9ee3cd3e3fb77d663625028b4825d76249b26cab7bbf508e53755b2d982b70` |
| `SIRMAN_VERSION.json` | 340 | `3ba12e732d5c7e784192a2d6b1f40005983fc0bd32a83df51c2749f783d63d82` |
| `WebView2Loader.dll` | 165968 | `462b36fd1be6ca9f7563466a89e57c41ef4a4def3e0a84fa885d203aea4a3aaf` |

No other names under `files/`. No `..`, no absolute paths, no `:` in payload paths.

Companion (archive root, **not** applied):

| Path | Role |
|---|---|
| `SirmanUpdater.exe` | 67 940 831 bytes uncompressed; run this to apply |
| `APPLY-WINDOWS.txt` | exact Windows steps |

---

# 5. SHA-256

Package file:

```text
4e04c703de052cf7b78a6aac617406b25b609f9071ecab37486aa74f551db7f5  Sirman_Native_Update_1405.6.16α.snu
```

Per-file payload hashes: §4. Python recomputed SHA-256 of each `files/*` against the manifest: **match**.

---

# 6. HTML INDEPENDENCE

```text
.html / .htm in package:     NONE
test_laegh.js:               NONE
Sirman_Final* / Laegh_Final*: NONE
replacesHtml:                false
reportUiFaultToHost in payload: NONE
Assembler opened HTML:       NO (skippedHtml=1, file not read)
```

`NativeUpdateValidator.ValidatePackage` on the extracted tree (including extra `SirmanUpdater.exe` at root) succeeded without any HTML path.

HTML is **not** required to open, hash, or validate this package. Do not use Settings → آپدیت (`SIRMAN_UPDATE`).

---

# 7. P0 VALIDATION

`NativeUpdateValidator.ValidatePackage` (Core, current assembly `1405.6.16.1`):

```text
ok=true
files=7
magic=SIRMAN_NATIVE_UPDATE
replacesHtml=False
```

Independent Python check: listed set = `files/` set; each `sha256` and `bytes` matches; illegal paths absent.

---

# 8. P1 CONSUMER COMPATIBILITY

P1 `NativeUpdateApplier.Apply` calls the same `ValidatePackage` before any copy. CLI consumer:

```text
SirmanUpdater.exe --package <extracted dir> --install <App dir>
```

Proven here (Linux FDD `SirmanUpdater.dll`, **no shop apply**):

```text
--help                         prints native-only usage
--package <this pkg> --install <missing>
  → ok=false error=native-install-missing
  (package directory was found; install was not; no files replaced)
```

Apply was **not** executed against any install (shop or temp copy of live App).

`SirmanUpdater.exe` in the archive is win-x64 self-contained so the shop PC does not need a separate .NET install to *run the updater*. Apply still only replaces the seven allow-listed files under `--install`.

---

# 9. WINDOWS APPLY INSTRUCTIONS

Default shop layout: `%LocalAppData%\Sirman\App`  
Default journal root: `%LocalAppData%\Sirman`

Sequence:

1. Copy `Sirman_Native_Update_1405.6.16α.snu` to the Windows PC.
2. Extract (rename to `.zip` if needed) to e.g. `C:\Temp\sirman-native-update`.
3. Confirm `manifest.json`, `files\`, and `SirmanUpdater.exe` are in that folder.
4. Close SIRMAN if it is open (the updater also tries to stop `Sirman.exe`, never `SirmanUpdater`).
5. Command Prompt:

```bat
cd /d C:\Temp\sirman-native-update
SirmanUpdater.exe --package . --install "%LocalAppData%\Sirman\App"
```

If the app is installed elsewhere, pass that `App` folder to `--install`. Optional: `--data-root "%LocalAppData%\Sirman"` (this is already the default). `--no-launch` skips starting `Sirman.exe` after `VERIFIED`.

6. Success line: `ok=true` and `state=VERIFIED`.
7. Journal: `%LocalAppData%\Sirman\native-update-journal.json`.

**Manual copy of `Sirman.exe` / `Sirman.dll` / `Sirman.Core.dll`:** **NO** — P1 copies the payload.  
**HTML required:** **NO**.  
**Setup / installer run:** **NO** (do not run `نصب.bat`).  
**P2 UI button:** does not exist; CLI is the apply path.

This VM did **not** run the Windows sequence.

---

# 10. VERSION COMPATIBILITY

| Installed assembly | Result |
|---|---|
| `1405.6.16.1` (current `1405.6.16α`) | **Accepted.** If the seven payload hashes already match the install → `VERIFIED` no-op (no stop/copy). If hashes differ → replace those seven files only; HTML/sqlite/backup untouched. |
| Older (e.g. `1405.6.3.1`) | **Rejected** `native-version` (below `minAssembly`). No copy. |
| Newer (e.g. `1405.6.17.1`) | **Rejected** `native-version` (above `maxAssembly`). No copy. |

Shop VERIFY kit `1405.6.16α` (`42f06f53…`) is assembly `1405.6.16.1` but its `Sirman.exe` / `Sirman.dll` / `Sirman.Core.dll` hashes **differ** from this payload (P0+P1 Core, current Desktop publish). That install **can use this package directly**: it will not no-op; it will replace the seven native files. HTML from the VERIFY kit stays.

---

# 11. ROLLBACK

P1 keeps allow-listed files under:

```text
%LocalAppData%\Sirman\native-backup\<packageId>\
```

until `VERIFIED`, then retires the backup. Failure → restore + re-hash `backupFiles`. Interrupted `APPLYING` is recovered on the next updater run. `--recover-only` restores without a new package.

This packet did not exercise rollback on Windows.

---

# 12. KNOWN LIMITATIONS

- Windows live `Sirman.exe` file-lock / relaunch: **NEEDS HUMAN VERIFICATION** (P1).
- Payload is the P0 default seven files, not the full self-contained `App\` tree.
- No Authenticode.
- No in-app Settings apply (P2 not started).
- HTML-only BAT installs cannot consume this package.
- `SirmanUpdater.exe` is a companion at archive root so the shop can *test P1*; apply does not install that exe into `App\`.
- Linux validation ≠ shop apply. Apply was not run here.

---

# 13. FINAL STATUS

| Item | Value |
|---|---|
| Package path | `deliveries/Sirman_Native_Update_1405.6.16α.snu` |
| Package SHA-256 | `4e04c703de052cf7b78a6aac617406b25b609f9071ecab37486aa74f551db7f5` |
| Package size | 30052026 bytes |
| Native updater EXE | `<extracted>\SirmanUpdater.exe` |
| HTML required | **NO** |
| Manual copy of payload EXE/DLL | **NO** (if P1 runs on Windows) |
| Current `1405.6.16α` install can use it | **YES** (same assembly; hashes vs VERIFY kit differ → replace, not no-op) |
| Older install | rejected `native-version` |
| Installation step executed | **NO** |
| Product source changed | **NO** |
| Version | `1405.6.16α` unchanged |

**COMPLETED** for packaging + P0 validation + P1 format/CLI proof.

**NEEDS HUMAN VERIFICATION** for actual Windows process replacement.

**STOP.** P2 not started. No Setup kit. Nothing installed.
