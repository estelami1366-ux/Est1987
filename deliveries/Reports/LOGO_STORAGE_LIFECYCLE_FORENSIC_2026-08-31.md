# SIRMAN — LOGO STORAGE / SAVE LIFECYCLE FORENSIC

**Packet:** P0.5R7 / P0.5R6 — READ ONLY  
**Gregorian:** 31 August 2026  
**Timezone:** UTC  
**Live version (unchanged):** `1405.6.3α` / assembly `1405.6.3.1`  
**Source HEAD at analysis:** `205956b` (`docs: P0.5R7 runtime identity check (read-only)`)  
**This document:** TRACE ONLY. No product, print, storage, backup, or version change.

```text
Product code changed: NO
Print changed:        NO
Storage architecture changed: NO
Backup changed:       NO
Version changed:      NO
Implementation:       NONE
```

Shop facts treated as true (not re-litigated):

- User selected / uploaded a company logo in **اطلاعات شرکت**.
- After Save, the logo is **not visible** in the company-information UI.
- Native Postal diagnostics: `logoSourceKind = disk`, `logoResolved = false`, `logoLoadSuccess = false`, `logoFailureReason = disk-missing`.
- DrawImage is out of scope.

Linux agent **cannot** open the shop WebView2 `localStorage` or the shop disk. Live `logoSrc` / file size / existence on the shop PC are **NOT OBSERVED**. Values below are proven from source + the shop native diagnostic, then marked OBSERVED vs NOT OBSERVED.

Do **not** treat `localStorage`, `disk://`, or `BackupFolder` as automatically wrong. Each is a valid piece of a split contract. The first break is where that contract stops feeding the company-information page.

---

## PHASE 3 CHANGE GATE

```text
Requested change: none (forensic report only)

Classification of the FINDING (exactly one):
E — UI reload/render problem

Capability: company brand logo upload → persist → display on اطلاعات شرکت

Files read (not modified):
  Sirman_Final.html
  desktop/Sirman.Core/Printing/NativeLogoSource.cs
  desktop/Sirman.Desktop/NativeWindowsPrintService.cs
  desktop/Sirman.Desktop/SirmanHostObject.cs
  desktop/Sirman.Desktop/AppPaths.cs
  deliveries/Reports/P0.5R6_POSTAL_LOGO_FIX_REPORT.md

UI Owner: HTML settings tab stg-company + sidebar #sb-logo
Business Owner: n/a
Domain Owner: n/a
Persistence Owner: localStorage key ll + File System Access sirman_media
Host: WriteBackupText / GetBackupDir are text-autosave only — not logo bytes
Source-of-truth class: SPLIT (HTML FSA folder vs Desktop backup roots vs company tab which never binds logo)

RunBusiness touched: NO
Persistence touched: NO
Backup schema touched: NO
Print touched: NO
LOCKED / FROZEN: NOT TOUCHED
HTML-only preserved: YES
New architecture introduced: NO

Risk: n/a (no code change)
Gate: PASS — report only
```

---

## 1. Lifecycle diagram (actual code, not intended design)

