#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build a real full-HTML SIRMAN_UPDATE JSON for the current version."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("/workspace")
VER = json.loads((ROOT / "SIRMAN_VERSION.json").read_text(encoding="utf-8"))
HTML = (ROOT / "Sirman_Final.html").read_text(encoding="utf-8")
if len(HTML) < 500_000:
    raise SystemExit("HTML too small")
if f"var APP_VERSION = '{VER['app']}'" not in HTML:
    raise SystemExit("HTML version mismatch")

pkg = {
    "magic": "SIRMAN_UPDATE",
    "format": 1,
    "id": f"sirman-{VER['app']}-full",
    "version": VER["app"],
    "versionFa": VER["appFa"],
    "minBaseVersion": "1405.5.18ε",
    "title": f"آپدیت کامل {VER['appFa']}",
    "changelog": [
        "مرکز پرینت سند را به چاپگر واقعی ویندوز می‌فرستد؛ موفقیت جعلی printto حذف شد",
        "اگر چاپگر نباشد یا چاپ شکست بخورد پیام خطا می‌آید",
        "آپدیت کامل برنامه — کل Sirman_Final.html جایگزین می‌شود",
    ],
    "patches": [
        {
            "op": "setVersion",
            "version": VER["app"],
            "versionFa": VER["appFa"],
        },
        {
            "op": "replaceAppFile",
            "fileName": "Sirman_Final.html",
            "content": HTML,
        },
        {
            "op": "notify",
            "message": f"نسخه {VER['appFa']} کامل اعمال شد",
        },
    ],
}

raw = json.dumps(pkg, ensure_ascii=False, indent=2)
targets = [
    ROOT / "updates" / f"Sirman_Update_{VER['app']}.json",
    ROOT / "Sirman_Pending_Update.json",
    ROOT / "desktop" / "Sirman_Install_Kit" / "Sirman_Pending_Update.json",
    ROOT / "desktop" / "Sirman_Install_Kit" / "updates" / f"Sirman_Update_{VER['app']}.json",
    ROOT / "desktop" / "Sirman_Windows_Install" / "Sirman_Pending_Update.json",
    ROOT / "desktop" / "Sirman_Windows_Install" / "updates" / f"Sirman_Update_{VER['app']}.json",
]
for t in targets:
    t.parent.mkdir(parents=True, exist_ok=True)
    t.write_text(raw, encoding="utf-8")
    print(t, t.stat().st_size)
