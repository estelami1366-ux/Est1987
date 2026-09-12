# SIRMAN — NATIVE UPDATE WITH RESTORE FIX P0

**Date:** 1405/06/21 (2026-09-12)
**Packet:** NATIVE-UPDATE-RESTORE-FIX-P0
**Mode:** BUILD AND PACKAGE ONLY
**Branch:** `cursor/native-update-restore-fix-p0-fa01`
**Shop / Windows apply executed:** NO
**Real company data touched:** NO

```text
NATIVE UPDATE = COMPLETE
RESTORE FIX INCLUDED = YES
HTML INCLUDED = NO
BACKUP INCLUDED = NO
REAL COMPANY DATA TOUCHED = NO
PACKAGE SHA256 = 071b00f8b26746aee5ba04e4e0fe7b8df1113e41188faef26c79a97d3698dd9e
PACKAGE = deliveries/Sirman_Native_Update_1405.6.16α_RESTORE-FIX_SC.snu
TARGET VERSION = 1405.6.16α
TARGET ASSEMBLY = 1405.6.16.1
RESULT = READY FOR WINDOWS TEST
```

---

# 1. SOURCE

| Item | Value |
|---|---|
| Package built from HEAD | `fb23904e1aa9cb9b738ee68995690b4b225aff0b` |
| Restore-fix ancestor (required) | `b346e4a9078797cdd5ba948203cb3ad4d05101ad` |
| Restore-fix code commit | `850f7a7137a6f5ba4cc833122b8d367db9d4c2c6` |
| `git merge-base --is-ancestor b346e4a HEAD` | YES |

Source HTML still contains `consumeBackupSectionChecksums` / `_sirmanSectionChecksumsConsumed`. `Sirman_Final.html` and `Laegh_Final.html` remain byte-identical. Neither HTML file is in this package.

Core lock test `ValidOriginalSectionChecksums_AreNotReCheckedAfterMigrate` is in `BackupDryRunTests` and passed in this build.

---

# 2. VERSION POLICY (INSPECTED, NOT INVENTED)

Authoritative `SIRMAN_VERSION.json` / `desktop/Directory.Build.props`:

| Field | Value |
|---|---|
| Product version | `1405.6.16α` |
| Assembly version | `1405.6.16.1` |
| Update version (`manifest.version`) | `1405.6.16α` |
| Base version | `1405.6.16α` / `1405.6.16.1` |
| Manifest id | `sirman-native-1405.6.16α-restore-fix-p0` |
| `minAssembly` / `maxAssembly` | `1405.6.16.1` / `1405.6.16.1` |

`NativeUpdateValidator.CheckAssemblyCompatibility` fails **downgrade only**. Same assembly (`vsTarget == 0`) is allowed. Previous native packages used this same product/assembly without a bump.

`NativeUpdateApplier.InstallMatches` skips replace only when **every payload hash already matches** the install. This payload’s `Sirman.Core.dll` / `Sirman.dll` hashes differ from `Sirman_Native_Update_1405.6.16α_SC.snu`, so apply on that older SC install will replace native files.

No product/assembly increment was required. Version files were not modified.

---

# 3. CRITICAL ARCHITECTURE FACT

The live UI restore gate is HTML (`importData` → original `sectionChecksums` → `consumeBackupSectionChecksums` → `migrateBackup`). Native allow-list forbids `*.html`, `Sirman_Final*`, `Laegh_Final*`.

A native-only package **cannot ship the HTML restore fix**. This packet still requires `RESTORE FIX INCLUDED = YES`, meaning:

- the tree contains `b346e4a`;
- source HTML still has the consume helpers;
- Core tests include the dry-run lock;
- built Core/Desktop binaries come from that tree.

It does **not** mean Windows UI restore will change from this `.snu` alone. Shop UI restore still needs the updated `Sirman_Final.html` via installer / HTML update channel.

`HTML INCLUDED = NO` is required by `payloadKind=native-only` / `replacesHtml=false`. HTML was not stuffed into the `.snu`.

---

# 4. PACKAGE

**Use this file** (do not overwrite or use the older packages):

```text
deliveries/Sirman_Native_Update_1405.6.16α_RESTORE-FIX_SC.snu
```

| Item | Value |
|---|---|
| Size | **98533380** bytes |
| SHA-256 | `071b00f8b26746aee5ba04e4e0fe7b8df1113e41188faef26c79a97d3698dd9e` |
| Sidecar | `deliveries/Sirman_Native_Update_1405.6.16α_RESTORE-FIX_SC.snu.sha256` |
| Payload files | **465** |
| Format | ZIP bytes, extension `.snu` |
| `magic` | `SIRMAN_NATIVE_UPDATE` |
| `payloadKind` | `native-only` |
| `replacesHtml` | `false` |
| HTML in payload | NONE |
| Backup JSON in payload | NONE |
| Company data | NONE |
| Companion | `SirmanUpdater.exe` at archive root (not in `files/`) |
| Operator card | `APPLY-WINDOWS.txt` at archive root (not applied) |

Archive layout:

```text
manifest.json
files/                 ← 465 allow-listed native/runtime files
SirmanUpdater.exe      ← P1 consumer; not copied into App by apply
APPLY-WINDOWS.txt
```

