# نقشه‌ی ماژولار فایل Laegh_Final (نسخه ۱۰.۴.۱۶)

فایل اصلی `Laegh_Final_10.4.16.html` (۷۶۶۴ خط) به‌صورت **ماژولار/منطقی** به **۳۱ پارتیشن مستقل** در پوشه‌ی `codes.10.4.6/` تقسیم شده است. هر پارتیشن یک واحد منطقی کامل است (یک صفحه، یک ماژول JS، یا کل CSS) — هیچ تابعی بین دو پارتیشن بریده نمی‌شود.

برخلاف تقسیم مکانیکی قبلی (هر ۵۰۰ خط)، این تقسیم روی مرزهای طبیعی کد (شروع/پایان page div، شروع تابع) انجام شده تا ویرایش هر بخش مستقل و امن باشد.

## گردش‌کار توسعه (مهم)

```bash
# ۱) ویرایش پارتیشن مورد نظر در codes.10.4.6/ (با هر ویرایشگر)
# ۲) بازسازی فایل نهایی + تأیید خودکار:
node build.js
#    → خروجی: Laegh_Final.html
#    → تأیید byte-identical با Laegh_Final_10.4.16.html (اگر فایل منبع دست‌نخورده باشد)
#
# ۳) اجرای تست‌ها روی خروجی:
node test_laegh.js Laegh_Final.html
#    → باید همه ✅ باشند قبل از تحویل
#
# ۴) (فقط هنگام بازسازی از صفر) تقسیم دوباره:
node split.js
```

⚠️ **قانون مهم:** `build.js` تأیید می‌کند خروجی با فایل مرجع یکسان است. اگر ویرایشی کرده‌ای که عمداً محتوا را عوض می‌کند (مثلاً افزودن ویژگی)، این تأیید طبیعتاً «متفاوت» گزارش می‌دهد — آن‌جا باید از `--no-verify` استفاده کنی یا فایل مرجع را به‌روز کنی، و به `test_laegh.js` تکیه کنی.

## ساختار نام‌گذاری پارتیشن‌ها

`<order:2digit><layer:H|J>_<name>.<ext>`

- **order** (دو رقم اول): ترتیب مطلق در فایل نهایی — مرتب‌سازی لغوی همین ترتیب را می‌دهد.
- **layer**: `H` = HTML (لایه‌ی نمایش)، `J` = JavaScript (لایه‌ی منطق).
- **ext**: `.html` یا `.js`.

مثال: `14J_core.js` = پارتیشن ۱۴م در ترتیب، از لایه‌ی JavaScript، نام «core».

## نقشه‌ی کامل پارتیشن‌ها

### لایه‌ی HTML — نمایش (۱۴ پارتیشن، خطوط ۱–۲۶۳۶)

| فایل | خطوط | محتوا |
|---|---|---|
| `00H_head_css.html` | ۱–۳۷۷ | DOCTYPE، `<head>`، meta نسخه (`app-version`)، بارگذاری XLSX، **کل CSS اصلی** (تم، صفحه‌بندی، فرم‌ها، مودال‌ها) |
| `01H_shell_sidebar.html` | ۳۷۸–۵۶۱ | `<body>`، overlay ورود، ناحیه‌ی اعلان، **سایدبار کامل** (با nav-it و بج‌ها)، مودال‌های اولیه (حساب/واریز/برداشت)، باز شدن `<div class="main">` |
| `02H_page_invoice.html` | ۵۶۲–۶۵۲ | صفحه‌ی **فاکتور جدید** + **فاکتورهای ذخیره‌شده** |
| `03H_page_inventory.html` | ۶۵۳–۷۳۳ | **مدیریت کالاها** + **انبار کالا** + **انبار معیوب** |
| `04H_page_contacts.html` | ۷۳۴–۷۹۷ | **دفترچه تلفن** + **برچسب پستی** |
| `05H_page_parts_svcs.html` | ۷۹۸–۸۴۱ | **قطعات** + **خدمات** |
| `06H_page_sales.html` | ۸۴۲–۹۶۱ | **فروش چندقلمی** |
| `07H_page_accounts.html` | ۹۶۲–۱۰۱۲ | **حسابداری** |
| `08H_page_warranty.html` | ۱۰۱۳–۱۲۱۸ | **پرونده گارانتی** |
| `09H_page_dataio.html` | ۱۲۱۹–۱۲۹۱ | **ورود/خروج داده** (بک‌آپ) |
| `10H_page_settings.html` | ۱۲۹۲–۱۸۶۴ | **تنظیمات** (بزرگ‌ترین صفحه: پرینتر، ظاهر، شرکت، امنیت، دسترسی، AI، پیامک، زمان) |
| `11H_page_tasks.html` | ۱۸۶۵–۲۰۱۴ | **وظایف و یادآوری** + **تاریخ‌وتقویم** + **حسابرسی** |
| `12H_page_help.html` | ۲۰۱۵–۲۳۱۳ | **راهنمای درختی** کامل (قانون ۷) + بسته‌شدن `</div class="main">` |
| `13H_modals.html` | ۲۳۱۴–۲۶۳۶ | **همه‌ی مودال‌های دوم**: نقش/دسترسی، کالا، انبار، معیوب، پیام، قطعه، خدمت، مرتب‌سازی، حذف با رمز، کاغذ، دفترچه، جزئیات |

