# SIRMAN — PHASE 3 STEP 2: Dashboard Read-Only Presentation

**Date:** 1405/05/29 (20 August 2026 13:31 UTC)  
**Branch:** `cursor/phase-3-change-gate-3733`  
**Baseline version:** `1405.5.27γ` (not bumped)  
**Previous step:** Help Center `55528bb435cb8145fad720612e2ca4c7612fccc0`  

---

# 1. CHANGE GATE

```text
PHASE 3 CHANGE GATE

Requested change:
Group existing Dashboard KPIs into read-only sections (open work vs sales/finance) and add a display-only lead line.

Classification:
B

Capability:
Dashboard

Files expected to change:
Sirman_Final.html
Laegh_Final.html
test_laegh.js
deliveries/Reports/PHASE_3_STEP_2_DASHBOARD.md

UI Owner:
Sirman_Final.html (#page-dashboard, renderDashboard)

Business Owner:
unchanged (existing filters only)

Domain Owner:
Dashboard HTML

Persistence Owner:
HTML (untouched keys)

Host:
sirmanHost (untouched)

Source-of-truth class:
SINGLE (in-memory arrays already used by renderDashboard)

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
CLASS B read-only presentation. Existing shortcut DnD and hide-widgets writes were not redesigned. KPI formulas unchanged.
```

Branch: `cursor/phase-3-change-gate-3733`.  
HEAD before edit: `41aae21`.  
Step 1 commit: PRESENT.  
Version: `1405.5.27γ`.  
Worktree: untracked memory notes only (not committed).

---

# 2. OBJECTIVE

Second bounded Phase 3 shop-UI change: **Dashboard presentation only, strictly read-only.**

---

# 3. DASHBOARD BASELINE

`#page-dashboard` / `renderDashboard()` already:

- reads `invoices`, `warranties`, `parts`, `tasks`, `sales`, `accounts`
- renders six KPIs in `.dash-kpi-grid`
- renders read-only daily ops brief
- renders alerts + recent activity (`showPage` navigation only)

Existing **write** paths on the dashboard *page* (left unchanged):

| Handler | What it writes | This step |
|---|---|---|
| `toggleDashWidgets` | `laegh_dash_hide_widgets` | not modified |
| `onDashDrop` / shortcut remove | shortcut prefs | not modified |

`renderDashboard` itself did not persist. It still does not.

---

# 4. EXACT CHANGES

1. CSS: `.dash-lead`, `.dash-section-title`
2. `renderDashboard` HTML: lead line + two KPI groups (`کارهای باز` / `فروش و مالی`)
3. Same six `_dashKpi` cards, same labels, same numbers, same `showPage` targets
4. Daily brief, alerts, recent activity unchanged
5. Test: groups render, live arrays unchanged, `writesNow()===0`

No new calculations. No new Host. No `RunBusiness`.

---

# 5. READ-ONLY ANALYSIS

```text
read existing arrays
→ same KPI filters as before
→ render UI
```

New code paths do **not**:

- mutate domain objects
- `localStorage.setItem`
- IndexedDB
- backup
- print
- `RunBusiness`

Verified by harness: `H.writesNow()===0` and `JSON.stringify(live)` unchanged after `runDash`.

---

# 6. FILES CHANGED

- `Sirman_Final.html`
- `Laegh_Final.html` (synced)
- `test_laegh.js`
- `deliveries/Reports/PHASE_3_STEP_2_DASHBOARD.md`

Created: the report. Deleted: none.

---

# 7. FILES NOT TOUCHED

Core, Desktop, Host, print, backup, version file, Help Center (this step), Calendar.

Master checklist file still absent in repo — not invented.

---

# 8. TESTS RUN

- New dashboard grouping test
- Existing dashboard + daily-ops tests
- `node test_laegh.js Sirman_Final.html`
- `dotnet test desktop/Sirman.Core.Tests`

---

# 9. TEST RESULTS

```text
TESTS:
PASS: HTML 576 (was 575; +1), Core 134
FAIL: 0
SKIPPED: 0
```

---

# 10. HTML-ONLY VERIFICATION

```text
HTML-ONLY: PASS
```

`renderDashboard` still uses in-page arrays and `onclick=showPage`. No `sirmanHost`.

---

# 11. FROZEN/LOCKED/PROTECTED CHECK

```text
FROZEN PRINT: UNTOUCHED
PERSISTENCE: UNCHANGED
LOCKED BUSINESS: UNCHANGED
PROTECTED: UNTOUCHED
```

---

# 12. REGRESSION CHECK

```text
REGRESSION: PASS
```

Diff only the two HTML files, `test_laegh.js`, and this report.

---

# 13. COMMIT

Filled after git commit.

---

# 14. MASTER CHECKLIST UPDATE

File not in repository. Step 2 items recorded here:

| Item | When | Jalali | Evidence |
|---|---|---|---|
| Select second approved UI task | 2026-08-20 13:29 UTC | 1405/05/29 | Dashboard CLASS B |
| Run Change Gate | 2026-08-20 13:29 UTC | 1405/05/29 | Section 1 PASS |
| Inspect Dashboard baseline | 2026-08-20 13:29 UTC | 1405/05/29 | Section 3 |
| Implement minimal change | 2026-08-20 13:31 UTC | 1405/05/29 | KPI grouping + lead |
| Verify read-only behavior | 2026-08-20 13:31 UTC | 1405/05/29 | writesNow=0; live JSON unchanged |
| Run relevant tests | 2026-08-20 13:31 UTC | 1405/05/29 | new grouping test |
| Run full HTML regression | 2026-08-20 13:31 UTC | 1405/05/29 | 576 PASS |
| Run Core regression | 2026-08-20 13:31 UTC | 1405/05/29 | 134 PASS |
| Verify HTML-only mode | 2026-08-20 13:31 UTC | 1405/05/29 | no Host |
| Produce Markdown report | 2026-08-20 13:31 UTC | 1405/05/29 | this file |
| Commit | after this file | 1405/05/29 | section 13 |

---

# 15. FINAL STATUS

```text
COMPLETED
```

Not VERIFIED (no shop screenshot). Calendar / SQLite / Print not started.

```text
PHASE 3 CHANGE GATE — FINAL

Requested change:
Dashboard read-only KPI grouping

Implementation:
DONE

Frozen / locked / persist / print / security:
NO

HTML-only preserved:
YES

Tests:
HTML 576 PASS; Core 134 PASS

Regression:
PASS

Final status:
PASS

Commit:
(pending)
```