Assembler: `scripts/assemble_sirman_native_update.py` (`skippedHtml=1`).
Publish: `dotnet publish` Desktop `win-x64` self-contained; Updater `win-x64` self-contained single-file.

Old known-good packages **not overwritten**:

| File | SHA-256 (unchanged) |
|---|---|
| `Sirman_Native_Update_1405.6.16α.snu` | `4e04c703de052cf7b78a6aac617406b25b609f9071ecab37486aa74f551db7f5` |
| `Sirman_Native_Update_1405.6.16α_SC.snu` | `96fe4f08005193995f06ac81d89a9ba8a6fd2c61fb7779bd07c7895cabee85d8` |

Do **not** use the 7-file P1 `.snu`.

JSON names under `files/` only: `SIRMAN_VERSION.json`, `Sirman.deps.json`, `Sirman.runtimeconfig.json`.

---

# 5. RUNTIME

`Sirman.runtimeconfig.json` has `includedFrameworks` (`Microsoft.NETCore.App` + `Microsoft.WindowsDesktop.App` 8.0.31). No shared `framework`.

| File | Bytes | SHA-256 |
|---|---|---|
| `hostfxr.dll` | 366376 | `4f5a0500cd2a2439b0d5edbf242950233aec4539ec9a5e7ba9b8a9b0079f63af` |
| `hostpolicy.dll` | 406824 | `24f18ccb306d5e614932478471ad276e2b041a723a45e571073db383b37c5120` |
| `coreclr.dll` | 4995880 | `bbbcaedb369617695280caaa60cda1aba4fa3c5b557532a89d9f4a9174a5b692` |
| `clrjit.dll` | 1777960 | `697c09ac310b8fb8118863971955da135aee348116816e3b511bf5957dc6253a` |
| `System.Private.CoreLib.dll` | 13174608 | `99b168b84597a4f31fda8281efce7d42a14e2df0f4694194735e049dbc0f6418` |
| `System.Windows.Forms.dll` | 13563688 | `2f06c91958c240fb4ed07265dd886d259457642cc151e9620ddb4641fdbc404f` |
| `WindowsBase.dll` | 2254632 | `bb72bfdc7e163e7d0c6dc984a73856b9a3df218d247342680e9b5dbb9d326fa5` |
| `Sirman.Core.dll` | 446976 | `d32a5cbbde688d5346f3985064150f4b472bebe1763c72d65244f2f6e6596969` |
| `Sirman.dll` | 224256 | `fbf7ccd02439abd6e15f7e6c47d4dc521ff74e2c3a61705456a288ad43730642` |

`NativeUpdateValidator.ValidatePackage` on the assembled directory with `CurrentAssembly=1405.6.16.1`: **`ok=true` files=465**. Every `manifest.files[]` SHA-256 recomputed: match. Extra/missing files: none.

Linux cannot launch `Sirman.exe`. This VM has **0** connected Windows self-hosted workers.

---

# 6. WINDOWS TEST APPLY (NOT EXECUTED HERE)

Install directory must already exist (Setup). Empty business data is OK. Do not apply on the live shop profile.

```bat
cd /d C:\Temp\sirman-native-restore-fix
SirmanUpdater.exe --package . --install "%LocalAppData%\Sirman\App" --no-launch
```

If Explorer does not open `.snu`, rename to `.zip` then extract. Confirm `manifest.json`, `files\`, and `SirmanUpdater.exe` are in that folder. Close SIRMAN first. No manual DLL copy.

UI restore smoke on that machine still needs the restore-fix HTML. This package only updates native/runtime.

---

# 7. TESTS / BUILD / DIFF

| Suite | Result |
|---|---|
| `node test_laegh.js Sirman_Final.html` | **1125 / 1125** |
| `dotnet test desktop/Sirman.Core.Tests -c Release` | **939 / 939** |
| `NativeUpdate*` | **31 / 31** |
| `BackupDryRunTests` | **32 / 32** |
| Desktop `dotnet publish -r win-x64 --self-contained true` | PASS |
| Updater `dotnet publish -r win-x64 --self-contained true -p:PublishSingleFile=true` | PASS |
| `git diff --check` | PASS |
| Package validator | `ok=true` |

Protected areas not modified: backup format/schema, Inventory, Print, Diagnostic, SQLite candidate, company backup, HTML, version files, old `.snu` packages.

---

# 8. FINAL STATUS

```text
NATIVE UPDATE = COMPLETE
RESTORE FIX INCLUDED = YES
HTML INCLUDED = NO
BACKUP INCLUDED = NO
REAL COMPANY DATA TOUCHED = NO
PACKAGE SHA256 = 071b00f8b26746aee5ba04e4e0fe7b8df1113e41188faef26c79a97d3698dd9e
PACKAGE = deliveries/Sirman_Native_Update_1405.6.16α_RESTORE-FIX_SC.snu
TARGET VERSION = 1405.6.16α
TARGET ASSEMBLY = 1405.6.16.1
RESULT = READY FOR WINDOWS TEST
```

**STOP.** No shop install. No restore into a production profile. No HTML channel in this packet.
