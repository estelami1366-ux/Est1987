---
summary: "Long-term memory record"
autoclaw.schema: "agent-profile/v1"
human.name: "MOHAMAMD"
human.call: "MOHAMAMD"
human.timezone: "Asia/Tehran"
human.focus:
  - "coding"
  - "Laegh Electronic Parsian"
agent.name: "AutoClaw"
agent.role: "AI coworker"
agent.style:
  - "sharp"
  - "resourceful"
  - "no-nonsense"
agent.emoji: "🦞"
notes.project:
  - "Laegh Electronic Parsian — سیستم خدمات پس از فروش (single-file HTML)"
notes.workflow:
  - "Follow Laegh_SKILL.md / .agents/skills/laegh-software-workflow before any Laegh edit or delivery"
notes.memory:
  - "Latest delivered app version in workspace: 10.5.20"
notes.tools:
  - "node build.js / node split.js / node test_laegh.js; sw.js for PWA notifications"
lessons:
  - "Confirm before making risky changes"
  - "Persist important facts so they survive the session"
  - "Never deliver Laegh without green test_laegh.js"
  - "Version = Major.JalaliMonth.JalaliDay — always check real Jalali date"
---

# MEMORY.md — Long-Term Memory

## 主人信息
- **Name**: MOHAMAMD
- **Timezone**: Asia/Tehran
- **Language**: فارسی با کاربر (طبق skill لایق)؛ پروفایل USER.md فعلاً English
- **First online**: 2026-07-03

## 身份
- **AutoClaw** — AI coworker 🦞
- **Creature**: sharp, resourceful, no-nonsense
- **Emoji**: 🦞

## 当前项目
- **نام**: لایق الکترونیک پارسیان (Laegh Electronic Parsian)
- **نوع**: نرم‌افزار واقعی خدمات پس از فروش — فایل HTML تک‌تکه
- **نسخه فعلی در workspace**: `10.5.20` (`Laegh_Final.html` / `Laegh_Final_10.5.20.html`)
- **آرشیو نسخه‌ها**: `releases/` از 10.4.6 تا 10.5.20
- **ابزارها**: `build.js`, `split.js`, `test_laegh.js`, `sw.js`, `اجرای لایق.bat`
- **قوانین اجباری**: `Laegh_SKILL.md` و `.agents/skills/laegh-software-workflow/SKILL.md`
- **نقشه ماژولار (مرجع ۱۰.۴.۱۶)**: `Laegh_parts_INDEX.md`
- **توجه**: ماتریس `split.js` فعلی با `Laegh_Final_10.4.16.html` (۷۶۶۳ خط) هم‌خوان نیست؛ برای نسخهٔ بزرگ‌تر نوشته شده. zip قدیمی `codes.10.4.6` فقط پارتیشن‌های متنی مکانیکی دارد → `archive/codes_legacy_txt/`

## 系统架构
- **محصول نهایی**: یک HTML + استثنای توافق‌شده `sw.js`
- **زمان**: Asia/Tehran + تقویم شمسی/میلادی
- **ذخیره**: localStorage (+ IndexedDB برای tasks/SW)
- **تست**: `node test_laegh.js <file>` قبل از هر تحویل

## 工作流
- ویرایش پارتیشن‌ها → `node build.js` → `node test_laegh.js` → تحویل `Laegh_Final_X.Y.Z.html`
- ارتباط با کاربر: فارسی، مستقیم، خلاصه

## 记忆系统架构
OpenClaw سه لایه:
1. **MEMORY.md** — حافظه بلندمدت
2. **memory/YYYY-MM-DD.md** — لاگ روزانه
3. **sessions/** — تاریخچه کوتاه‌مدت

## 重要教训
1. Confirm before making risky changes
2. Persist important facts so they survive the session
3. از دست رفتن داده قبلاً در این پروژه رخ داده — بک‌اپ/migration حیاتی است
4. نسخه را با تاریخ شمسی واقعی بساز، نه تاریخ نمونه

## 技能索引
- `.agents/skills/laegh-software-workflow/SKILL.md`
- مسیر دسکتاپ Autoclaw (از AGENTS.md): `C:\Users\M.A.Estelami\.openclaw-autoclaw\skills\`
