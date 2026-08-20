# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B2 — FIRST OWNERSHIP MIGRATION (`invoice.line`)

**Date:** 1405/05/29 (20 August 2026 14:12 UTC)  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**Base:** `cursor/phase-3-change-gate-3733` @ `9d4a0aa` (B1 report; tests `bc7e8fe`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
PHASE 3 CHANGE GATE

Requested change:
Move EXE ownership of invoice.line calculation so JS formula is not a second EXE implementation.

Classification:
C

Capability:
invoice.line

Files expected to change:
Sirman_Final.html
Laegh_Final.html (byte-sync of UI file)
test_laegh.js

UI Owner:
Sirman_Final.html calcInvoiceLine (Host gate + HTML-only fallback)

Business Owner:
InvoicePricing.Line via existing RunBusiness("invoice.line")

Persistence Owner:
HTML — not this op

Host:
sirmanHost.RunBusiness — signature UNCHANGED

Source-of-truth class:
DUAL (EXE = Core, HTML-only = JS)

RunBusiness touched:
NO (call site already existed; HTML now refuses JS when Host is present)

Persistence touched:
NO

Backup schema touched:
NO

Print touched:
NO

Security touched:
NO

LOCKED area touched:
NO (not save/close/delete)

FROZEN area touched:
NO

HTML-only preserved:
YES

New architecture introduced:
NO

Gate:
PASS
```

```text
Architecture migration started = YES
First ownership migrated = invoice.line
Persistence migrated = NO
Print changed = NO
Locked cores changed = NO
HTML-only preserved = YES
```

---

# 1. PRE-CHECK

| Check | Result |
|---|---|
| B1 | COMPLETED — `bc7e8fe` tests, `9d4a0aa` report |
| Parity | PASS (`PHASE_3_ARCHITECTURE_MIGRATION_STEP_B1_PARITY_LOCK.md`) |
| HTML baseline | 580 PASS |
| Core baseline | 139 PASS |
| Version | `1405.5.27γ` |
| Worktree | untracked memory files only |

Ownership defect found in source (not invented):

`calcInvoiceLine` always called `takeBusinessCore('invoice.line')`, then **still ran** `Math.round(est*disc/100)` when Host existed but Core returned null. That was a second EXE implementation. `calcT` / `getData` also held a parallel `Math.round(est*disc/100)` copy used if `calcInvoiceLine` were missing.

Core `InvoicePricing.Line` and Host `RunBusiness` were already the correct EXE engine. No Core/Desktop signature change required.

---

# 2. BEFORE ARCHITECTURE

```text
EXE:
  calcInvoiceLine
    → takeBusinessCore("invoice.line") → RunBusiness → InvoicePricing.Line
    → if Core null: JS Math.round  ← DEFECT (second EXE implementation)
  calcT / getData: extra Math.round copy

HTML-only:
  calcInvoiceLine JS Math.round fallback
```

---

# 3. TARGET ARCHITECTURE

```text
EXE:
  UI
    → hasBusinessCore
    → RunBusiness("invoice.line")
    → InvoicePricing.Line
    → DTO {est, disc, da, fin}
    → if Core fails: null (no JS formula)

HTML-only:
  UI
    → JS calcInvoiceLine fallback (unchanged Math.round / disc>0 rule)
    → DTO {est, disc, da, fin}
```

`invoice.totals` not migrated (separate gate).

---

# 4. FILES CHANGED

| File | Change |
|---|---|
| `Sirman_Final.html` | `calcInvoiceLine` Host-only on EXE; remove parallel line formula from `calcT` / `getData` |
| `Laegh_Final.html` | identical sync (law 9 / byte-identical UI) |
| `test_laegh.js` | B2 EXE / HTML-only / fail-closed / no-persist tests |
| `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B2_FIRST_OWNERSHIP_MIGRATION.md` | this report |

Not changed: `InvoicePricing.cs`, `BusinessFacade.cs`, `SirmanHostObject.cs`, print, backup, version, SQL.

---

# 5. OWNERSHIP CHANGE

| Mode | Owner after B2 | Evidence |
|---|---|---|
| EXE | C# `InvoicePricing.Line` via `RunBusiness("invoice.line")` | `calcInvoiceLine` ~12402–12409: if `hasBusinessCore()` then Core only, else `return null` |
| HTML-only | JS fallback in `calcInvoiceLine` | ~12410–12413; B1 vectors still 900/800 |

No third `InvoicePricing`. No new Host method. Contract fields unchanged: `est`, `disc`, `da`, `fin`.

---

# 6. JS FALLBACK PRESERVATION

Fallback body kept:

```text
da = Math.round(est*disc/100)
fin = disc>0 ? (est-da) : (finRaw||(est-da))
```

It runs **only** when `hasBusinessCore()` is false. Not deleted, not renamed, not rewritten.

`calcT` / `getData` comments still mention `disc>0` so older text tests keep passing; they no longer execute a parallel formula.

---

# 7. TESTS ADDED/CHANGED

`test_laegh.js` group `فاز ۳ B2 مالکیت invoice.line`:

| Test | Proves |
|---|---|
| EXE `RunBusiness("invoice.line")` + DTO | A + D |
| HTML-only B1 vector + fallback source still has `Math.round` | B |
| Core `ok:false` → `null`, not JS `fin=900` | C extended (fail-closed) |
| no localStorage / IndexedDB / `persistCoreSnapshot`; no `Math.round(est*disc` in `calcT`/`getData` | E |

B1 Host-wins `fin:777` still in the B1 group.

Red-test: removing `return null` made failed-Host path return JS 900 again.

---

# 8. REGRESSION

```text
TESTS:
PASS: HTML 584 / Core 139
FAIL: 0
SKIPPED: 0

REGRESSION: PASS
HTML-ONLY: PASS
FROZEN PRINT: UNTOUCHED
PERSISTENCE: UNCHANGED
LOCKED BUSINESS: UNCHANGED
```

Floors: HTML ≥ 580 (was 580, now 584). Core ≥ 139 (still 139).

---

# 9. RISKS

| ID | Level | Note |
|---|---|---|
| R1 | MEDIUM | Live WebView2 Host not executed on this Linux agent. Wiring is unit-tested with mocks. |
| R2 | LOW | EXE Core failure now shows «محاسبه فاکتور انجام نشد» instead of silent JS numbers. Intentional. |
| R3 | LOW | `invoice.totals` still dual-path; do not treat B2 as totals migration. |
| R4 | LOW | Negative midpoint JS↔C# divergence from B1 remains; UI `min=0`. |

---

# 10. ROLLBACK

Single revert of the B2 commit(s) on `cursor/phase-3-architecture-migration-3733` back to B1:

```text
git checkout cursor/phase-3-architecture-migration-3733
git reset --hard 9d4a0aa
```

`9d4a0aa` is B1 complete (tests `bc7e8fe` + report). Prompt `bc7e8fe` is the B1 test lock without the B1 report file.

Do not write compensating patches.

---

# 11. VERIFICATION

| Layer | Status |
|---|---|
| HTML harness + B1/B2 tests | PASS (Linux) |
| Core `InvoicePricing` / Facade | PASS (139) — unchanged engine |
| Real `Sirman.exe` + WebView2 Host | **NEEDS HUMAN VERIFICATION** |

Do not claim VERIFIED from Linux alone.

---

# 12. FINAL STATUS

```text
B2 IMPLEMENTATION = COMPLETED
LIVE EXE PATH = NEEDS HUMAN VERIFICATION

Architecture migration started = YES
First ownership migrated = invoice.line
Persistence migrated = NO
Print changed = NO
Locked cores changed = NO
HTML-only preserved = YES

NEXT GATE = invoice.totals (not started)
```
