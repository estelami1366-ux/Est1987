# P0 INSTALL / UNINSTALL — REMAINING FILES FORENSIC
**Date:** 2026-09-02  
**Mode:** READ-ONLY  
**Shop path named by operator:** `D:\Laegh.3A`  
**This agent:** Linux. `D:\Laegh.3A` was **not mounted** and **not enumerated**. No shop file was deleted or opened on the shop PC.

```text
Product code changed: NO
Installer changed:    NO
Uninstaller changed:  NO
Print changed:        NO
Storage changed:      NO
Backup changed:       NO
Version changed:      NO
Files deleted:        NO
Build/package:        NO
```

Source authority: current P0 uninstall tree (`24c9133` and later packaging commits). Shop leftover names reported by the operator. P0 shop ZIP App inventory used only as a **read-only model** of what a self-contained win-x64 install contains.

---

## 1. Manifest

### Shop file `D:\Laegh.3A\sirman-install-manifest.json`

| Question | Result |
|---|---|
| File exists on shop disk | **NOT OBSERVABLE** from this agent (`NO_WINDOWS_PATH`) |
| Number of entries | **NOT OBSERVABLE** |
| `clr*.dll` listed | **NOT OBSERVABLE** |
| `coreclr.dll` listed | **NOT OBSERVABLE** |
| `PresentationFramework*.dll` listed | **NOT OBSERVABLE** |
| `System*.dll` listed | **NOT OBSERVABLE** |

Do not infer existence from this Linux checkout. After a **successful** Level 1 pass, the manifest file itself is in `ownedExactFiles` and is deleted, so a leftover folder often **will not** still contain the JSON even if it was used.

### Ownership mechanism (current code — exact)

Level 1 does **not** `rd /s /q` the install directory.

Control flow:

```text
Uninstall-Sirman.bat
  powershell -File Uninstall-Sirman.ps1 -Mode Level1
    dotsource Sirman-InstallLifecycle.ps1
      Invoke-SirmanLevel1Uninstall
        Stop-Process -Name Sirman   (not taskkill)
        Start-Sleep 1
        Remove-SirmanCanonicalShortcuts
        Remove-SirmanInstallerOwnedInDir
```

A file under the install directory is deleted only if **any** of these is true:

1. **Manifest hit** — relative path (forward slashes) is in `sirman-install-manifest.json` → `files`
2. **Exact filename** — name is in contract `ownedExactFiles` (`Sirman.exe`, `Sirman.dll`, uninstall scripts, `WebView2Loader.dll`, …)
3. **Prefix** — name starts with `Sirman_Final_`, `Sirman_Update_`, `System.`, `Microsoft.`, or `runtime`
4. **Extension** — `*.pdb`
5. **Directory** — first relative segment is `runtimes`
6. **Updates** — relative path matches `updates/Sirman_Update_*`

Otherwise the file is treated as **user/unknown** and **left on disk**.

`ownedPruneFilePatterns` in the contract JSON is **not consulted** by Level 1.

`Remove-Item ... -ErrorAction SilentlyContinue` — delete failures are ignored; the script does not stop.

If the directory is empty after that pass, the folder is removed. If any file remains, **`D:\Laegh.3A` stays**.

---

## 2. Actual remaining files

### Shop enumeration

`D:\Laegh.3A` was **not listed** here. The operator’s remaining set:

```text
clr*.dll
coreclr.dll
PresentationFramework*.dll
PresentationCore.dll
System*.dll
etc.
```

### Classification against current ownership rules