```text
[User intent]  "لوگو در اطلاعات شرکت"
      │
      ├─ TAB stg-company  (#stg-company)
      │     NO <input type=file>
      │     NO <img> for company logo
      │     Button: saveCompanyInfo()
      │     Writes ONLY localStorage['laegh_company']  (names, phone, addr, …)
      │     Does NOT read/write logoSrc or 'll'
      │
      │     ★ FIRST DIVERGENCE FOR THE STATED UI SYMPTOM ★
      │     expected: page shows the selected logo after Save
      │     actual:   there is nothing on this page that can show a logo
      │
      ├─ Adjacent tab stg-service  ("بخش خدمات")  — DIFFERENT LOGO
      │     #svc-logo-inp  →  changeServiceLogo()
      │     FileReader.readAsDataURL  →  laegh_service_center.logo
      │     Preview: #svc-logo-prev
      │     NOT the Native Postal logoSrc / 'll' path
      │
      └─ REAL company-brand logo control (not inside the company tab)
            .sb-logo click → #logo-inp  →  changeLogo()
            │
            ▼
        requireDiskOrAbort('لوگو')
            │  Desktop: isBackupFolderReady() is TRUE whenever sirmanHost.WriteBackupText exists
            │  so this gate does NOT prove a live File System Access folder
            ▼
        writeDiskBlob('sirman_media/logo'+ext, File)
            │  bytes → {FSA folder}/sirman_media/logo.{jpg|png|webp|gif}
            │  return ref = 'disk://sirman_media/logo.'+ext
            │  NO data URL on this path
            ▼
        logoSrc = ref
        localStorage.setItem('ll', ref)     // stores the REF, not bytes
        #sb-logo.src = blob: URL from resolveDiskRef / _diskUrlCache
            │
            ▼
        saveCompanyInfo()   ← user "ذخیره" on اطلاعات شرکت
            does not touch logoSrc / ll / disk file
            applyBrand()    ← text names only, not the image
            │
            ▼
        loadCompanyInfo() on settings open
            fills co-name-fa / phone / … only
            NEVER reads logoSrc
            NEVER sets any <img>
            │
            ▼  (reload / restart)
        logoSrc = localStorage.getItem('ll')     // still disk://…  (ref survives)
        boot: if disk://, do NOT assign img.src = disk://
        later: resolveDiskRef(logoSrc) → needs live autoSaveDirHandle
            │
            ▼  Native Postal (separate consumer, already diagnosed)
        NativeLogoSource.Resolve(disk://…, ExistingBackupMediaRoots())
            roots = Desktop BackupFolder (if exists)
                    + %LocalAppData%\Sirman\Backups
                    + %AppData%\Sirman\backup     (= GetBackupDir, TEXT autosave)
                    + %LocalAppData%\Sirman
            shop result: disk-missing  → file not in those roots
```

---

## 2. Answers 1–20

### 1. Exact file input / control used for company logo

**There is no company-logo file input on tab اطلاعات شرکت.**

Tab `#stg-company` (`Sirman_Final.html` ~4368–4391) is brand **text only**: `co-name-fa`, `co-name-en`, `co-tagline-fa`, `co-short`, `co-phone`, `co-email`, `co-web`, `co-tax`, `co-addr`, button `saveCompanyInfo()`.

The only control that writes the Native Postal / `logoSrc` / `ll` logo is the **sidebar**:

```html
<div class="sb-logo" onclick="document.getElementById('logo-inp').click()">
  <img id="sb-logo" …>
  <input type="file" id="logo-inp" accept="image/*" style="display:none"
         onchange="changeLogo(this)">
```

(`Sirman_Final.html` ~2108–2109.)

A **different** image lives on the next settings tab **بخش خدمات**:

- `#svc-logo-inp` → `changeServiceLogo` → `laegh_service_center.logo`
- Preview `#svc-logo-prev` **does** exist on that tab.
- Native Postal does **not** read this field (shop `logoSourceKind=disk` is the `ll` contract).

Appearance has **preview only**, not upload: `previewStoredBg('ll','لوگو')` (~4315, ~23799). That button reads `localStorage.ll` and passes it to `openDocViewer`. If `ll` is `disk://…`, the viewer gets a non-http URL, not decoded bytes.

**Shop implication:** a user standing on اطلاعات شرکت can click the sidebar logo (always visible) or can believe the service-center control is “company logo”. The company tab itself cannot accept a logo file.

### 2. Exact upload handler / function

Company-brand (Postal / `ll`): **`changeLogo`** ~11630–11646.

Service-center (not Postal): **`changeServiceLogo`** ~25310–25322 (`FileReader.readAsDataURL`).

Company Save: **`saveCompanyInfo`** ~25216 — not an upload handler.

### 3. Exact variable / property holding the logo

| Slot | What |
|---|---|
| In-memory | `let logoSrc = localStorage.getItem('ll') \|\| ''` (~7516) |
| localStorage | key **`ll`** (not `laegh_company`, not `laegh_logo` for this path) |
| Backup export | field `logoSrc` inside `exportData` (~8001); restore writes `ll` (~14366, ~14508) |
| Company JSON | `laegh_company` — **no logo field** |
| Service JSON | `laegh_service_center.logo` — separate image |
| HTML display target for brand logo | `#sb-logo` only |
| Fallback if `logoSrc` empty | huge embedded JPEG assigned into `logoSrc` (~7583) |

