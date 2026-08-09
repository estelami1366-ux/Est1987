# فایل‌های آپدیت سیرمان

از نسخهٔ `1405.5.18ε` به بعد، به‌جای تعویض دستی HTML می‌توانید فایل آپدیت را اعمال کنید.

## دو روش برای چند کامپیوتر (حتی ۲۰۰ سیستم)

### ۱) داخل برنامه
**تنظیمات → ⬆️ آپدیت → 📂 بارگذاری فایل آپدیت**
- آپدیت کوچک: فقط پچ
- آپدیت کامل (`replaceAppFile`): همان لحظه کل برنامه عوض می‌شود

### ۲) با لانچر (بدون باز کردن تنظیمات)
1. فایل آپدیت را کپی کنید و نامش را بگذارید: `Sirman_Pending_Update.json`
2. کنار `Sirman_Start.bat` بگذارید
3. روی هر سیستم فقط `Sirman_Start.bat` را بزنید — خودکار HTML را می‌نویسد و برنامه را باز می‌کند

## فرمت

```json
{
  "magic": "SIRMAN_UPDATE",
  "format": 1,
  "id": "شناسه-یکتا",
  "version": "1405.5.18ι",
  "versionFa": "۱۴۰۵.۵.۱۸ι",
  "minBaseVersion": "1405.5.18ε",
  "title": "عنوان",
  "changelog": ["..."],
  "patches": [
    { "op": "setVersion", "version": "1405.5.18ι", "versionFa": "۱۴۰۵.۵.۱۸ι" },
    { "op": "injectCss", "css": "/* ... */" },
    { "op": "runJs", "code": "/* ... */" },
    { "op": "replaceAppFile", "fileName": "Sirman_Final.html", "content": "<!DOCTYPE html>..." },
    { "op": "notify", "message": "اعمال شد" }
  ]
}
```