Using the P0 shop ZIP `App\` inventory (486 files) as the published layout:

Without a **parsed** manifest, Level 1 would **delete 313** and **leave 173**.

Those 173 leftovers are almost all self-contained .NET / WPF **native and framework** DLLs. They match the shop report.

| Example | Class | Owned by filename/prefix? |
|---|---|---|
| `coreclr.dll` | RUNTIME / INSTALLER-OWNED in fact | **NO** |
| `clrjit.dll`, `clrgc.dll`, `clretwrc.dll` | RUNTIME | **NO** |
| `hostfxr.dll`, `hostpolicy.dll` | RUNTIME / LAUNCHER host | **NO** |
| `PresentationCore.dll` | RUNTIME (WPF) | **NO** |
| `PresentationFramework.dll` and `PresentationFramework*.dll` | RUNTIME (WPF) | **NO** |
| `WindowsBase.dll`, `wpfgfx_cor3.dll`, `Accessibility.dll` | RUNTIME | **NO** |
| `mscorlib.dll`, `netstandard.dll` | RUNTIME | **NO** (`mscorlib` is not `System.`) |
| `System.Private.CoreLib.dll`, `System.Runtime.dll` | RUNTIME | **YES** (prefix `System.`) |
| `Microsoft.*.dll` | RUNTIME | **YES** (prefix `Microsoft.`) |
| `Sirman.exe`, `Sirman.dll` | LAUNCHER / app | **YES** (exact) |
| `runtimes\**` | RUNTIME | **YES** (owned dir) |
| `sirman_media\**` | USER | **preserved on purpose** |
| `راهنمای_نصب_از_صفر.txt` | OTHER (shipped guide) | **NO** unless listed in manifest |

If the shop leftover folder still contains `System.Private.CoreLib.dll` / `System.Runtime.dll`, that is **not** explained by the name list (those names are owned). That would mean the delete was **skipped** (lock / ACL / `SilentlyContinue`).

If the leftover set is `coreclr` / `clr*` / `Presentation*` / `hostfxr` and **not** `System.*`, that is exactly the name-list hole.

`runtimes\` is owned as a directory. Remaining files named by the operator are **top-level** publish DLLs, not `runtimes\`.

---

## 3. Uninstall logic — answers

| # | Question | Answer |
|---|---|---|
| A | Does Level 1 iterate the manifest? | **Yes, if the JSON parses.** It loads `files` into a HashSet, then iterates **disk** files (not the JSON as the delete list). A disk file is deleted if its relative path is in that HashSet **or** the name rules match. Parse errors are swallowed (`try/catch {}`) → HashSet stays empty. |
| B | Full paths or filenames? | Manifest compare is **relative path** (`coreclr.dll` or `cs/PresentationCore.resources.dll`), slash-normalized. Fallback is **filename only** (`Test-SirmanOwnedName -Name $_.Name`). |
| C | Does it exclude runtime DLLs? | **Not by a “runtime” skip list.** Native/WPF names simply **fail the owned-name test**. `System.*` / `Microsoft.*` / `runtimes\` are included. `coreclr.dll` is not. |
| D | Stop on first delete error? | **No.** `SilentlyContinue`. Loop continues. |
| E | ExecutionPolicy / locked files? | Bat uses `-ExecutionPolicy Bypass`. Policy is not the leftover mechanism. **Locked files** can remain because failures are silent. |
| F | Does Sirman remain alive? | New engine uses `Stop-Process -Name 'Sirman' -Force`, then **1 second** sleep. **No** `taskkill /F /IM Sirman.exe`. The in-app Uninstall comment still says taskkill; the shipped bat **does not** call taskkill. |
| G | Child process holding DLLs? | `Sirman_Start.bat` starts a **separate** minimized window `Sirman-Server-*` (`powershell.exe` + `sirman_run.ps1`). That name is **not** `Sirman`, so it is **not** stopped. `msedgewebview2.exe` is not stopped. Those mainly lock WebView user-data / HTML, not typically `coreclr.dll` of `Sirman.exe`, but they are not waited on. |
| H | ACL possible? | Yes, and they would look like “file remains” because errors are discarded. No shop ACL evidence on this agent. |
| I | Left because treated as user files? | **Yes for `coreclr` / `Presentation*` / `hostfxr`:** the code’s fallback **intentionally** leaves unknown names. They are installer-owned in the zip, but not in the fallback list. That is not “user data”; it is a **false-negative ownership** result. |

There is **no** `taskkill` in `desktop/Uninstall-Sirman.bat` (P0). Old bats did `taskkill /F /IM Sirman.exe` then `rd /s /q` the folder.

---

## 4. First divergence

**Function:** `Remove-SirmanInstallerOwnedInDir`  
**Predicate:** `$owned = $manifestRel.Contains($rel) -or (Test-SirmanOwnedName -Name $_.Name -Contract $Contract)`  
**Then:** `Test-SirmanOwnedName` for `coreclr.dll` → **false** (not in `ownedExactFiles`, does not start with `System.` / `Microsoft.` / `runtime`).

**EXPECTED:** installer-owned runtime file deleted (it was copied by the self-contained publish).  
**ACTUAL:** if the manifest HashSet does not contain `coreclr.dll`, the `if ($owned)` block is skipped; the file is left.

**Evidence (read-only, from the P0 zip App set):**

```text
coreclr.dll                    REMAIN without manifest
clrjit.dll / clrgc.dll         REMAIN
PresentationCore.dll           REMAIN
PresentationFramework.dll      REMAIN
hostfxr.dll                    REMAIN
System.Private.CoreLib.dll     DELETE (prefix System.)
Sirman.exe                     DELETE (exact)
```

That leftover set is the shop report.

If a complete manifest **is** parsed, the same files would be HashSet hits and **would** be deleted. So the live shop leftovers mean **at least one** of:

1. Manifest missing / not written / JSON parse failed (empty catch) → fallback name list only  
2. Delete of those files failed and was swallowed (lock) — more likely if `System.*` also remain

---

## 5. Process-lock check (source only — no processes killed)

```text
New Level 1:  Stop-Process -Name 'Sirman' ; sleep 1
Old Level 1:  taskkill /F /IM Sirman.exe
In-app menu:  RequestForceClose() then LaunchUninstall(); comment still says taskkill
```

Known processes that can outlive `Stop-Process Sirman`:

- `powershell.exe` window title `Sirman-Server-1405.6.3α` from `Sirman_Start.bat`
- `msedgewebview2.exe` (WebView2)
- a second `Sirman.exe` if Stop-Process missed it
- the uninstall `powershell.exe` itself (locks `.ps1` / `.bat` in the install dir, **not** `coreclr.dll`)

`coreclr.dll` leftover is a **poor fit** for “PowerShell is running the uninstall script.” It is a **good fit** for the owned-name hole. It is a **possible fit** for `Sirman.exe` still mapping those DLLs if Stop-Process did not finish before the delete loop.

---

## 6. Test 1 vs Test 2

P0 Start Menu **does not** create a shortcut named `Uninstall.lnk`. Canonical names:

```text
Programs\Sirman\SIRMAN.lnk
Programs\Sirman\Uninstall SIRMAN.lnk
Programs\Sirman\SIRMAN Full Cleanup.lnk
```

On NTFS, `Uninstall Sirman.lnk` and `Uninstall SIRMAN.lnk` are the **same** file.

| | Test 1 | Test 2 |
|---|---|---|
| Operator label | Start → Sirman → **Uninstall** | Start → Sirman → **Uninstall SIRMAN** |
| Folder after | `D:\Laegh.3A` **gone** | files **remain** in `D:\Laegh.3A` |
| Matches new Level 1 with **name fallback only** | **No** (would leave ~173 runtime DLLs) | **Yes** |
| Matches **old** `rd /s /q "%INSTALL_DIR%"` | **Yes** (folder gone) | No |
| Matches new Level 1 with **full parsed manifest** + empty dir | **Yes** (folder gone) | Only if deletes then failed |

Do not assume the two clicks used the same artifact.

Most consistent reading:

- **Test 1 “Uninstall”** — either a **legacy** uninstall link (Persian `حذف سیرمان.lnk` / old bat still doing `rd /s /q` after `cd /d "%TEMP%"`), or a new Level 1 run where **every** remaining file was owned (complete manifest) and the directory was then removed because it was empty.
- **Test 2 “Uninstall SIRMAN”** — current P0 bat → ps1 → `Remove-SirmanInstallerOwnedInDir` **without** an effective manifest (or with silent delete misses). Leftovers are the unpublished-by-name runtime set.

The new bat **never** silently retargets via `install-location.txt`. Different leftover vs empty-folder outcomes are **not** explained by retargeting.

---

## 7. Manual delete

Not recommended. The folder remaining is a **Level 1 ownership/delete-predicate** result, not an operator chore.

---

## 8. Classification

**Exactly one:**

```text
B  uninstall deletion logic bug
```

Level 1 refuses wholesale `rd` (correct for user files) but the **fallback owned-name list does not cover self-contained native/WPF runtime files**. Those files are installer-owned in the zip. When the manifest is missing or fails to parse, they are left and the install directory is kept.

Not chosen:

- **A** — manifest is the intended cover; the live failure mode is the **fallback predicate**, not the JSON schema. Shop JSON was not readable here.
- **C** — possible overlay if `System.*` truly remain; not required to explain `coreclr` / `Presentation*`.
- **D** — the zip **does** ship those DLLs; packaging put them in `App\`.
- **E** — likely **explains Test 1 vs Test 2**, not the leftover names themselves.
- **F** — not needed.

---

## Recommendation (no implementation)

Minimal future fix (do not do it in this packet):

1. Treat self-contained publish runtime names as installer-owned (native host/WPF/clr*), **or** fail closed if the manifest is missing/unreadable instead of using the narrow name list.
2. Do not `SilentlyContinue` on delete of owned files; retry after process exit; `cd` out of the install dir before deleting it.
3. Stop `Sirman.exe` with the same force as old `taskkill`, and stop the `Sirman-Server-*` helper if it was started.

Shop check for the next Windows pass (read-only): whether `D:\Laegh.3A\sirman-install-manifest.json` is still present, and whether `System.Private.CoreLib.dll` remains next to `coreclr.dll`.

---

## FINAL

```text
Product code changed: NO
Installer changed: NO
Uninstaller changed: NO
Print changed: NO
Storage changed: NO
Backup changed: NO
Version changed: NO
Files deleted: NO
Build/package: NO
```

**STOP — WAIT FOR REVIEW.**