`getBrand()` / `applyBrand()` (~7494) apply **names**, not the image.

### 4. Exact value immediately after selecting the file

`changeLogo` does **not** keep a data URL.

On success, immediately:

```text
logoSrc = "disk://sirman_media/logo" + ext
```

`ext` from `mediaExtFromMimeOrName(f.type, f.name)` (~8814): `.png` / `.webp` / `.gif` / `.jpg` (default for `image/*`).

`#sb-logo.src` is set to a **`blob:`** object URL from `resolveDiskRef(ref)` (or `_diskUrlCache`), not to `disk://`.

If `requireDiskOrAbort` returns false: handler returns; `logoSrc` unchanged; input cleared.

If `writeDiskBlob` throws: toast `ذخیره لوگو روی هارد ناموفق: …`; `logoSrc` / `ll` **not** updated.

**Live shop value after select: NOT OBSERVED.**

### 5. Exact value after Save

`saveCompanyInfo` writes only `laegh_company` text fields and calls `applyBrand()`. It does **not** read `logoSrc` or `ll`.

After that Save:

- `logoSrc` / `ll` remain whatever `changeLogo` (or an older session) already stored.
- Native `logoSourceKind=disk` proves that, at print time, the payload `logoSrc` **was** a `disk://` string. That is consistent with a prior successful `changeLogo` / heavy-dataURL migrate, **not** with `saveCompanyInfo`.

**Live shop `logoSrc` after Save: NOT OBSERVED on this agent.**  
**Inferred from shop native diagnostic:** a `disk://sirman_media/…` string (kind=disk). Exact filename (`.jpg` vs `.png`) NOT OBSERVED.

### 6. Exact localStorage key / property

- Brand logo ref: **`ll`**
- Company text: **`laegh_company`** (no logo)
- Folder name hint only: `laegh_autosave_dir_name` (not the bytes)
- Service logo: inside **`laegh_service_center`** JSON field `logo`

### 7. Whether a data URL is created

**Brand logo current upload path: NO.** `changeLogo` writes the `File` blob via `writeDiskBlob`. No `FileReader`, no `data:`.

Data URL **is** created for:

- `changeServiceLogo` (service-center logo) — always `readAsDataURL`
- Legacy migrate: `migrateHeavyKeyToDisk('ll','sirman_media/logo.jpg')` / `storeLogoOnDisk(dataUrl)` if `ll` / `logoSrc` still hold a heavy `data:` string

Shop native `kind=disk` means the value reaching print is **not** a data URL.

### 8. Whether it is converted to `disk://sirman_media/…`

**YES**, on successful `changeLogo`:

```text
ref = DISK_REF_PREFIX + fullRel
     = "disk://" + "sirman_media/logo" + ext
```

(`writeDiskBlob` ~8876–8892; prefix `window.DISK_REF_PREFIX = 'disk://'` ~8786.)

This is the **same convention** used for backgrounds (`sirman_media/bg_app.jpg`, …) and print backgrounds (`sirman_media/print_….jpg`). The convention itself is valid.

### 9. Exact function that writes the image bytes to disk

**`writeDiskBlob(relPath, blob)`** (~8876).

Call chain for company logo:

```text
changeLogo
  → writeDiskBlob('sirman_media/logo'+ext, File)
      → mediaSafeFileName(fileName, blob.type)
      → getDiskFileHandle(fullRel, create=true)
          → ensureMediaDirHandle({silent:false})
          → dir.getDirectoryHandle('sirman_media', {create:true})
          → dir.getFileHandle(fileName, {create:true})
      → FileSystemFileHandle.createWritable()
      → write(blob) / close()
```

Not used on this path: `storeLogoOnDisk` (data-URL migrate only, forces `logo.jpg`), `host.WriteBackupText` (JSON text autosave only), `NativeWindowsPrintService`.

### 10. Exact physical target path on Windows

