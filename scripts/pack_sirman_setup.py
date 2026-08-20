#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pack a clean one-click Sirman setup zip. No old HTML versions, no 1KB JSON-as-app."""
from __future__ import annotations

import json
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path("/workspace")
VER = json.loads((ROOT / "SIRMAN_VERSION.json").read_text(encoding="utf-8"))
APP = VER["app"]
APP_FA = VER["appFa"]
KIT_NAME = f"Sirman_Setup_{APP}"
OUT_DIR = ROOT / "deliveries" / KIT_NAME
ZIP_PATH = ROOT / f"{KIT_NAME}.zip"
PUBLISH = Path("/tmp/sirman-fd-publish")
TEMPLATES = ROOT / "scripts" / "setup-kit"


def must_exist(p: Path) -> Path:
    if not p.is_file():
        raise SystemExit(f"missing: {p}")
    return p


def copy_file(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def publish_exe() -> None:
    csproj = ROOT / "desktop" / "Sirman.Desktop" / "Sirman.Desktop.csproj"
    if PUBLISH.exists():
        shutil.rmtree(PUBLISH)
    cmd = [
        "dotnet",
        "publish",
        str(csproj),
        "-c",
        "Release",
        "-r",
        "win-x64",
        "--self-contained",
        "false",
        "-p:EnableWindowsTargeting=true",
        "-p:DebugType=none",
        "-p:DebugSymbols=false",
        "-o",
        str(PUBLISH),
    ]
    print("publishing", " ".join(cmd))
    subprocess.check_call(cmd)


def pack() -> None:
    html = must_exist(ROOT / "Sirman_Final.html")
    size = html.stat().st_size
    if size < 500_000:
        raise SystemExit(f"HTML too small to be the app: {size}")
    publish_exe()
    if not (PUBLISH / "Sirman.exe").is_file():
        raise SystemExit("Sirman.exe missing after publish")

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    app_dir = OUT_DIR / "App"
    app_dir.mkdir(parents=True)

    for p in PUBLISH.rglob("*"):
        if p.is_dir():
            continue
        if p.suffix.lower() in {".xml", ".pdb"}:
            continue
        if p.name in {"createdump", "Sirman_Final.html"}:
            continue
        rel = p.relative_to(PUBLISH)
        copy_file(p, app_dir / rel)

    pending = must_exist(ROOT / "Sirman_Pending_Update.json")
    upd = must_exist(ROOT / "updates" / f"Sirman_Update_{APP}.json")
    apply_ps = must_exist(ROOT / "apply_sirman_update.ps1")
    if pending.stat().st_size < 500_000 or upd.stat().st_size < 500_000:
        raise SystemExit("update JSON too small — kit must ship the full HTML update, not a 1KB setVersion file")
    pend_ver = json.loads(pending.read_text(encoding="utf-8")).get("version")
    upd_ver = json.loads(upd.read_text(encoding="utf-8")).get("version")
    if pend_ver != APP or upd_ver != APP:
        raise SystemExit(f"update version mismatch: pending={pend_ver} upd={upd_ver} app={APP}")

    copy_file(html, app_dir / "Sirman_Final.html")
    copy_file(html, app_dir / f"Sirman_Final_{APP}.html")
    copy_file(ROOT / "Sirman_Start.bat", app_dir / "Sirman_Start.bat")
    copy_file(ROOT / "OPEN_SIRMAN.bat", app_dir / "OPEN_SIRMAN.bat")
    copy_file(ROOT / "sirman_run.ps1", app_dir / "sirman_run.ps1")
    copy_file(apply_ps, app_dir / "apply_sirman_update.ps1")
    copy_file(pending, app_dir / "Sirman_Pending_Update.json")
    copy_file(upd, app_dir / "updates" / f"Sirman_Update_{APP}.json")
    copy_file(upd, OUT_DIR / "updates" / f"Sirman_Update_{APP}.json")
    copy_file(ROOT / "desktop" / "Uninstall-Sirman.bat", app_dir / "Uninstall-Sirman.bat")
    if (ROOT / "نصب_میانبر_سیرمان.bat").is_file():
        copy_file(ROOT / "نصب_میانبر_سیرمان.bat", app_dir / "نصب_میانبر_سیرمان.bat")
    if (ROOT / "Sirman_Install_Shortcuts.ps1").is_file():
        copy_file(ROOT / "Sirman_Install_Shortcuts.ps1", app_dir / "Sirman_Install_Shortcuts.ps1")
    copy_file(ROOT / "SIRMAN_VERSION.json", app_dir / "SIRMAN_VERSION.json")

    for name in ("نصب.bat", "SETUP.bat", "install-setup.ps1"):
        copy_file(must_exist(TEMPLATES / name), OUT_DIR / name)

    start = (
        f"نصب سیرمان — کیت کامل {APP_FA}\n"
        "================================\n\n"
        "فایل‌ها را یکی‌یکی کپی نکنید.\n\n"
        "۱) این پوشه را از zip بیرون بکشید (Extract All).\n"
        "۲) فقط روی فایل «نصب.bat» (یا SETUP.bat) دوبار کلیک کنید.\n"
        "۳) پوشه نصب را انتخاب کنید (پیشنهاد: Documents\\Sirman).\n"
        "۴) میانبر دسکتاپ را تأیید کنید.\n"
        "۵) از منوی Start یا آیکون دسکتاپ «Sirman» را باز کنید.\n\n"
        "برنامه واقعی Sirman_Final.html است (حدود ۱٫۶ مگابایت) به‌همراه Sirman.exe.\n"
        f"این کیت خودش نسخه {APP_FA} است — بعد از نصب آپدیت جدا لازم نیست.\n"
        f"فایل آپدیت همین نسخه داخل App\\updates\\Sirman_Update_{APP}.json است\n"
        "(حدود ۱٫۶ مگابایت، کل برنامه). فایل یک‌کیلوبایتی برنامه نیست.\n"
        "اگر روی پوشه نصب قدیمی نصب کنید، همان فایل Pending قدیمی ۱ کیلوبایتی را عوض می‌کند.\n\n"
        "اگر .NET 8 Desktop Runtime روی ویندوز نباشد، Sirman.exe باز نمی‌شود.\n"
        "در آن صورت از داخل پوشه نصب Sirman_Start.bat را بزنید،\n"
        "یا Runtime را از سایت مایکروسافت نصب کنید:\n"
        "https://dotnet.microsoft.com/download/dotnet/8.0\n"
        "(همان صفحه: Desktop Runtime 8، ویندوز x64)\n\n"
        "داده (فاکتور/گارانتی) داخل فایل برنامه نیست.\n"
        "قبل از نصب روی سیستم جدید از «ورود/خروج داده» بک‌آپ بگیرید.\n"
    )
    (OUT_DIR / "00_اینجا_شروع_کنید.txt").write_text(start, encoding="utf-8-sig")
    guide_txt = ROOT / "راهنمای_نصب_از_صفر.txt"
    guide_docx = ROOT / "راهنمای_نصب_و_آپدیت.docx"
    if guide_txt.is_file():
        copy_file(guide_txt, OUT_DIR / guide_txt.name)
        copy_file(guide_txt, app_dir / guide_txt.name)
    if guide_docx.is_file():
        copy_file(guide_docx, OUT_DIR / guide_docx.name)
        copy_file(guide_docx, app_dir / guide_docx.name)

    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for p in OUT_DIR.rglob("*"):
            if p.is_file():
                zf.write(p, arcname=str(Path(KIT_NAME) / p.relative_to(OUT_DIR)))

    exe = app_dir / "Sirman.exe"
    print("kit", OUT_DIR)
    print("zip", ZIP_PATH, ZIP_PATH.stat().st_size)
    print("html", size, "exe", exe.stat().st_size)


if __name__ == "__main__":
    pack()
