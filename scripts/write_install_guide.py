# -*- coding: utf-8 -*-
"""Generate the from-scratch Sirman install guide (DOCX + TXT)."""
from pathlib import Path
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Inches, Cm

OUT_DOCX = Path("/workspace/راهنمای_نصب_و_آپدیت.docx")
OUT_TXT = Path("/workspace/راهنمای_نصب_از_صفر.txt")
COPIES = [
    Path("/workspace/desktop/Sirman_Install_Kit"),
    Path("/workspace/desktop/Sirman_Windows_Install"),
]

VERSION = "۱۴۰۵.۵.۲۳ν"
VERSION_LATIN = "1405.5.23ν"

TXT = f"""راهنمای نصب سیرمان از صفر
لایق الکترونیک پارسیان
نسخه جاری: {VERSION}  ({VERSION_LATIN})
تاریخ: ۱۴۰۵/۰۵/۲۳

این راهنما برای کسی است که تا حالا این برنامه را روی این کامپیوتر نصب نکرده.
از اول تا آخر بخوانید. لازم نیست برنامه‌نویس باشید.


════════════════════════════════════
۱) اول این را بخوانید — خیلی مهم
════════════════════════════════════

فایل یک‌کیلوبایتی برنامه نیست.

اگر فایلی دیدید به نام مثلاً:
  Sirman_Update_1405.5.23μ.json
  یا هر فایل داخل پوشه updates که حجمش حدود ۱ کیلوبایت است

آن فایل برنامه نیست.
با باز کردنش یا بارگذاری‌اش، نرم‌افزار نصب نمی‌شود.
آن فایل فقط می‌تواند شماره نسخه را عوض کند. خود گارانتی و فاکتور و حساب داخلش نیست.

برنامه واقعی این است:

  Sirman_Final.html
  حجم حدود ۱٫۶ مگابایت (یک میلیون و ششصد هزار بایت)
  اگر فایلی به نام HTML دیدید که چند کیلوبایت بود، فایل اشتباه است.

اگر می‌خواهید برنامه مثل نرم‌افزار ویندوز در پنجره خودش باز شود:

  Sirman.exe
  این فایل معمولاً آماده داخل گیت‌هاب نیست.
  باید با build-win.bat ساخته شود (روش ۲ پایین).

اگر فقط JSON یک‌کیلوبایتی را کپی کردید، هیچ برنامه‌ای آپدیت نشده است.


════════════════════════════════════
۲) چه چیزی باید داشته باشید
════════════════════════════════════

کل پوشه برنامه را بگیرید، نه یک فایل تکی.

حداقل این‌ها باید داخل پوشه باشد:

  Sirman_Final.html          ← خود برنامه (حدود ۱٫۶ مگابایت)
  Sirman_Start.bat           ← اجرا با یک کلیک
  نصب_میانبر_سیرمان.bat     ← ساخت آیکون دسکتاپ (اختیاری)

برای پنجره ویندوز (Sirman.exe) علاوه بر آن، پوشه نصب ویندوز را هم لازم دارید:

  desktop\\Sirman_Windows_Install
  یا desktop\\Sirman_Install_Kit

داخل آن باید باشد:
  build-win.bat
  نصب_سیرمان.bat   (یا install-sirman.bat)
  Sirman_Final.html
  پوشه Sirman.Desktop (سورس ساخت exe)

از گیت‌هاب: کل مخزن را Download ZIP کنید، یا کل پوشه را کپی کنید.
فقط فایل داخل پوشه updates را دانلود نکنید.


════════════════════════════════════
۳) روش ۱ — ساده‌ترین نصب از صفر
   (پیشنهادی برای کامپیوتر جدید)
════════════════════════════════════

این روش مرورگر را باز می‌کند. برای شروع کار فروشگاه کافی است.

گام ۱
  کل پوشه برنامه را روی کامپیوتر کپی کنید.
  مثال: Documents\\Sirman   یا   D:\\Sirman

گام ۲
  داخل پوشه، روی یکی از این دو دوبار کلیک کنید:
    • Sirman_Final.html
    • یا Sirman_Start.bat   (بهتر است)

گام ۳
  برنامه باز می‌شود.
  اگر اولین بار است، رمز مدیر سیستم را بگذارید و به خاطر بسپارید.

گام ۴ (اختیاری — آیکون دسکتاپ)
  یک‌بار فایل «نصب_میانبر_سیرمان.bat» را اجرا کنید.
  گزینه ۲ را بزنید: نصب + میانبر Start و دسکتاپ.

گام ۵
  پایین منوی راست، نسخه را ببینید.
  باید باشد: {VERSION}

تمام. برنامه نصب شد.

اگر با Sirman_Start.bat باز کردید، پنجره مشکی/پاورشل را نبندید.
برنامه از آدرس محلی باز می‌شود:
  http://127.0.0.1:8765/Sirman_Final.html


════════════════════════════════════
۴) روش ۲ — نصب با پنجره ویندوز (Sirman.exe)
════════════════════════════════════

وقتی این روش را بخواهید:
  • برنامه در پنجره خودش باز شود، نه در کروم/اج
  • هسته حساب این نسخه داخل exe است

پیش‌نیاز روی همان کامپیوتر (فقط برای ساخت exe):
  ۱) .NET 8 SDK
     https://dotnet.microsoft.com/download/dotnet/8.0
  ۲) WebView2 Runtime
     معمولاً با Microsoft Edge نصب است.
     اگر نبود:
     https://developer.microsoft.com/microsoft-edge/webview2/

مراحل:

گام ۱
  پوشه desktop\\Sirman_Windows_Install را کامل روی ویندوز کپی کنید.
  مثال: D:\\Sirman_Install

گام ۲
  داخل آن پوشه روی build-win.bat دوبار کلیک کنید.
  صبر کنید تا تمام شود.
  پوشه publish ساخته می‌شود و داخلش Sirman.exe است.

  اگر ارور داد که dotnet پیدا نشد: .NET 8 SDK نصب نیست.

گام ۳
  روی نصب_سیرمان.bat (یا install-sirman.bat) دوبار کلیک کنید.
  پنجره انتخاب پوشه باز می‌شود.
  یک پوشه خالی انتخاب کنید، مثلاً Documents\\Sirman
  اگر خواستید میانبر دسکتاپ هم ساخته شود، بگویید بله.

گام ۴
  از منوی Start برنامه «سیرمان» را باز کنید.
  یا روی Sirman.exe داخل پوشه نصب دوبار کلیک کنید.

حذف:
  منوی Start → حذف سیرمان
  یا Uninstall-Sirman.bat کنار exe


════════════════════════════════════
۵) روش ۳ — اگر Sirman.exe آماده به شما دادند
════════════════════════════════════

اگر کسی قبلاً exe را ساخته و پوشه publish را روی فلش داده:

  ۱) کل آن پوشه را کپی کنید.
  ۲) باید Sirman.exe و Sirman_Final.html کنار هم باشند.
  ۳) روی Sirman.exe دوبار کلیک کنید.

بدون HTML کنار exe، پنجره خالی یا خطا می‌دهد.


════════════════════════════════════
۶) بعد از نصب — اولین کارها
════════════════════════════════════

۱) پایین سایدبار نسخه را چک کنید: {VERSION}
۲) از منو بروید به «ورود/خروج داده» و یک بک‌آپ بگیرید.
   پوشه بک‌آپ را جایی بگذارید که گم نشود (فلش یا OneDrive).
۳) بعد کالا، قطعه و حساب را تعریف کنید. بعد فاکتور و گارانتی بزنید.

داده کجاست؟ خیلی مهم

فاکتور، گارانتی، انبار و مخاطب داخل فایل HTML نیست.
در حافظه همین مرورگر (یا همین exe) روی همین کامپیوتر ذخیره می‌شود.

  • اگر فقط فایل HTML را به کامپیوتر دیگر ببرید، آنجا برنامه خالی باز می‌شود.
  • قبل از جابه‌جایی حتماً از «ورود/خروج داده» بک‌آپ بگیرید.
  • روی کامپیوتر جدید همان بک‌آپ را با حالت «جایگزینی» برگردانید.


════════════════════════════════════
۷) اگر قبلاً برنامه را دارید — آپدیت همین نسخه
════════════════════════════════════

این بخش نصب اول نیست. فقط وقتی برنامه از قبل روی سیستم هست.

۱) از «ورود/خروج داده» بک‌آپ کامل بگیرید.
۲) فایل Sirman_Final.html جدید را جایگزین قبلی کنید.
   حجم باید حدود ۱٫۶ مگابایت باشد، نه ۱ کیلوبایت.
۳) اگر با Sirman.exe کار می‌کنید:
   HTML به‌تنهایی کافی نیست.
   exe جدید هم لازم است (دوباره build-win.bat بزنید و جایگزین کنید).
   هسته حساب این نسخه داخل پوسته ویندوز است.
۴) لانچر Sirman_Start.bat را هم اگر همراه بسته آمده جایگزین کنید.
۵) برنامه را باز کنید. نسخه پایین سایدبار باید {VERSION} باشد.
۶) لیست فاکتور و گارانتی باید همان قبلی باشد.

فایل JSON یک‌کیلوبایتی را به‌جای برنامه بارگذاری نکنید.
برای این نسخه آن فایل کافی نیست.


════════════════════════════════════
۸) فایل JSON آپدیت چیست پس؟
════════════════════════════════════

پوشه updates برای آپدیت‌های خیلی کوچک بعدی است
(مثلاً فقط یک رنگ یا یک متن).

مسیر داخل برنامه:
  تنظیمات → تب ⬆️ آپدیت → بارگذاری فایل آپدیت

یا فایل را با نام Sirman_Pending_Update.json
کنار Sirman_Start.bat بگذارید و Start را بزنید.

اگر آپدیت به‌هم ریخت:
  همان تب آپدیت → دانگرید به هسته قبلی.
  داده کسب‌وکار پاک نمی‌شود.

یادتان باشد: JSON حدود ۱ کیلوبایت = برنامه نیست.


════════════════════════════════════
۹) چطور بفهمم درست نصب شده
════════════════════════════════════

☐ حجم Sirman_Final.html حدود ۱٫۶ مگابایت است
☐ برنامه باز می‌شود و قفل نمی‌شود
☐ پایین سایدبار نسخه {VERSION} است
☐ اگر داده قبلی داشتید، فاکتور و گارانتی هنوز هستند


════════════════════════════════════
۱۰) اگر باز نشد
════════════════════════════════════

• HTML باز نمی‌شود:
  با Chrome یا Edge باز کنید. فایل را مستقیم از روی فلش قفل‌شده اجرا نکنید؛
  اول روی هارد کپی کنید.

• Sirman_Start.bat ارور می‌دهد که HTML نیست:
  Sirman_Final.html باید کنار همان BAT باشد.

• build-win.bat کار نمی‌کند:
  .NET 8 SDK نصب کنید، کامپیوتر را یک‌بار Restart کنید، دوباره بزنید.

• Sirman.exe باز می‌شود ولی صفحه سفید است:
  Sirman_Final.html را کنار exe بگذارید.
  WebView2 را نصب کنید.

• برنامه خالی است (بدون فاکتور قبلی):
  فایل برنامه داده را جابه‌جا نمی‌کند.
  بک‌آپ را از «ورود/خروج داده» برگردانید.


فایل چاپی همین راهنما: راهنمای_نصب_و_آپدیت.docx
داخل برنامه: راهنما → آپدیت نرم‌افزار → نصب از صفر
"""


