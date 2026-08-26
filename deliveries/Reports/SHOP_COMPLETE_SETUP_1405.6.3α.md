# SIRMAN — COMPLETE SHOP SETUP 1405.6.3α

**Jalali:** 1405/06/03  
**Gregorian:** 25 August 2026  
**Timezone:** Asia/Tehran  
**Version:** `1405.6.3α` / assembly `1405.6.3.1`

## What this zip is

One install file for the shop PC. Not a 1KB JSON. Not a chat dump.

```text
Sirman_Setup_1405.6.3α.zip
SHA-256: 78c78200de955640c9dd3e9da6068eac8a4e4e09ca4ed2d1b34cc442566fa036
Size:    ~70 MB (self-contained .NET 8 win-x64)
```

Contains:

```text
نصب.bat / SETUP.bat
App/Sirman.exe
App/Sirman_Final.html          (~1.8 MB, live app)
App/.NET runtime               (no separate Desktop Runtime install)
App/Sirman.Core.dll            postalLabel + invoice + testPage native print
راهنمای_نصب_و_آپدیت.docx
full HTML update JSON for this same version
```

## Included product work

```text
Native Test Page
Native Invoice
P0.1 A4/A5 installed paper forms
Native Postal Label (explicit button «چاپ بومی برچسب»)
Old HTML postal path kept («🖨 پرینت برچسب»)
Disk media storage (photos on disk, not localStorage)
Word install guide
Version stamp 1405.6.3α
```

Live data remains **localStorage**. SQLite is still candidate only — not cut over.

## Install

1. Copy zip to shop Windows PC hard disk.
2. Extract All.
3. Run `نصب.bat` only.
4. Sidebar must show `۱۴۰۵.۶.۳α`.
5. WebView2 still required (usually with Edge). .NET Desktop Runtime is inside the zip.

## Tests (Linux agent)

Recorded after packing. Physical Windows print: NOT TESTED.

`PRINT_SUBMITTED != PASS`

# END
