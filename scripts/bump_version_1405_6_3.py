#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Stamp live product to Jalali today 1405/06/03 → 1405.6.3α."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path("/workspace")
OLD_APP = "1405.6.2α"
OLD_APP_FA = "۱۴۰۵.۶.۲α"
OLD_DATE = "1405/06/02"
NEW_APP = "1405.6.3α"
NEW_APP_FA = "۱۴۰۵.۶.۳α"
NEW_DATE = "1405/06/03"
NEW_ASM = "1405.6.3.1"
OLD_ASM = "1405.6.2.1"


def bump_html(path: Path) -> None:
    t = path.read_text(encoding="utf-8")
    protected: list[str] = []

    def prot(s: str) -> str:
        key = f"@@PROT{len(protected)}@@"
        protected.append(s)
        return key

    t = t.replace("<li><b>۱۴۰۵.۶.۲α:</b>", prot("<li><b>۱۴۰۵.۶.۲α:</b>"))
    t = t.replace("— 1405.6.2α", prot("— 1405.6.2α"))
    t = t.replace(OLD_APP, NEW_APP)
    t = t.replace(OLD_APP_FA, NEW_APP_FA)
    t = t.replace(OLD_DATE, NEW_DATE)
    for i, s in enumerate(protected):
        t = t.replace(f"@@PROT{i}@@", s)
    needle = "<li><b>۱۴۰۵.۶.۲α:</b>"
    insert = (
        "<li><b>۱۴۰۵.۶.۳α:</b> کیت نصب کامل فروشگاه: چاپ بومی فاکتور، صفحه آزمایش و برچسب پستی، "
        "ذخیره رسانه روی هارد، راهنمای ورد. داده زنده همان localStorage است.</li>\n    "
    )
    if needle in t and "<li><b>۱۴۰۵.۶.۳α:</b>" not in t:
        t = t.replace(needle, insert + needle, 1)
    path.write_text(t, encoding="utf-8")
    text = path.read_text(encoding="utf-8")
    if f"var APP_VERSION = '{NEW_APP}'" not in text:
        raise SystemExit(f"HTML version stamp failed: {path}")


def main() -> None:
    html = ROOT / "Sirman_Final.html"
    bump_html(html)
    shutil.copyfile(html, ROOT / "Laegh_Final.html")

    ver = {
        "app": NEW_APP,
        "appFa": NEW_APP_FA,
        "assembly": NEW_ASM,
        "date": NEW_DATE,
        "letter": "α",
        "letterIndex": 1,
        "note": "منبع واحد شماره نسخه. HTML از app، پوسته ویندوز از assembly. حرف یونانی α یعنی اولین انتشار همان روز شمسی.",
    }
    (ROOT / "SIRMAN_VERSION.json").write_text(
        json.dumps(ver, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    props = ROOT / "desktop" / "Directory.Build.props"
    p = props.read_text(encoding="utf-8")
    props.write_text(p.replace(OLD_ASM, NEW_ASM).replace(OLD_APP, NEW_APP), encoding="utf-8")

    sqlite = ROOT / "desktop" / "Sirman.Persistence.Sqlite" / "SqliteCandidateDatabase.cs"
    sqlite.write_text(sqlite.read_text(encoding="utf-8").replace(OLD_APP, NEW_APP), encoding="utf-8")

    for rel in ("Sirman_Start.bat", "OPEN_SIRMAN.bat"):
        bat = ROOT / rel
        bat.write_text(bat.read_text(encoding="utf-8").replace(OLD_APP, NEW_APP), encoding="utf-8")

    ps1 = ROOT / "sirman_run.ps1"
    ps1.write_text(ps1.read_text(encoding="utf-8").replace(OLD_APP, NEW_APP), encoding="utf-8")

    tests = ROOT / "test_laegh.js"
    tj = tests.read_text(encoding="utf-8")
    tj = tj.replace(
        "test('نسخه ۱۴۰۵.۶.۲α باید Year.Month.Day شمسی با حرف یونانی همان روز باشد و در meta/سایدبار/بک‌آپ یکسان باشد'",
        "test('نسخه ۱۴۰۵.۶.۳α باید Year.Month.Day شمسی با حرف یونانی همان روز باشد و در meta/سایدبار/بک‌آپ یکسان باشد'",
    )
    tj = tj.replace("assertEqual(ver.app, '1405.6.2α'", f"assertEqual(ver.app, '{NEW_APP}'")
    tj = tj.replace("assertEqual(ver.assembly, '1405.6.2.1'", f"assertEqual(ver.assembly, '{NEW_ASM}'")
    tj = tj.replace("assertEqual(ver.appFa, '۱۴۰۵.۶.۲α'", f"assertEqual(ver.appFa, '{NEW_APP_FA}'")
    tests.write_text(tj, encoding="utf-8")

    print("bumped", NEW_APP, NEW_ASM)


if __name__ == "__main__":
    main()
