سیرمان — کیت تشخیصی P0.5R4 (ساخت ۱۴۰۵/۰۶/۰۹ — 2026-08-31)
============================================================
DIAGNOSTIC ONLY. نسخه محصول عوض نشده: 1405.6.3α / 1405.6.3.1
رفتار چاپ/کاغذ/فونت/RTL عوض نشده. فقط لاگ runtime.

نصب: zip را Extract All کنید → فقط نصب.bat (یا SETUP.bat)
قبل از نصب روی سیستم فروشگاه از ورود/خروج داده بک‌آپ بگیرید.

بعد از چاپ بومی، لاگ:
  %LocalAppData%\Sirman\print\P0.5R4_NATIVE_RUNTIME.log
منو: چاپ → باز کردن پوشه لاگ چاپ
کل فایل را بدون ویرایش کپی کنید.

سه تست اول (همان چاپگر فیزیکی قبلی؛ تنظیمات نامربوط را عوض نکنید):

TEST 1 — کنترل A4
  Native Test Page / همان چاپگر / A4 / Portrait / 1 copy
  ثبت: physical=  text upright=

TEST 2 — کنترل A5  (کلید اصلی)
  Native Test Page / همان چاپگر / A5 / Portrait / 1 copy
  ثبت: physical=  text upright=

TEST 3 — برچسب پستی A5
  Native Postal Label / همان چاپگر / A5 / Portrait / 1 copy
  ثبت: physical=  text upright=  logo left/right=
       BrandEn=  Persian=  digits=
  عکس واضح از کل برگه.

شناسه: P0.5R4
ProductVersion باید شامل 0dc6aad باشد (بیلد تازه، نه کپی exe قدیمی).
SHA-256: SHA256.txt و SHA256_BINARIES.txt