HTML write target is **not** `%LocalAppData%\Sirman` and **not** automatically `AppPaths.BackupFolder`.

It is:

```text
{user-picked File System Access directory}/sirman_media/logo{ext}
```

The picker is `window.showDirectoryPicker` in `chooseAutoSaveFolder` (~9502). The handle is stored in IndexedDB (`fsHandles` / kind `dir`) plus `laegh_autosave_dir_name`.

Desktop **text** autosave (`sirmanHost.WriteBackupText`) always uses:

```text
%AppData%\Sirman\backup\{fileName}
```

(`SirmanHostObject.GetBackupDir` — Roaming `\Sirman\backup`. It **creates** that directory. It does **not** follow HTML FSA. It does **not** write `sirman_media`.)

Desktop **menu** backup folder (`AppPaths.ResolveBackupFolder`):

```text
desktop-settings.json BackupFolder   OR   %LocalAppData%\Sirman\Backups
```

Native logo search (`ExistingBackupMediaRoots`):

```text
1. settings.BackupFolder          (only if that directory already exists)
2. %LocalAppData%\Sirman\Backups
3. %AppData%\Sirman\backup        (= GetBackupDir)
4. %LocalAppData%\Sirman
```

**Shop physical path of the written file: NOT OBSERVED.**  
**Native attempted path: NOT OBSERVED beyond `disk-missing`.** The first existing root + `sirman_media\logo…` is what `NativeLogoSource` would try.

### 11. Whether the target file exists after save

| Location | Existence |
|---|---|
| `{FSA folder}\sirman_media\logo{ext}` | NOT OBSERVED. `changeLogo` only assigns `logoSrc` after `writeDiskBlob` returns, so **if** the toast «لوگو روی هارد ذخیره شد» appeared, the FSA write completed in that session. |
| Native search roots | **NO** for the file native looked up — shop `disk-missing` + `FileExists = false`. |
| Company tab | N/A (no image element). |

`saveCompanyInfo` does not create or delete the media file.

### 12. Whether save / write throws or silently fails

| Call | Failure mode |
|---|---|
| `changeLogo` / `writeDiskBlob` | **Not silent.** `catch` → error toast. `logoSrc`/`ll` left unchanged. |
| `saveCompanyInfo` | Does not write the image. Cannot throw on logo I/O. Success toast is about **brand text**. |
| `requireDiskOrAbort` on Desktop | `isBackupFolderReady()` is true because `host.WriteBackupText` exists (~9613–9624), even with **no** live FSA handle. Returns **true**. The real throw is later in `ensureMediaDirHandle`: «پوشه بک‌آپ ثبت شده ولی دسترسی زنده فایل‌سیستم نیست» if `autoSaveDirHandle` is missing (~8847–8848). User would see the `changeLogo` error toast — unless they never used `#logo-inp` and only pressed company Save. |
| `resolveDiskRef` | **Soft fail.** `catch` → `addDbgEntry` + return `''`. Image src not updated. |
| Native | `disk-missing` is a resolved diagnostic, not a throw. |

### 13. Exact code that loads the logo back into the company-information page

**There is none.**

`loadCompanyInfo()` (~25235–25249) sets text inputs only.

Settings navigation calls `loadCompanyInfo()` (~11232, ~11575) and separately `loadServiceCenter()` (service logo preview only).

Brand logo reload paths (sidebar, **not** company tab):

1. Boot IIFE ~7584–7594: if `logoSrc` starts with `disk://`, **do not** set `#sb-logo.src` to `disk://`.
2. Appearance init ~25987–25990: `resolveDiskRef(logoSrc).then(u => #sb-logo.src = u)` if `isDiskRef`.
3. `changeLogo` itself sets `#sb-logo` after write.

Company-information page never participates.

### 14. Why the UI cannot display the logo after save

Two stacked facts. The **first** one is enough for the stated symptom.

**A. Company tab cannot render a logo even when `ll` and the file are valid.**  
No `<img>`, no binding to `logoSrc`. `saveCompanyInfo` success only reapplies **text** via `applyBrand()`. A user who selected a file elsewhere (sidebar) and then pressed «ذخیره و اعمال در کل برنامه» on اطلاعات شرکت will not see a logo on that page. That matches the shop report without needing a missing file.

