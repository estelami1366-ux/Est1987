# مجموعه رگرسیون دائمی سیرمان

تست جدید را بعد از Fix همان باگ **حذف نکن**. مجموعه اصلی:

```bash
node test_laegh.js Sirman_Final.html
dotnet test desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj
```

اگر حتی یک تست HTML یا C# Fail شد: تحویل و Merge ممنوع.

## نقشه ماژول → گروه تست HTML

حداقل هنگام تغییر آن ماژول، همان گروه و گروه‌های وابسته را سبز نگه دار.

| ماژول | گروه‌های `test_laegh.js` (نام تقریبی) |
|---|---|
| Smoke / بارگذاری | گروه ۰ |
| Backup / Restore / Migration | گروه ۲، ۵، ۱۱، ۲۲، ۲۳، α پیش‌نمایش انتخابی، موتور Backup |
| Reset | گروه ۳ |
| Customers / دفترچه | گروه ۶، ۲۵ |
| Users / Login / Security | گروه ۸، کاربران/نقش‌ها، امنیت فاز ۱، هش رمز، ۲FA |
| Warranty | گروه ۹، ۳۰، θ، عملیات گارانتی، ویزارد |
| Sales | گروه ۱۰، ۱۵، ۱۹ |
| Invoice | گروه ۲۹، ۳۴، هویت داخلی فاکتور، برگشت آثار حذف |
| Accounting / Payment | گروه ۱۶، ۲۶، برگشت آثار حذف |
| Inventory | گروه ۲۷، ۲۸، ۳۱، ۳۵، موتور Inventory |
| Printing | گروه مرکز پرینت (شامل رد PDF به‌عنوان چاپ) |
| Reports | گزارش مالی / چاپ گزارش داخلی |
| Settings / UI shell | ظاهر، اسکین، چندپنجره، قفل جلسه |
| LAN / Host | شبکه داخلی LAN، تداخل پورت اعلان |
| Core C# | `Sirman.Core.Tests` (مجوز، برگشت تراکنش، هویت) |

## رگرسیون حداقلی پیشنهادی (اگر تغییر به داده مربوط است)

- Customer
- Invoice create / edit / delete isolation
- Payment / Account
- Inventory / reversal
- Warranty
- Backup / Restore
- Restart (بارگذاری دوباره از storage)
- Printing (مسیر کد؛ کاغذ = تست انسانی)

## محیط واقعی (جایگزین تست کد نیست)

| موضوع | تست کد | تست واقعی |
|---|---|---|
| چاپ | گروه مرکز پرینت | Sirman.exe + چاپگر فیزیکی + برگه |
| بک‌آپ | گروه Backup | Restore روی سیستم فروشگاه |
| EXE | publish لینوکس | اجرای ویندوز |
