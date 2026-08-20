# SIRMAN — PHASE 3 STEP 3: DateTime / Calendar Chrome

**Date:** 1405/05/29 (20 August 2026 13:35 UTC)  
**Branch:** `cursor/phase-3-change-gate-3733`  
**Baseline version:** `1405.5.27γ` (not bumped)  
**Previous step:** Dashboard `27810dd2311645917b138c7f71bc60c31f789c3b`  

---

# 1. CHANGE GATE

```text
PHASE 3 CHANGE GATE

Requested change:
Improve page-datetime chrome: lead copy, today/selected legend, selected-day label. No timezone or Jalali engine change.

Classification:
A

Capability:
DateTime / Calendar page chrome

Files expected to change:
Sirman_Final.html
Laegh_Final.html
test_laegh.js
deliveries/Reports/PHASE_3_STEP_3_DATETIME.md

UI Owner:
Sirman_Final.html (#page-datetime)

Business Owner:
n/a

Domain Owner:
DateTime HTML chrome

Persistence Owner:
laegh_tz via setTimeZone (untouched)

Host:
sirmanHost (untouched)

Source-of-truth class:
SINGLE (existing TZ + in-memory calPageState)

RunBusiness touched:
NO

Persistence touched:
NO

Backup schema touched:
NO

Print touched:
NO

Security touched:
NO

LOCKED area touched:
NO

FROZEN area touched:
NO

PROTECTED boundary touched:
NO

HTML-only preserved:
YES

New architecture introduced:
NO

New transport introduced:
NO

New persistence introduced:
NO

New business implementation introduced:
NO

Risk:
LOW

Gate:
PASS

Reason:
CLASS A presentation on existing page-datetime. setTimeZone / laegh_tz / Core Jalali / renderCalPage math not modified.
```

Branch match: YES.  
HEAD before edit: `30b1141`.  
Step 2 commit: PRESENT.  
Version: `1405.5.27γ`.

---

# 2. OBJECTIVE

Third bounded Phase 3 shop-UI change: **DateTime / Calendar page presentation only.**

---

# 3. DATETIME BASELINE

`#page-datetime` already had:

- live clock `#dt-live-big` / `#dt-live-sub` / `#dt-tz-label`
- Jalali/Gregorian calendar grid `#cal-page-grid`
- month nav, mode toggle, in-memory `calPageState`

Existing **write** (not on this chrome, left unchanged):

| Function | Key | This step |
|---|---|---|
| `setTimeZone` | `laegh_tz` | not modified |

`calPageNav` / `calToggleMode` / `calPickDay` only mutate `calPageState` in memory.

---

# 4. EXACT CHANGES

1. Lead `.dt-chrome-lead`: clock/calendar read the current time center; timezone is changed in Settings, not here; day pick is not saved.
2. Legend `#cal-legend` for today vs selected (matches existing `.day.today` / `.day.sel` styles).
3. Selected-day label wording: «روز انتخاب‌شده در همین صفحه (ذخیره نمی‌شود)»
4. CSS for lead + legend.

Unchanged: `renderCalPage` conversion, `setTimeZone`, `laegh_tz`, Core `CalculationEngine`, IDs of clock/grid/selects.

---

# 5. WRITE / PERSISTENCE ANALYSIS

No new write path. No new localStorage key.  
`renderCalPage` / nav / toggle / pick still have no `localStorage.setItem`.  
`setTimeZone` still the only TZ persist, semantics unchanged.

---

# 6. FILES CHANGED

- `Sirman_Final.html`
- `Laegh_Final.html` (synced)
- `test_laegh.js`
- `deliveries/Reports/PHASE_3_STEP_3_DATETIME.md`

Created: the report. Deleted: none.

---

# 7. FILES NOT TOUCHED

Core, Desktop, Host, print, backup, dashboard, help (this step), `SIRMAN_VERSION.json`.

Master checklist file still absent — not invented.

---

# 8. TESTS RUN

- Existing TZ / calendar conversion tests
- New page-datetime chrome test
- `node test_laegh.js Sirman_Final.html`
- `dotnet test desktop/Sirman.Core.Tests`

---

# 9. TEST RESULTS

```text
TESTS:
PASS: HTML 577 (was 576; +1), Core 134
FAIL: 0
SKIPPED: 0
```

---

# 10. HTML-ONLY VERIFICATION

```text
HTML-ONLY: PASS
```

No Host. Clock/calendar still use existing `ftime` / `fdate` / `TZ` in the page.

---

# 11. FROZEN/LOCKED/PROTECTED CHECK

```text
FROZEN PRINT: UNTOUCHED
PERSISTENCE: UNCHANGED (laegh_tz same)
LOCKED BUSINESS: UNCHANGED
PROTECTED: UNTOUCHED
```

---

# 12. REGRESSION CHECK

```text
REGRESSION: PASS
```

Diff is the two HTML files, `test_laegh.js`, and this report.

---

# 13. COMMIT

```text
e07b41f83734df9178d461406a7e44df7d994b64
```

---

# 14. MASTER CHECKLIST UPDATE

| Item | When | Jalali | Evidence |
|---|---|---|---|
| Select third approved UI task | 2026-08-20 13:35 UTC | 1405/05/29 | DateTime chrome CLASS A |
| Run Change Gate | 2026-08-20 13:35 UTC | 1405/05/29 | Section 1 PASS |
| Inspect DateTime baseline | 2026-08-20 13:35 UTC | 1405/05/29 | Section 3 |
| Implement minimal change | 2026-08-20 13:36 UTC | 1405/05/29 | lead + legend + label |
| Verify write/persistence safety | 2026-08-20 13:36 UTC | 1405/05/29 | no new keys; setTimeZone untouched |
| Run relevant tests | 2026-08-20 13:36 UTC | 1405/05/29 | new chrome test + TZ test |
| Run full HTML regression | 2026-08-20 13:36 UTC | 1405/05/29 | 577 PASS |
| Run Core regression | 2026-08-20 13:36 UTC | 1405/05/29 | 134 PASS |
| Verify HTML-only mode | 2026-08-20 13:36 UTC | 1405/05/29 | no Host |
| Produce Markdown report | 2026-08-20 13:36 UTC | 1405/05/29 | this file |
| Commit | after this file | 1405/05/29 | section 13 |

---

# 15. FINAL STATUS

```text
COMPLETED
```

Not VERIFIED (no shop screenshot). SQLite / Print / Core extraction not started.

```text
PHASE 3 CHANGE GATE — FINAL

Requested change:
DateTime/Calendar page chrome

Implementation:
DONE

Persistence changed:
NO

HTML-only preserved:
YES

Tests:
HTML 577 PASS; Core 134 PASS

Regression:
PASS

Final status:
PASS

Commit:
e07b41f83734df9178d461406a7e44df7d994b64
```