**B. Sidebar display after restart depends on a live FSA handle.**  
`disk://` is not a browser-displayable URL. Boot deliberately leaves `#sb-logo` on the **markup default JPEG** until `resolveDiskRef` succeeds. If `autoSaveDirHandle` is not restored, the sidebar keeps the built-in default — which looks like “logo not saved”. On Desktop, failed silent IDB restore **does not** show the prefs-resume bar when `WriteBackupText` exists (~8773), so the user is not prompted to re-grant the folder.

**C. Native Postal `disk-missing` is a later, different consumer.**  
Same `disk://` ref; search roots are Desktop backup directories, not the HTML FSA handle. Explains missing print logo; does **not** create the missing `<img>` on اطلاعات شرکت.

### 15. Whether the logo works only until refresh

| Surface | Same session after `changeLogo` success | After Save on company tab | After reload / restart |
|---|---|---|---|
| اطلاعات شرکت tab | Never (no img) | Never | Never |
| Sidebar `#sb-logo` | Yes (`blob:` URL) | Unchanged (Save does not clear it) | Only if `resolveDiskRef` gets a live FSA handle |
| Appearance «پیش‌نمایش لوگو» | Fragile if `ll` is `disk://` (viewer fed the ref string) | Same | Same |
| Native Postal | n/a | n/a | Shop: disk-missing |

So: **the company-information page never shows it**, including before refresh. Sidebar **can** work only until refresh if FSA permission is lost.

### 16. Whether the logo **reference** survives application restart

**YES — the string in `ll`.** `localStorage` is origin-persistent. Shop `logoSourceKind=disk` after a later print run proves the ref survived.

**Bytes** survive on disk only in the FSA-picked folder. They are **not** copied into `GetBackupDir()` by `changeLogo`. Native restart does not re-read FSA.

IndexedDB may still hold the directory handle; WebView2 still needs permission. That is independent of `ll`.

### 17. Whether BackupFolder configuration is required

**Split answer. Do not collapse.**

- **HTML write:** a **live File System Access directory handle** is required (`ensureMediaDirHandle`). That is the settings → ذخیره خودکار «انتخاب پوشه» picker. It is **not** the same object as Desktop `BackupFolder`.
- **HTML `isBackupFolderReady()`:** on Desktop this is **already true** because `sirmanHost.WriteBackupText` exists. That does **not** mean media can be written.
- **Native resolve:** uses **existing** Desktop backup **directories** (`BackupFolder` if that path already exists, plus the three AppData roots). Native does **not** create `sirman_media`. Missing Desktop `BackupFolder` is not a defect by itself; the file simply is not in those roots.
- **`GetBackupDir()` / `WriteBackupText`:** required for **text** autosave, not for logo bytes.

Configuring Desktop `BackupFolder` does not by itself put `logo.jpg` there. Picking an HTML FSA folder that **is** one of the native roots would make print resolution work; that is a coincidence of folders, not a required BackupFolder setting.

### 18. Whether `diskRefPath` is actually called for company logo **storage**

**Not on the write path.**

`changeLogo` / `writeDiskBlob` build the ref with `DISK_REF_PREFIX + fullRel`. They never call `diskRefPath`.

`diskRefPath` **is** called on **read**:

```text
resolveDiskRef(ref)
  → getDiskFileHandle(diskRefPath(ref), false)
```

(~8897–8903.) Native `NativeLogoSource.DiskRefPath` is the C# twin of the same strip of `disk://`.

So: helper exists, is the correct convention, and is used to **open** the file for HTML `<img>`, not to **write** it.

### 19. Whether `disk://sirman_media/…` is a valid existing convention for other media

**YES.** Same prefix and folder for:

| Key / field | Relative file |
|---|---|
| `laegh_app_bg` | `sirman_media/bg_app.jpg` |
| `laegh_sb_bg` | `sirman_media/bg_sb.jpg` |
| `laegh_main_bg` | `sirman_media/bg_main.jpg` |
| `laegh_dash_bg` | `sirman_media/bg_dash.jpg` |
| print `bgImage` | `sirman_media/print_{section}.jpg` |
| docs | `sirman_media/docs/…` |
| `ll` (logo) | `sirman_media/logo{ext}` (upload) or `sirman_media/logo.jpg` (heavy migrate) |

