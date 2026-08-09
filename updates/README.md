# فایل‌های آپدیت سیرمان

از نسخهٔ `1405.5.18ε` به بعد، به‌جای تعویض کل HTML می‌توانید فایل آپدیت را از مسیر زیر بارگذاری کنید:

**تنظیمات → ⬆️ آپدیت → 📂 بارگذاری فایل آپدیت**

## فرمت فایل (`.sirman-update.json`)

```json
{
  "magic": "SIRMAN_UPDATE",
  "format": 1,
  "id": "شناسه-یکتا",
  "version": "1405.5.18ζ",
  "versionFa": "۱۴۰۵.۵.۱۸ζ",
  "minBaseVersion": "1405.5.18ε",
  "title": "عنوان کوتاه",
  "changelog": ["تغییر ۱", "تغییر ۲"],
  "patches": [
    { "op": "setVersion", "version": "1405.5.18ζ", "versionFa": "۱۴۰۵.۵.۱۸ζ" },
    { "op": "injectCss", "css": "/* ... */" },
    { "op": "runJs", "code": "/* کد JS */" },
    { "op": "notify", "message": "آپدیت اعمال شد" },
    { "op": "replaceAppFile", "fileName": "Sirman_Final.html", "content": "<!DOCTYPE html>..." }
  ]
}
```

- آپدیت‌های معمولی: فقط `patches` کوچک (CSS/JS/نسخه)
- آپدیت‌های بزرگ ساختاری: `replaceAppFile` که HTML کامل را دانلود می‌کند

نمونه آزمایشی: `Sirman_Update_welcome_ε.json`
