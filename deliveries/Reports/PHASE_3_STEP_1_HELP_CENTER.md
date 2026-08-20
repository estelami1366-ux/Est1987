# SIRMAN — PHASE 3 STEP 1: Help Center UI

**Date:** 1405/05/29 (20 August 2026 13:25 UTC)  
**Branch:** `cursor/phase-3-change-gate-3733`  
**Baseline version:** `1405.5.27γ` (not bumped)  

---

# 1. CHANGE GATE

```text
PHASE 3 CHANGE GATE

Requested change:
Improve Help Center presentation: expand/collapse all topics, search hit count, per-branch article count.

Classification:
A

Capability:
Help Center

Files expected to change:
Sirman_Final.html
Laegh_Final.html
test_laegh.js
deliveries/Reports/PHASE_3_STEP_1_HELP_CENTER.md

UI Owner:
Sirman_Final.html (#page-help)

Business Owner:
n/a

Domain Owner:
Help Center (HTML)

Persistence Owner:
HTML (untouched keys)

Host:
sirmanHost (untouched)

Source-of-truth class:
SINGLE (HTML Help UI)

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
CLASS A Help Center copy/tree/buttons only. No Core, Desktop, print, backup, Host, or localStorage key changes.
```

HEAD before this step: `68d745f` (Step 0).  
Branch match: `cursor/phase-3-change-gate-3733`.  
Worktree before edit: tracked clean; untracked `memory/2026-08-16.md`, `memory/2026-08-18.md` (not committed).  
Live version: `1405.5.27γ`.

---

# 2. OBJECTIVE

First bounded Phase 3 shop-UI change: **Help Center presentation only**. Not architecture extraction.

---

# 3. FILES CHANGED

- `Sirman_Final.html`
- `Laegh_Final.html` (byte-synced with Sirman)
- `test_laegh.js`
- `deliveries/Reports/PHASE_3_STEP_1_HELP_CENTER.md`

Files created: the report above.  
Files deleted: none.

---

# 4. EXACT HELP CHANGES

1. Toolbar on `#page-help`: buttons `help-expand-all` / `help-collapse-all` and count `help-search-count`.
2. Functions `expandAllHelpTopics`, `collapseAllHelpTopics`, `updateHelpSearchCount`, `helpNavCountText` — class toggles only; no localStorage.
3. `helpSearch` shows visible article/result count.
4. Tree labels show per-category article count.
5. `initHelpTree` keeps `next` sibling before `appendChild` so every article in a category enters the tree (needed for counts; presentation of the existing tree).
6. Existing cards, hub chips, search, tour, tickets, ratings, and all قانون ۷ copy strings left in place.

---

# 5. FILES NOT TOUCHED

- `desktop/Sirman.Core/**`
- `desktop/Sirman.Desktop/**`
- `sirmanHost` / `RunBusiness`
- print engine / Print Center / `WindowsPrintHost` / `IPrintService`
- invoice / inventory / accounting / warranty logic
- backup schema / `migrateBackup`
- localStorage / IndexedDB keys
- `SIRMAN_VERSION.json`
- Tasks, notifications, auth

`SIRMAN_PHASE_3_MASTER_CHECKLIST.md` **was not in the repository**. Per instruction, the master checklist structure was not invented. Checklist items for this step are recorded in section 12 instead.

---

# 6. TESTS RUN

- Help Center group in `test_laegh.js` (existing + one new execution test)
- `node test_laegh.js Sirman_Final.html`
- `dotnet test desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` (Core untouched; run to confirm no regression)

---

# 7. TEST RESULTS

```text
TESTS:
PASS: HTML 575 (was 574; +1 Help nav test), Core 134
FAIL: 0
SKIPPED: 0
```

---

# 8. HTML-ONLY VERIFICATION

```text
HTML-ONLY: PASS
```

New controls are `onclick` in `#page-help`. They do not call `sirmanHost`. Group 0 still executes the HTML. Help page still exists (`id="page-help"`).

---

# 9. FROZEN/LOCKED/PROTECTED CHECK

```text
FROZEN PRINT: UNTOUCHED
PERSISTENCE: UNCHANGED
LOCKED BUSINESS: UNCHANGED
PROTECTED: UNTOUCHED
```

Diff stat: only the two HTML files, `test_laegh.js`, and this report.

---

# 10. REGRESSION CHECK

```text
REGRESSION: PASS
```

HTML 575/575. Core 134/134. No unrelated files in the diff.

---

# 11. COMMIT

```text
55528bb435cb8145fad720612e2ca4c7612fccc0
```

---

# 12. FINAL STATUS

```text
COMPLETED
```

Not `VERIFIED`: no shop-PC screenshot of the Help page. Automated tests and HTML-only evidence support COMPLETED.

Master checklist file missing — items completed in this report:

| Item | When | Jalali | Evidence |
|---|---|---|---|
| Select first approved UI task | 2026-08-20 13:20 UTC | 1405/05/29 | Help Center (Change Gate §16 A) |
| Run Change Gate | 2026-08-20 13:20 UTC | 1405/05/29 | Section 1 = PASS CLASS A |
| Implement minimal change | 2026-08-20 13:25 UTC | 1405/05/29 | expand/collapse all + counts |
| Run relevant tests | 2026-08-20 13:25 UTC | 1405/05/29 | new Help nav test + Help group |
| Run regression | 2026-08-20 13:25 UTC | 1405/05/29 | HTML 575, Core 134 |
| Verify HTML-only mode | 2026-08-20 13:25 UTC | 1405/05/29 | no Host; group 0 still runs |
| Produce Markdown work report | 2026-08-20 13:25 UTC | 1405/05/29 | this file |
| Commit | after this file | 1405/05/29 | section 11 |

Dashboard, Calendar, SQLite, Print, and persistence migration were **not** started.

```text
PHASE 3 CHANGE GATE — FINAL

Requested change:
Help Center presentation (expand/collapse all + search counts)

Implementation:
DONE

Files changed:
Sirman_Final.html
Laegh_Final.html
test_laegh.js
deliveries/Reports/PHASE_3_STEP_1_HELP_CENTER.md

Files created:
deliveries/Reports/PHASE_3_STEP_1_HELP_CENTER.md

Files deleted:
(none)

Frozen modules touched:
NO

Locked behavior changed:
NO

Persistence changed:
NO

Backup schema changed:
NO

Print changed:
NO

Security changed:
NO

HTML-only preserved:
YES

Tests:
HTML 575 PASS / 0 FAIL; Core 134 PASS / 0 FAIL

Regression:
PASS

Final status:
PASS

Commit:
55528bb435cb8145fad720612e2ca4c7612fccc0
```