`disk://` is valid. Native P0.5R6 already implemented this contract. Shop `disk-missing` means the **file was not found under native roots**, not that the URI scheme is illegal.

### 20. Compare logo storage with other image/media that persist and reload

| | Brand logo (`ll`) | Sidebar background (`laegh_sb_bg`) | Service-center logo |
|---|---|---|---|
| Upload control | Sidebar `#logo-inp` | Appearance `#sb-bg-inp` | `#svc-logo-inp` on **بخش خدمات** |
| Write | `writeDiskBlob` | `storeBgOnDisk` → `writeDiskDataUrl` | `FileReader` data URL into JSON |
| Stored value | `disk://sirman_media/logo{ext}` | `disk://sirman_media/bg_sb.jpg` | `data:image/…;base64,…` |
| Reload UI | `#sb-logo` via `resolveDiskRef` | `applyLayerBackgrounds` → `resolveDiskRef` → CSS `url(blob:)` | `#svc-logo-prev.src = sc.logo` (data URL works without FSA) |
| Survives restart without FSA | Ref yes, pixels no | Ref yes, pixels no | **Yes** (bytes in localStorage JSON) |
| Settings tab preview | **None on اطلاعات شرکت** | Preview buttons on appearance | **Yes** on its own tab |
| Native Postal | Yes (`logoSrc`) | No | No |

The media that **reliably** reappears in a settings page without FSA is the **service-center** data-URL logo. The brand logo uses the same disk-ref family as backgrounds: HTML display needs `resolveDiskRef`; native print needs the file under Desktop backup roots.

Extension note: backgrounds are forced to `.jpg`. Logo upload uses `mediaExtFromMimeOrName`, so PNG becomes `disk://sirman_media/logo.png`. Native uses the **stored** relative path, so `.png` is fine **if** that file exists in a searched root. Migrate-from-data-URL always writes `logo.jpg`. Not the first break for the company tab.

---

## 3. First divergence

```text
expected:
  User selects a company logo on اطلاعات شرکت, presses Save,
  the company-information UI shows that logo.

actual:
  Tab اطلاعات شرکت has no file input and no <img>.
  saveCompanyInfo() persists laegh_company text only.
  loadCompanyInfo() never reads logoSrc / ll.

FIRST DIVERGENCE:
  Binding / render on the company-information page
  (before DrawImage, before NativeLogoSource, and even if the file exists).
```

That is why classification is **E**, not C/D/F: the company-information UI would stay blank if `ll` were a valid data URL and if `{BackupFolder}\sirman_media\logo.jpg` existed.

**Second, independent break (not the classification, already seen in P0.5R6):**

```text
expected: NativeLogoSource finds {backupRoot}\sirman_media\logo{ext}
actual:   disk-missing — file not in ExistingBackupMediaRoots()

HTML wrote (if write succeeded) to the File System Access folder.
Native reads Desktop backup directories / GetBackupDir.
Those are not the same handle.
WriteBackupText never copies sirman_media.
```

This second break explains Postal `disk-missing`. It is **not** required to explain a blank اطلاعات شرکت tab.

---

## 4. Live shop values (this agent)

| Item | Value |
|---|---|
| `logoSrc` after Save | **NOT OBSERVED.** Inferred: `disk://sirman_media/…` (shop `logoSourceKind=disk`) |
| `localStorage.ll` | **NOT OBSERVED.** Same inference. |
| `localStorage.laegh_company` | **NOT OBSERVED.** No logo field in schema. |
| Resolved native path | **NOT OBSERVED.** `NativeLogoSource` would combine first existing media root + relative path from `disk://`. |
| File exists (native roots) | **NO** (shop `disk-missing`) |
| File exists (FSA folder) | **NOT OBSERVED** |
| File size | **NOT OBSERVED** |
| Why `<img>` on company page does not render | **There is no `<img>` on that page.** |