def set_run_rtl(run):
    rPr = run._r.get_or_add_rPr()
    rtl = OxmlElement("w:rtl")
    rtl.set(qn("w:val"), "1")
    rPr.append(rtl)
    cs = OxmlElement("w:cs")
    rPr.append(cs)


def set_para_rtl(paragraph):
    pPr = paragraph._p.get_or_add_pPr()
    bidi = OxmlElement("w:bidi")
    bidi.set(qn("w:val"), "1")
    pPr.append(bidi)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for run in paragraph.runs:
        set_run_rtl(run)
        run.font.name = "Tahoma"
        run._element.rPr.rFonts.set(qn("w:cs"), "Tahoma")
        run._element.rPr.rFonts.set(qn("w:eastAsia"), "Tahoma")
        run.font.size = Pt(12)


def add_p(doc, text, style="Normal", bold=False, color=None, size=12):
    p = doc.add_paragraph()
    if style == "Heading 1":
        p.style = doc.styles["Heading 1"]
        size = 20
        bold = True
    elif style == "Heading 2":
        p.style = doc.styles["Heading 2"]
        size = 14
        bold = True
    elif style == "Heading 3":
        p.style = doc.styles["Heading 3"]
        size = 13
        bold = True
    run = p.add_run(text)
    run.bold = bold
    run.font.size = Pt(size)
    run.font.name = "Tahoma"
    if color:
        run.font.color.rgb = color
    set_para_rtl(p)
    return p


