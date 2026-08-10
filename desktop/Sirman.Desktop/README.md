# سیرمان دسکتاپ — فاز ۱ (پوسته .NET + HTML)

پوسته ویندوزی با **WebView2** که همان `Sirman_Final.html` را باز می‌کند.  
منطق برنامه هنوز داخل HTML است.

## پیش‌نیاز (ویندوز)

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- WebView2 Runtime (معمولاً با Microsoft Edge نصب است)

## اجرا

در PowerShell / CMD روی ویندوز:

```bat
cd desktop\Sirman.Desktop
dotnet restore
dotnet run
```

یا انتشار تک‌فایلی:

```bat
dotnet publish -c Release -r win-x64 --self-contained false -o ..\publish
```

بعد `Sirman_Final.html` را کنار `Sirman.exe` در پوشه `publish` بگذارید و `Sirman.exe` را باز کنید.

## رفتار فاز ۱

- باز کردن خودکار `Sirman_Final.html`
- فقط یک نمونه از برنامه (single-instance)
- منو: تازه‌سازی، انتخاب HTML، باز کردن پوشه برنامه
- F5 = Reload

## فازهای بعدی (هنوز نه)

- آپدیت خودکار
- نصب‌کننده
- انتقال ماژول‌ها به .NET