### لایه‌ی JavaScript — منطق (۱۷ پارتیشن، خطوط ۲۶۳۷–۷۶۶۴)

| فایل | خطوط | توابع/state اصلی |
|---|---|---|
| `14J_core.js` | ۲۶۳۷–۳۳۱۰ | state اولیه (invoices, products, ...)، autosave، `ntf`/`fmt`/`faNum`، **توابع تاریخ/تقویم تهران** (`fdate`, `gregorian_to_jalali`، date-picker)، `showPage`/سایدبار، utils، پیام به مشتری/SMS |
| `15J_invoice.js` | ۳۳۱۱–۳۶۱۰ | `addDev`، `calcT`، `getData`، `saveInv`، چاپ/اکسل/ورد فاکتور، لیست ذخیره‌شده (`renderSaved`) |
| `16J_products_inv.js` | ۳۶۱۱–۳۷۱۰ | مدیریت کالا (`saveProd`، `renderProds`)، انبار (`renderInv`) |
| `17J_phonebook.js` | ۳۷۱۱–۳۸۸۵ | دفترچه تلفن کامل (`openPBModal`، `renderPB`، `PB_CATS`)، برچسب پستی |
| `18J_dataio.js` | ۳۸۸۶–۴۳۴۳ | **بک‌آپ کامل**: `exportData`، `migrateBackup`، `importData`، `resetAll`، ورود اکسل کالا |
| `19J_tasks.js` | ۴۳۴۴–۴۷۱۵ | **ماژول وظایف** (`svTasks`، `saveTask`، `renderTasks`)، اعلان‌ها، **Service Worker** (`registerLaeghSW`) |
| `20J_auth.js` | ۴۷۱۶–۴۹۳۵ | globals قطعات/خدمات/گارانتی/فروش/...، **سیستم نقش‌ها و ورود** (`attemptLogin`، `applyRoleRestrictions`، `saveRole`)، `ALL_PAGES`/`ALL_PAGE_KEYS` |
| `21J_parts_svcs.js` | ۴۹۳۶–۵۰۳۷ | قطعات (`svParts`، `savePart`، `renderParts`) + خدمات (`saveSvc`، `renderSvcs`) |
| `22J_defective_audit.js` | ۵۰۳۸–۵۳۰۲ | کپی/مرتب‌سازی/حذف دستگاه، رمز مدیر (`setAdminPw`)، **حسابرسی/عملیات** (`auditUser`، `renderAuditLog`)، **انبار معیوب** |
| `23J_calendar_help.js` | ۵۳۰۳–۵۴۱۲ | صفحه‌ی تقویم (`renderCalPage`)، درخت راهنما (`initHelpTree`)، tooltip |
| `24J_warranty.js` | ۵۴۱۳–۵۷۵۴ | **پرونده گارانتی کامل** (`addWDev`، `showWarForm`، `saveWar`، `renderWar`)، چاپ A5 (`buildWarA5`) |
| `25J_sales.js` | ۵۷۵۵–۶۱۸۶ | **فروش کامل** (`openSaleForm`، `saveSale`، `renderSales`)، اکسل فروش، انتقال به برچسب پستی |
| `26J_accounts.js` | ۶۱۸۷–۶۵۳۱ | **حسابداری کامل** (`renderAccounts`، `depositToAccount`، `withdrawFromAccount`)، اکسل حساب‌ها |
| `27J_settings.js` | ۶۵۳۲–۶۸۹۰ | تنظیمات پرینت (`savePrintSettings`)، اطلاعات شرکت، **ظاهر برنامه** (`applyAppearanceSettings`، تم، فونت، پس‌زمینه) |
| `28J_debug_ai.js` | ۶۸۹۱–۷۳۴۰ | **عیب‌یابی/Debug** (`translateError`، `runFullDiag`)، **دستیار هوش مصنوعی** (`selectAiModel`، `callExternalAI`) |
| `29J_excel_import.js` | ۷۳۴۱–۷۶۳۸ | ورود/خروج اکسل همه‌ی ماژول‌ها (دفترچه/قطعات/خدمات/گارانتی/فروش)، نمونه‌های اکسل |
| `30J_init.js` | ۷۶۳۹–۷۶۶۴ | init نهایی (`updateLiveClock`، `setInterval`، `registerLaeghSW`) + `</script></body></html>` |