def add_bullets(doc, items):
    for item in items:
        p = doc.add_paragraph(item, style="List Bullet")
        set_para_rtl(p)
        for run in p.runs:
            run.font.name = "Tahoma"
            run.font.size = Pt(12)


def build_docx():
    doc = Document()
    section = doc.sections[0]
    section.right_margin = Cm(2)
    section.left_margin = Cm(2)
    section.top_margin = Cm(1.6)
    section.bottom_margin = Cm(1.6)
    sectPr = section._sectPr
    bidi = OxmlElement("w:bidi")
    bidi.set(qn("w:val"), "1")
    sectPr.append(bidi)

    add_p(doc, "راهنمای نصب سیرمان از صفر", "Heading 1")
    add_p(doc, "لایق الکترونیک پارسیان")
    add_p(doc, f"نسخه جاری نرم‌افزار: {VERSION}", bold=True)
    add_p(doc, "تاریخ: ۱۴۰۵/۰۵/۲۳")
    add_p(
        doc,
        "این راهنما برای کسی نوشته شده که تا حالا این برنامه را روی این کامپیوتر نداشته. از اول تا آخر پیش بروید.",
    )

    add_p(doc, "۱) اول این را بخوانید — فایل یک‌کیلوبایتی برنامه نیست", "Heading 2")
    add_p(
        doc,
        "اگر فایلی دیدید شبیه Sirman_Update_….json که حجمش حدود ۱ کیلوبایت است، آن فایل برنامه نیست.",
        bold=True,
        color=RGBColor(0xB4, 0x53, 0x09),
    )
    add_p(
        doc,
        "با باز کردن یا بارگذاری آن فایل، نرم‌افزار نصب نمی‌شود. آن فایل حداکثر شماره نسخه را عوض می‌کند.",
    )
    add_p(doc, "برنامه واقعی این‌هاست:", bold=True)
    add_bullets(
        doc,
        [
            "Sirman_Final.html — خود نرم‌افزار. حجم حدود ۱٫۶ مگابایت. اگر چند کیلوبایت بود، فایل اشتباه است.",
            "Sirman.exe — پنجره ویندوز (اختیاری). معمولاً آماده در گیت‌هاب نیست؛ باید با build-win.bat ساخته شود.",
        ],
    )
    add_p(
        doc,
        "اگر فقط JSON یک‌کیلوبایتی را کپی کردید، هیچ برنامه‌ای آپدیت نشده است.",
        bold=True,
    )

    add_p(doc, "۲) چه چیزی باید داشته باشید", "Heading 2")
    add_p(doc, "کل پوشه برنامه را بگیرید، نه یک فایل تکی.")
    add_p(doc, "حداقل برای روش ساده:", bold=True)
    add_bullets(
        doc,
        [
            "Sirman_Final.html  (حدود ۱٫۶ مگابایت)",
            "Sirman_Start.bat",
            "نصب_میانبر_سیرمان.bat  (برای آیکون دسکتاپ، اختیاری)",
        ],
    )
    add_p(doc, "برای پنجره ویندوز علاوه بر آن:", bold=True)
    add_bullets(
        doc,
        [
            "پوشه desktop\\Sirman_Windows_Install یا desktop\\Sirman_Install_Kit",
            "build-win.bat و نصب_سیرمان.bat",
            "پوشه Sirman.Desktop (سورس ساخت exe)",
        ],
    )
    add_p(
        doc,
        "از گیت‌هاب کل مخزن را Download ZIP کنید. فقط فایل داخل پوشه updates را دانلود نکنید.",
    )

    add_p(doc, "۳) روش ۱ — ساده‌ترین نصب از صفر (شروع سریع)", "Heading 2")
    add_p(doc, "این روش مرورگر را باز می‌کند و برای شروع کار فروشگاه کافی است.")
    add_p(doc, "گام ۱", "Heading 3")
    add_p(doc, "کل پوشه برنامه را روی کامپیوتر کپی کنید. مثال: Documents\\Sirman یا D:\\Sirman")
    add_p(doc, "گام ۲", "Heading 3")
    add_p(doc, "داخل پوشه روی Sirman_Final.html یا بهتر: Sirman_Start.bat دوبار کلیک کنید.")
    add_p(doc, "گام ۳", "Heading 3")
    add_p(doc, "برنامه باز می‌شود. اگر اولین بار است، رمز مدیر سیستم را بگذارید و به خاطر بسپارید.")
    add_p(doc, "گام ۴ — آیکون دسکتاپ (اختیاری)", "Heading 3")
    add_p(doc, "یک‌بار نصب_میانبر_سیرمان.bat را اجرا کنید و گزینه ۲ را بزنید.")
    add_p(doc, "گام ۵", "Heading 3")
    add_p(doc, f"پایین منوی راست نسخه را ببینید. باید {VERSION} باشد. تمام. برنامه نصب شد.")
    add_p(
        doc,
        "اگر با Sirman_Start.bat باز کردید پنجره مشکی را نبندید. آدرس معمولاً http://127.0.0.1:8765/Sirman_Final.html است.",
    )

    add_p(doc, "۴) روش ۲ — نصب با پنجره ویندوز (Sirman.exe)", "Heading 2")
    add_p(
        doc,
        "وقتی می‌خواهید برنامه در پنجره خودش باز شود. هسته حساب این نسخه داخل exe است؛ برای آن مسیر exe جدید لازم است.",
    )
    add_p(doc, "پیش‌نیاز (فقط برای ساخت exe)", "Heading 3")
    add_bullets(
        doc,
        [
            ".NET 8 SDK از https://dotnet.microsoft.com/download/dotnet/8.0",
            "WebView2 Runtime — معمولاً با Edge هست. اگر نبود از سایت مایکروسافت نصب کنید.",
        ],
    )
    add_p(doc, "گام‌ها", "Heading 3")
    add_bullets(
        doc,
        [
            "پوشه desktop\\Sirman_Windows_Install را کامل روی ویندوز کپی کنید.",
            "روی build-win.bat دوبار کلیک کنید تا پوشه publish و Sirman.exe ساخته شود. اگر گفت dotnet پیدا نشد، SDK نصب نیست.",
            "روی نصب_سیرمان.bat دوبار کلیک کنید، پوشه نصب را انتخاب کنید (مثلاً Documents\\Sirman)، در صورت تمایل میانبر دسکتاپ بسازید.",
            "از منوی Start «سیرمان» را باز کنید.",
        ],
    )
    add_p(doc, "حذف: منوی Start → حذف سیرمان، یا Uninstall-Sirman.bat کنار exe.")

    add_p(doc, "۵) روش ۳ — اگر Sirman.exe آماده به شما دادند", "Heading 2")
    add_bullets(
        doc,
        [
            "کل پوشه را کپی کنید.",
            "باید Sirman.exe و Sirman_Final.html کنار هم باشند.",
            "روی Sirman.exe دوبار کلیک کنید.",
        ],
    )
    add_p(doc, "بدون HTML کنار exe، پنجره خالی یا خطا می‌دهد.")

    add_p(doc, "۶) بعد از نصب — اولین کارها و جای داده", "Heading 2")
    add_bullets(
        doc,
        [
            f"نسخه پایین سایدبار را چک کنید: {VERSION}",
            "از «ورود/خروج داده» یک بک‌آپ بگیرید و جایی امن بگذارید.",
            "بعد کالا، قطعه و حساب را تعریف کنید؛ سپس فاکتور و گارانتی.",
        ],
    )
    add_p(
        doc,
        "فاکتور و گارانتی داخل فایل HTML نیست. در حافظه همین مرورگر یا همین exe روی همین کامپیوتر است.",
        bold=True,
    )
    add_bullets(
        doc,
        [
            "اگر فقط فایل را به کامپیوتر دیگر ببرید، آنجا برنامه خالی باز می‌شود.",
            "قبل از جابه‌جایی از «ورود/خروج داده» بک‌آپ بگیرید.",
            "روی کامپیوتر جدید همان بک‌آپ را با حالت جایگزینی برگردانید.",
        ],
    )

    add_p(doc, "۷) اگر قبلاً برنامه را دارید (آپدیت، نه نصب اول)", "Heading 2")
    add_bullets(
        doc,
        [
            "از «ورود/خروج داده» بک‌آپ کامل بگیرید.",
            "Sirman_Final.html جدید را جایگزین کنید (حدود ۱٫۶ مگابایت، نه ۱ کیلوبایت).",
            "اگر با exe کار می‌کنید: HTML به‌تنهایی کافی نیست. exe جدید هم لازم است (دوباره build-win.bat). هسته حساب داخل پوسته است.",
            "لانچر Sirman_Start.bat را هم اگر همراه بسته آمده جایگزین کنید.",
            f"برنامه را باز کنید. نسخه باید {VERSION} باشد و فاکتور قبلی سر جایش.",
        ],
    )
    add_p(
        doc,
        "فایل JSON یک‌کیلوبایتی را به‌جای برنامه بارگذاری نکنید. برای این نسخه کافی نیست.",
        bold=True,
        color=RGBColor(0xB4, 0x53, 0x09),
    )

    add_p(doc, "۸) فایل JSON آپدیت چیست؟", "Heading 2")
    add_p(
        doc,
        "پوشه updates فقط برای آپدیت خیلی کوچک بعدی است (مثلاً یک رنگ). مسیر: تنظیمات → تب آپدیت → بارگذاری فایل آپدیت. یا نام فایل را Sirman_Pending_Update.json بگذارید کنار Sirman_Start.bat.",
    )
    add_p(doc, "اگر آپدیت به‌هم ریخت، در همان تب از دانگرید به هسته قبلی برگردید. داده پاک نمی‌شود.")

    add_p(doc, "۹) چک درست نصب شدن", "Heading 2")
    add_bullets(
        doc,
        [
            "حجم Sirman_Final.html حدود ۱٫۶ مگابایت است.",
            "برنامه باز می‌شود و قفل نمی‌شود.",
            f"پایین سایدبار نسخه {VERSION} است.",
            "اگر داده قبلی داشتید، فاکتور و گارانتی هنوز هستند.",
        ],
    )

    add_p(doc, "۱۰) اگر باز نشد", "Heading 2")
    add_bullets(
        doc,
        [
            "HTML را با Chrome یا Edge باز کنید. اول از روی فلش روی هارد کپی کنید.",
            "اگر BAT گفت HTML نیست: Sirman_Final.html باید کنار همان BAT باشد.",
            "اگر build-win کار نکرد: .NET 8 SDK نصب کنید، یک‌بار Restart، دوباره بزنید.",
            "اگر exe صفحه سفید داد: HTML را کنار exe بگذارید و WebView2 را نصب کنید.",
            "اگر برنامه خالی است: فایل برنامه داده را جابه‌جا نمی‌کند. بک‌آپ را برگردانید.",
        ],
    )

    add_p(doc, "داخل برنامه همین متن در راهنما → آپدیت نرم‌افزار → نصب از صفر هم هست.")
    doc.save(str(OUT_DOCX))


def main():
    OUT_TXT.write_text(TXT, encoding="utf-8-sig")
    build_docx()
    for folder in COPIES:
        folder.mkdir(parents=True, exist_ok=True)
        (folder / OUT_DOCX.name).write_bytes(OUT_DOCX.read_bytes())
        (folder / OUT_TXT.name).write_bytes(OUT_TXT.read_bytes())
    print("wrote", OUT_DOCX, OUT_DOCX.stat().st_size)
    print("wrote", OUT_TXT, OUT_TXT.stat().st_size)


if __name__ == "__main__":
    main()
