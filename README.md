# Est1987 — لایق الکترونیک پارسیان

نرم‌افزار خدمات پس از فروش (HTML تک‌تکه) + فضای کاری AutoClaw.

## نسخهٔ فعلی
`Laegh_Final.html` / `Laegh_Final_10.5.20.html` → **10.5.20**

## دستورهای مهم
```bash
node test_laegh.js Laegh_Final.html
node build.js                 # نیاز به codes.10.4.6/ هم‌خوان با split.js
node split.js <file.html>     # بازسازی پارتیشن‌ها (ماتریس باید با تعداد خطوط فایل جور باشد)
```

## ساختار
| مسیر | محتوا |
|---|---|
| `releases/` | آرشیو نسخه‌ها از ۱۰.۴.۶ تا ۱۰.۵.۲۰ |
| `archive/` | zip/rar و خروجی استخراج |
| `Laegh_SKILL.md` | قوانین اجباری تحویل |
| `Laegh_parts_INDEX.md` | نقشهٔ ماژولار (مرجع ۱۰.۴.۱۶) |
| `AGENTS.md` / `SOUL.md` / `USER.md` / `IDENTITY.md` / `MEMORY.md` | هویت و حافظهٔ ایجنت |

ارتباط توسعهٔ لایق: فارسی، مستقیم، خلاصه — طبق skill.
