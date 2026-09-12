# SIRMAN — NATIVE UPDATE P1.1 RUNTIME INDEPENDENCE

**Date:** 1405/06/21 (2026-09-12)
**Packet:** NATIVE-UPDATE-P1.1-RUNTIME-INDEPENDENCE
**Product version:** `1405.6.16α` / assembly `1405.6.16.1` (unchanged)
**Shop install executed:** NO
**.NET Runtime installed on this VM for the shop:** NO
**P2 started:** NO

```text
FINAL STATUS: COMPLETED + NEEDS HUMAN VERIFICATION
Previous 7-file package: DO NOT USE
New package: Sirman_Native_Update_1405.6.16α_SC.snu
.NET Desktop Runtime required to launch SIRMAN: NO (WebView2 still external)
```

---

# 1. OBSERVED FAILURE

After Native Update P1, Windows showed:

```text
You must install .NET Desktop Runtime to run this application.
```

The host “Download it now” control produced no useful action.

That dialog is the framework-dependent **WindowsDesktop.App** apphost prompt. It appears when `Sirman.exe` cannot load a bundled Desktop runtime (`hostfxr` / `coreclr` / `System.Windows.Forms` / `WindowsBase`).

---

# 2. ROOT CAUSE

Shop SIRMAN has always been a **self-contained win-x64** Desktop publish (`scripts/pack_sirman_setup.py`, VERIFY kit `App\` ≈ 487 files including `hostfxr.dll` + `coreclr.dll`).

P0/P1 native assembler copied **only seven names** (`DefaultPayloadFiles`):

```text
Sirman.exe, Sirman.dll, Sirman.Core.dll, Sirman.deps.json,
Sirman.runtimeconfig.json, SIRMAN_VERSION.json, WebView2Loader.dll
```

The P1 shop package `deliveries/Sirman_Native_Update_1405.6.16α.snu` therefore contained those seven files and **not** the runtime.

`Sirman.runtimeconfig.json` in that package is self-contained (`includedFrameworks` for `Microsoft.NETCore.App` + `Microsoft.WindowsDesktop.App` 8.0.31). The matching `hostfxr.dll` / `coreclr.dll` / WinForms / WPF assemblies were left in the publish tree (481 files) and never packed.

Applying or launching from that 7-file set leaves the new apphost/config expecting a bundled Desktop runtime that is not in the payload. Windows then asks for an external .NET Desktop Runtime.

This VM re-validated that package with the new completeness check:

```text
ok=False error=native-runtime-incomplete
old payload files: 7
old has hostfxr: False
```

---

# 3. CURRENT PUBLISH MODEL

| Surface | Model |
|---|---|
| Shop Setup kit | `dotnet publish -r win-x64 --self-contained true` |
| VERIFY `App\` | self-contained; `includedFrameworks`; `hostfxr.dll` present |
| Desktop.csproj (before this packet) | no `SelfContained`; RID only on the packer command line |
| Native P0/P1 payload | 7 files; allow-list already accepted runtime PE but assembler did not copy them |

Product is **not** framework-dependent. The native *update* was.

---

# 4. TARGET PUBLISH MODEL

Keep the existing shop model: **self-contained `win-x64` Desktop**.

Do **not** switch SIRMAN to a machine-wide .NET Desktop Runtime.

Native update payload = every allow-listed file from that publish (≈465 files), still excluding HTML / sqlite / pending HTML updates / DAC dump binaries.

P1 apply engine is unchanged: it already copies every `manifest.files[]` path, including nested `runtimes/`.

---

# 5. EXACT CHANGES

| File | Change |
|---|---|
| `desktop/Sirman.Desktop/Sirman.Desktop.csproj` | `SelfContained=true` when `RuntimeIdentifier=win-x64` |
| `NativeUpdateAssembler` + `assemble_sirman_native_update.py` | copy all allow-listed native/runtime files, not only the seven names |
| `NativeUpdateRuntimeIndependence` + validator | fail-closed: FDD config → `native-runtime-framework-dependent`; SC config without hostfxr/coreclr/WinForms → `native-runtime-incomplete` |
| `NativeUpdateAllowList` | prefix `Accessibility` (so `Accessibility.dll` packs); skip createdump/DAC/pdb/xml |

Not changed: HTML, `UpdateService`, apply PS1, Backup/Print/Inventory/SQLite, P1 state machine, version.

Size impact (expected, not a redesign):

| Artifact | Files | Size |
|---|---|---|
| Old P1 `.snu` (incomplete) | 7 payload + updater | 30 052 026 B |
| New `_SC.snu` | **465** payload + updater | **98 211 068** B |
| Uncompressed payload | 465 | ~158 MiB |

Old 7-file `.snu` was **not overwritten**.

---

# 6. RUNTIME INDEPENDENCE PROOF

Linux cannot launch `Sirman.exe`. Proof instead:

1. `dotnet publish -r win-x64` **without** `--self-contained` still emitted `includedFrameworks` and `hostfxr.dll` (csproj condition).
2. Package contains required runtime PE (sizes below).
3. Validator **rejects** the previous 7-file package.
4. Validator **accepts** the 465-file package (`ok=true files=465`).
5. Unit tests: incomplete SC fails; FDD config fails; apply copies `hostfxr.dll` and leaves HTML/sqlite bytes unchanged.

Required bundled files in the new payload:

| File | Bytes | SHA-256 |
|---|---|---|
| `hostfxr.dll` | 366376 | `4f5a0500cd2a2439b0d5edbf242950233aec4539ec9a5e7ba9b8a9b0079f63af` |
| `hostpolicy.dll` | 406824 | `24f18ccb306d5e614932478471ad276e2b041a723a45e571073db383b37c5120` |
| `coreclr.dll` | 4995880 | `bbbcaedb369617695280caaa60cda1aba4fa3c5b557532a89d9f4a9174a5b692` |
| `clrjit.dll` | 1777960 | `697c09ac310b8fb8118863971955da135aee348116816e3b511bf5957dc6253a` |
| `System.Private.CoreLib.dll` | 13174608 | `99b168b84597a4f31fda8281efce7d42a14e2df0f4694194735e049dbc0f6418` |
| `System.Windows.Forms.dll` | 13563688 | `2f06c91958c240fb4ed07265dd886d259457642cc151e9620ddb4641fdbc404f` |
| `WindowsBase.dll` | 2254632 | `bb72bfdc7e163e7d0c6dc984a73856b9a3df218d247342680e9b5dbb9d326fa5` |

`Sirman.runtimeconfig.json` has `includedFrameworks`, not shared `frameworks`.

---

# 7. NATIVE UPDATE PACKAGE CHECK

**Use this file** (not the 7-file P1 package):

```text
deliveries/Sirman_Native_Update_1405.6.16α_SC.snu
```

| Item | Value |
|---|---|
| Size | **98211068** bytes |
| SHA-256 | `96fe4f08005193995f06ac81d89a9ba8a6fd2c61fb7779bd07c7895cabee85d8` |
| Payload files | 465 |
| HTML in payload | NONE |
| ValidatePackage | `ok=true` |
| Companion | `SirmanUpdater.exe` at archive root (not in `files/`) |

Do **not** use `Sirman_Native_Update_1405.6.16α.snu` (7 files, `4e04c703…`).

Existing Setup ZIPs untouched (`0f66467a…` / `42f06f53…`).

Windows apply:

```bat
cd /d C:\Temp\sirman-native-sc
SirmanUpdater.exe --package . --install "%LocalAppData%\Sirman\App"
```

P1 remains compatible (same CLI, same journal). It will now replace the full allow-listed native set.

---

# 8. HTML INDEPENDENCE

Assembler skipped `Sirman_Final.html` (`skippedHtml=1`). No `.html` / `test_laegh.js` in the package. `replacesHtml` is false. Apply test leaves planted HTML + sqlite byte-identical.

---

# 9. TESTS

| Suite | Result |
|---|---|
| `NativeUpdateP11Tests` | **5 / 5** |
| All `NativeUpdate*` | **31 / 31** |
| `dotnet test desktop/Sirman.Core.Tests` | **938 / 938** (was 933; +5) |
| `node test_laegh.js Sirman_Final.html` | **1120 / 1120** |
| `node test_installer_lifecycle.js` | **21 / 21** |

P1.1 cases: SC assemble includes runtime and skips HTML; SC config without `hostfxr` fail-closed; FDD runtimeconfig fail-closed; apply copies runtime and leaves HTML; `Accessibility.dll` allow-listed.

---

# 10. BUILD/PUBLISH

```text
dotnet publish desktop/Sirman.Desktop -c Release -r win-x64 -p:EnableWindowsTargeting=true
  (no --self-contained flag; csproj forces SC for win-x64)
  → includedFrameworks + hostfxr.dll

dotnet test desktop/Sirman.Core.Tests -c Release
python3 scripts/assemble_sirman_native_update.py --source <publish> --out <pkg>
```

---

# 11. PROTECTED AREAS

Not modified: HTML, `test_laegh.js`, `UpdateService`, `apply_sirman_update.ps1`, Backup, Print, Inventory, SQLite, Host allow-list, product version, shop data, known-good Setup ZIPs.

---

# 12. KNOWN LIMITATIONS

- WebView2 Evergreen is still an external Windows prerequisite (unchanged).
- Linux cannot execute `Sirman.exe`; live launch is human/Windows.
- DAC/createdump binaries are omitted on purpose.
- Payload is large (~98 MiB zip) because it now carries the Desktop runtime.
- If the 7-file package was already applied, apply the `_SC` package to restore runtime files.

---

# 13. HUMAN WINDOWS VERIFICATION

```text
Launch without installing .NET Desktop Runtime: NEEDS HUMAN VERIFICATION
Process-replace of 465 files on a live Sirman.exe: NEEDS HUMAN VERIFICATION
Shop apply: NOT executed
```

Expected after `_SC` apply: `Sirman.exe` starts using bundled `hostfxr`/`coreclr`/WinForms next to the exe. The Desktop Runtime dialog must not appear. WebView2 may still be required.

---

# 14. FINAL STATUS

| Item | Value |
|---|---|
| .NET Desktop Runtime still required | **NO** (for SIRMAN itself) |
| WebView2 | still external |
| Runtime files included | yes (465 allow-listed; required set in §6) |
| Package | `deliveries/Sirman_Native_Update_1405.6.16α_SC.snu` |
| Size | 98211068 bytes |
| SHA-256 | `96fe4f08005193995f06ac81d89a9ba8a6fd2c61fb7779bd07c7895cabee85d8` |
| P1 updater compatible | **YES** |
| Version | `1405.6.16α` unchanged |

**COMPLETED** for root-cause, fail-closed completeness, SC payload, and tests.

**NEEDS HUMAN VERIFICATION** for a real Windows launch with no shared Desktop Runtime.

**STOP.** No shop install. No manual Runtime install. P2 not started.