## راهنمای سریع «دنبال چی می‌گردی؟»

| می‌خوام تغییر بدم... | پارتیشن HTML | پارتیشن JS |
|---|---|---|
| ظاهر/استایل کلی | `00H_head_css.html` | — |
| سایدبار یا منو | `01H_shell_sidebar.html` | `14J_core.js` (`showPage`, `renderSidebarBadges`) |
| فاکتور | `02H_page_invoice.html` | `15J_invoice.js` |
| کالاها / انبار | `03H_page_inventory.html` | `16J_products_inv.js` |
| انبار معیوب | `03H_page_inventory.html` | `22J_defective_audit.js` |
| دفترچه تلفن | `04H_page_contacts.html` | `17J_phonebook.js` |
| برچسب پستی | `04H_page_contacts.html` | `17J_phonebook.js` |
| قطعات | `05H_page_parts_svcs.html` | `21J_parts_svcs.js` |
| خدمات | `05H_page_parts_svcs.html` | `21J_parts_svcs.js` |
| فروش | `06H_page_sales.html` | `25J_sales.js` |
| حسابداری | `07H_page_accounts.html` | `26J_accounts.js` |
| گارانتی | `08H_page_warranty.html` | `24J_warranty.js` |
| بک‌آپ/بازگردانی/ریست | `09H_page_dataio.html` | `18J_dataio.js` |
| تنظیمات (هر تب) | `10H_page_settings.html` | `27J_settings.js` |
| ظاهر برنامه (تم/فونت) | `10H_page_settings.html` | `27J_settings.js` (`applyAppearanceSettings`) |
| وظایف/یادآوری | `11H_page_tasks.html` | `19J_tasks.js` |
| تقویم/ساعت تهران | `11H_page_tasks.html` | `14J_core.js` (`fdate`, `gregorian_to_jalali`) + `23J_calendar_help.js` |
| حسابرسی/ثبت عملیات | `11H_page_tasks.html` | `22J_defective_audit.js` |
| راهنما (قانون ۷) | `12H_page_help.html` | `23J_calendar_help.js` (`initHelpTree`) |
| مودال‌ها (نقش/کالا/...) | `13H_modals.html` | بسته به مودال (در پارتیشن JS همان ماژول) |
| ورود کاربران/نقش‌ها | `13H_modals.html` (role-modal) | `20J_auth.js` |
| اعلان دسکتاپ/SW | — | `19J_tasks.js` + `sw.js` (فایل جدا) |
| عیب‌یاب/AI | `10H_page_settings.html` | `28J_debug_ai.js` |
| ورود/خروج اکسل | بسته به ماژول | `29J_excel_import.js` |
| شماره نسخه | `00H_head_css.html` (meta) + چند تابع پرینت در JS | `15J_invoice.js` و دیگر پارتیشن‌های چاپ |

## یادآوری قوانین پروژه (در هر ویرایش)

- **قانون ۱:** قبل از تحویل، `node test_laegh.js Laegh_Final.html` باید همه ✅ باشد.
- **قانون ۲:** نسخه به فرمت `Major.ماه‌شمسی.روز‌شمسی` — در صورت تغییر، هم‌زمان در meta (`00H_head_css.html`)، سایدبار (`01H_shell_sidebar.html`)، فیلد `version` در بک‌آپ (`18J_dataio.js`)، و نام فایل نهایی به‌روز شود.
- **قانون ۳:** فقط یک فایل HTML نهایی تحویل داده می‌شود (ساختار ماژولار فقط برای توسعه‌ئه؛ `build.js` فایل واحد را می‌سازد).
- **قانون ۴:** هر تغییری در `exportData`/`importData`/`migrateBackup` باید با یک فایل بک‌آپ قدیمی تست شود.
- **قانون ۵:** `resetAll` همیشه قبل از پاک‌سازی، بک‌آپ کامل اجباری می‌گیرد.
- **قانون ۷:** هر ویژگی جدید، راهنمای خودش را در `12H_page_help.html` (+ گره‌ی راهنما در `23J_calendar_help.js` اگر لازم است) بگیرد.
