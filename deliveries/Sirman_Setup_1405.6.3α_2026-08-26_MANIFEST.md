# SIRMAN setup package manifest — 2026-08-26

```text
Build date:
2026-08-26

Build time:
06:06:02

Timezone:
UTC

Product version:
1405.6.3α

Assembly version:
1405.6.3.1

Branch:
cursor/final-build-2026-08-26-fa01

HEAD:
a10eab8 (packaging)
Approved product source: 2ef63e9

P0.1 included:
YES

P0.5 included:
YES

Storage database included:
NO

Canonical storage:
current localStorage/runtime

Print:
Native Test Page
Native Invoice
Native Postal Label
HTML Postal Label rollback/preview
```

## Package files

- Archive: `deliveries/Sirman_Setup_1405.6.3α_2026-08-26.zip`
- SHA-256 file: `deliveries/Sirman_Setup_1405.6.3α_2026-08-26.sha256`
- Installer format: existing zip kit (`نصب.bat` / `SETUP.bat`); no MSI
- Packer: `scripts/pack_sirman_setup.py` (self-contained win-x64)

## Archive SHA-256

```text
39abb917bc3bbc134e027f476902a6425ac6a457aad72731d7f1cc2c362b165d
```

Size: 72475487 bytes (69.1 MiB)

## Staging checks

- `sirman.sqlite` in package: NO
- `.git` in package: NO
- migration candidate DB: NO
- secrets/credentials scan (staging tree): none found
- `Sirman.exe`, `Sirman_Final.html`, WebView2 Core DLL, `نصب.bat`: present
- Packaged HTML byte-identical to source `Sirman_Final.html`: YES