Shop check (for a later packet, not done here): DevTools `localStorage.getItem('ll')`; Explorer `{FSA folder}\sirman_media\logo*`; Explorer `%AppData%\Sirman\backup\sirman_media\` and `%LocalAppData%\Sirman\Backups\sirman_media\`.

---

## 5. Classification (exactly one)

**E — UI reload/render problem**

Rejected (with why):

| Code | Why not first |
|---|---|
| A upload conversion | `changeLogo` does not convert to data URL; native kind=disk shows a disk ref was stored. |
| B persistence / localStorage | `ll` is the correct key; shop print received `disk://`. `saveCompanyInfo` not writing `ll` is a **missing bind**, not a corrupt key. |
| C disk media write | Write errors are toasted; native kind=disk implies a prior successful `writeDiskBlob` or migrate. File may exist under FSA. |
| D disk reference / path resolution | True for **Native Postal** (`disk-missing`). Not the first break for **اطلاعات شرکت**, which never resolves `logoSrc`. `disk://` itself is a valid convention. |
| F backup folder configuration | Desktop `BackupFolder` / `GetBackupDir` are valid for text backup. They are not the HTML media handle. Assuming BackupFolder is “wrong” is forbidden and unnecessary for the company-tab blankness. |
| G other | E is specific. |

---

## 6. Minimal recommended fix (NO implementation in this packet)

Do **one** product change in a later authorized packet, smallest first:

1. **Company tab bind (E):** add a preview `<img>` on `#stg-company` that displays `logoSrc` through `resolveForDisplay` / `resolveDiskRef` (same as `#sb-logo`), and a file control that calls existing `changeLogo`. `saveCompanyInfo` should not need to copy bytes if `changeLogo` already wrote `ll`. Do not invent a second storage key.

2. **Only if Postal logo is still missing after (1) is proven on shop:** do **not** guess DrawImage. Confirm `ll` and whether `{FSA}\sirman_media\logo*` exists vs native roots. If the file is only under FSA, a later packet may copy/resolve using an **existing** backup root — without calling `disk://` wrong and without replacing Storage/Backup architecture.

Out of scope until authorized: `NativeWindowsPrintService` patches, BackupFolder redesign, version bump, data-URL return for brand logo.

---

## 7. Evidence index

| Claim | Evidence |
|---|---|
| Company tab has no logo control | `Sirman_Final.html` `#stg-company` ~4368–4391 |
| Sidebar is the brand logo input | `#logo-inp` / `changeLogo` ~2108, ~11630 |
| `saveCompanyInfo` ignores logo | ~25216–25233 — keys are name/phone/addr only |
| `loadCompanyInfo` ignores logo | ~25235–25249 |
| `logoSrc` / key `ll` | ~7516, `changeLogo` `setItem('ll')` |
| `writeDiskBlob` / `disk://` | ~8782–8910, ~11635 |
| `diskRefPath` on read only | `resolveDiskRef` ~8902 |
| `isBackupFolderReady` true via host | ~9613–9624 `h.WriteBackupText` |
| FSA vs host backup dir | `ensureMediaDirHandle` vs `SirmanHostObject.GetBackupDir` = `%AppData%\Sirman\backup` |
| Native roots / disk-missing | `NativeWindowsPrintService.ExistingBackupMediaRoots`; shop P0.5R6/R7 diagnostic |
| Service logo is a different path | `changeServiceLogo` ~25310 data URL |
| Backgrounds share disk convention | `storeBgOnDisk` ~8917; `applyLayerBackgrounds` ~26700 |
| Boot does not put `disk://` in `img.src` | ~7584–7589 |
| Desktop resume bar skipped when host exists | `restoreAutoSaveHandlesOnBoot` ~8773 |

---

## 8. FINAL

```text
Product code changed: NO
Print changed:        NO
Storage architecture changed: NO
Backup changed:       NO
Version changed:      NO

Classification: E — UI reload/render problem
First divergence: اطلاعات شرکت never reads or renders logoSrc
Native disk-missing: second, independent consumer (FSA folder ≠ Desktop backup roots)

STOP — WAIT FOR REVIEW.
```
