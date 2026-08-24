# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B3 — `invoice.totals` OWNERSHIP MIGRATION

**Date:** 1405/05/29 (20 August 2026 14:23 UTC)  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**B2 base commit:** `1705c7a` (`feat: migrate invoice.line ownership to core`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
PHASE 3 CHANGE GATE

Requested change:
Move EXE ownership of invoice.totals so JS sum is not a second EXE implementation.

Classification:
C

Capability:
invoice.totals

Persistence touched: NO
Print touched: NO
Backup touched: NO
Host signature: UNCHANGED
Locked workflow: NO
HTML-only preserved: YES
Gate: PASS
```

```text
Architecture migration = YES
Ownership migrated = invoice.totals
Persistence changed = NO
Print changed = NO
Backup changed = NO
Locked workflow changed = NO
HTML-only preserved = YES
```

---

# 1. PRE-CHECK

| Check | Result |
|---|---|
| B1 parity | PRESENT — `InvoicePricingParityVectors.json`, HTML/Core consumers |
| B2 | COMPLETED — commit `1705c7a`, report `PHASE_3_ARCHITECTURE_MIGRATION_STEP_B2_FIRST_OWNERSHIP_MIGRATION.md` |
| B2 HTML / Core | 584 / 139 |
| B2 persist/print/backup/close | untouched |
| Version | `1405.5.27γ` |
| Branch | `cursor/phase-3-architecture-migration-3733` |

Preconditions verified. Not BLOCKED.

---

# 2. CURRENT invoice.totals TRACE

**Before B3 (source at B2):**

```text
calcT
  per line: calcInvoiceLine (B2)
  if hostOn: takeBusinessCore("invoice.totals", {lines:[{est,disc,finRaw}]})
             → sirmanHost.RunBusiness
             → BusinessFacade "invoice.totals"
             → InvoicePricing.Line each row then InvoicePricing.Totals
             if Core null: ntf + {tE:0,tD:0,tF:0}
  if !hostOn: tE+=est; tD+=line.da; tF+=fin   ← JS totals copy #1

getData
  if hostOn: takeBusinessCore("invoice.totals", ...)
  if !hostOn: items.reduce est/da/fin         ← JS totals copy #2
```

Input DTO (unchanged): `{ lines: [{ est, disc, finRaw }] }`  
Result DTO (unchanged): `{ tE, tD, tF }`

Core path was already correct. Defect: two inlined HTML-only sums, and EXE vs fallback not named in one function (B2 pattern).

---

# 3. BEFORE ARCHITECTURE

```text
EXE:  calcT/getData → RunBusiness("invoice.totals") → InvoicePricing.Totals
      (fail → zeros / ntf; did not run reduce)
HTML-only: two separate JS sums (calcT loop vs getData reduce)
```

---

# 4. TARGET ARCHITECTURE

```text
EXE:
  calcT / getData
    → calcInvoiceTotals(lines)
    → RunBusiness("invoice.totals")
    → InvoicePricing.Totals
    → {tE,tD,tF} or null (never JS sum)

HTML-only:
  calcInvoiceTotals
    → calcInvoiceLine per row
    → tE+=est; tD+=line.da; tF+=line.fin
```

One fallback. No third `InvoicePricing`. `invoice.line` unchanged.

---

# 5. FILES CHANGED

| File | Change |
|---|---|
| `Sirman_Final.html` | add `calcInvoiceTotals`; `calcT` / `getData` call it |
| `Laegh_Final.html` | byte-sync |
| `test_laegh.js` | B3 tests; B1 calcT harness includes `calcInvoiceTotals` |
| `desktop/Sirman.Core.Tests/InvoicePricingParityVectors.json` | zero-lines, one-line-disc, one-line-no-disc |
| Report | this file |

Not changed: `InvoicePricing.cs`, `BusinessFacade.cs`, Host, print, backup, version.

---

# 6. OWNERSHIP CHANGE

| Mode | Owner | Evidence |
|---|---|---|
| EXE | C# `InvoicePricing.Totals` via `RunBusiness("invoice.totals")` | `calcInvoiceTotals` ~12416–12423 |
| HTML-only | JS loop in `calcInvoiceTotals` | ~12425–12435 |

---

# 7. FAIL-CLOSED BEHAVIOR

Host present + Core `ok:false` → `calcInvoiceTotals` returns **null**. JS sum does not run.

If `return null` is removed, result is a non-null `{tE:0,tD:0,tF:0}` (B2 line fail-closed skips rows) — B3 test `got == null` fails.

`calcT` / `getData` on null: ntf «محاسبه فاکتور انجام نشد».

---

# 8. HTML-ONLY FALLBACK

`getSirmanHostSync(){ return null }` (no mock Host). B1 totals table including new zero/one-line rows. Fallback source still contains `tE+=est`. Not deleted.

---

# 9. HOST-WINS

Mock `RunBusiness` returns `{tE:1, tD:2, tF:777777}` for the required-mix lines (JS would be `tF:1700`). UI keeps 777777.

---

# 10. TESTS

| Test | Requirement |
|---|---|
| EXE `invoice.totals` + distinctive DTO | A + Host-wins |
| HTML-only B1 totals table, no Host | HTML-only |
| Core fail → null | Fail-closed |
| no persist; `calcT`/`getData` use `calcInvoiceTotals` | E / no third sum |
| B1 calcT mock DOM still matches table | regression |

---

# 11. REGRESSION

```text
HTML: 588 PASS / 0 FAIL   (floor 584)
Core: 139 PASS / 0 FAIL   (floor 139)
REGRESSION: PASS
HTML-ONLY: PASS
PRINT: UNTOUCHED
PERSISTENCE: UNCHANGED
LOCKED BUSINESS: UNCHANGED
```

---

# 12. RISKS

| ID | Level | Note |
|---|---|---|
| R1 | MEDIUM | Live WebView2 Host not run here |
| R2 | LOW | `tot.tF==null` treats 0 as success (empty / 100% discount) |
| R3 | LOW | Do not treat B3 as invoice save/close migration |

---

# 13. ROLLBACK

B2 commit (from git): **`1705c7a`**

```text
git revert <B3-commit>
```

or reset this branch to `1705c7a`. No compensating patches.

---

# 14. VERIFICATION

| Layer | Status |
|---|---|
| HTML + Core automated | PASS |
| Real `Sirman.exe` + WebView2 | **NEEDS HUMAN VERIFICATION** |

---

# 15. FINAL STATUS

```text
B3 IMPLEMENTATION = COMPLETED
LIVE EXE PATH = NEEDS HUMAN VERIFICATION

Architecture migration = YES
Ownership migrated = invoice.totals
Persistence changed = NO
Print changed = NO
Backup changed = NO
Locked workflow changed = NO
HTML-only preserved = YES

NEXT GATE = not started (save/close/delete, persist, inventory, …)
```
