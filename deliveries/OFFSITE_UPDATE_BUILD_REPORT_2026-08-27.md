# SIRMAN — OFFSITE 01 UPDATE BUILD 2026-08-27
## Packaging only — version remains 1405.6.3α

```text
Packet date:
2026-08-27

Build date:
2026-08-29

Build time:
07:01:57

Timezone:
UTC

Product version:
1405.6.3α

Assembly version:
1405.6.3.1

Branch:
cursor/offsite-01-update-2026-08-27-fa01

HEAD:
9071ce0

Approved source HEAD:
225a92a

P0.5R source commit:
deaae6a

P0.5R present:
YES

HTML Sirman:
648/648

HTML Laegh:
648/648

Core:
206/206

Update package:
deliveries/Sirman_Update_1405.6.3α_2026-08-27.json

Size:
1874890 bytes

SHA-256:
b082937b8ec1d17bddc30eec2533dc57d1d827b159b16a8e511991d3d719a15a

Database included:
NO

SQLite canonical:
NO

Source changed during packaging:
NO

Physical print:
NOT VERIFIED — SHOP TEST REQUIRED
```

---

## Git gate (verified, not assumed)

This VM checkout started on `cursor/shop-complete-setup-fa01` @ `2ef63e9`, which does **not** contain P0.5R (`ResolvedPaperSpec` absent).

Fetched remotes and packaged from the approved P0.5R product HEAD:

```text
Approved product branch:
origin/cursor/p0-5r-document-paper-contract-fa01

Approved source HEAD:
225a92a  docs: stamp P0.5R paper-contract report HEAD deaae6a

P0.5R commit:
deaae6a  fix: document-owned native paper spec; postal default A5

Checkpoint:
HEAD before fcc7a5f (P0.6 forensic)
HEAD after  deaae6a (P0.5R product)

Worktree after checkout:
clean (unrelated dirt not present on this checkout)
```

New packaging branch created from that HEAD (no merge / rebase / reset / cherry-pick of product commits).

---

## Version (not bumped)

```text
SIRMAN_VERSION.json app:        1405.6.3α
SIRMAN_VERSION.json assembly:   1405.6.3.1
Directory.Build.props Version:  1405.6.3.1
InformationalVersion:           1405.6.3α
Update JSON version:            1405.6.3α
```

---

## P0.5R presence

```text
ResolvedPaperSpec                         desktop/Sirman.Core/Printing/NativePrintPaper.cs
NativePrintPaper.DocumentDefaultPaper     postalLabel → A5
printEngineOverrideJob                    Sirman_Final.html / Laegh_Final.html
Postal default A5                         HTML + C# document default
A4 Office cannot silently override postal lastDocId must match this document
P0.1 installed A4/A5 form resolution      NativePrintLayout.TrySelectInstalledIsoForm reused in Resolve
```

Payload of the update JSON contains the same HTML (byte-equal to `Sirman_Final.html`).

---

## Tests (this packet)

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 648
  ✅ موفق: 648
  ❌ ناموفق: 0

node test_laegh.js Laegh_Final.html
  کل تست‌ها: 648
  ✅ موفق: 648
  ❌ ناموفق: 0

dotnet test desktop/Sirman.Core.Tests -c Release
  Passed!  Failed: 0, Passed: 206, Skipped: 0, Total: 206
```

This environment had no `dotnet` on PATH. SDK 8.0.424 was installed to `$HOME/.dotnet` only to run the required Core tests. Product source was not changed.

---

## How the package was built

Existing tooling: `python3 scripts/write_full_update_json.py`

Then copied to the dated path required by this packet. The packer was not rewritten.

```text
deliveries/Sirman_Update_1405.6.3α_2026-08-27.json
deliveries/Sirman_Update_1405.6.3α_2026-08-27.sha256
```

Same payload also written by the existing packer to the undated version filename convention.

GitHub blob UI hides files over 1 MB. Companion shop zip (same JSON, DEFLATE, ASCII name):

```text
deliveries/SHOP_UPDATE_ONLY/Sirman_Update_1405.6.3a_2026-08-27.zip
Size:    461925 bytes
SHA-256: c2f4453b79dc8739cab76003fbdad1de204a1ef7114e62d93a948d54fe5416a4
```

---

## Package content check

```text
Update file size:          1874890 bytes  (not a 1KB placeholder)
Application payload size:  1827642 bytes
magic:                     SIRMAN_UPDATE
id:                        sirman-1405.6.3α-full
payload == Sirman_Final.html: YES
sirman.sqlite in JSON:     NO
P1 candidate DB:           NO
tests / pycache / secrets: NO
```

Import path: Settings → تب ⬆️ آپدیت → «بارگذاری فایل آپدیت».

This JSON replaces HTML only. C# `NativePrintPaper` lives in `Sirman.exe`. This packet did not rebuild the Windows kit.

---

## Database safety

```text
sirman.sqlite included:    NO
SQLite canonical:          NO
localStorage:              current runtime SoT
dual-write:                NO
```

---

## Physical print

```text
Physical print: NOT VERIFIED — SHOP TEST REQUIRED
Linux agent cannot run Sirman.exe or a Windows printer.
PRINT_SUBMITTED is not physical PASS.
```

---

## Final status

```text
READY FOR SHOP UPDATE
```
