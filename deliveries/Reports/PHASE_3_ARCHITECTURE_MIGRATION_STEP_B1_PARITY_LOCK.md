# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B1 — Invoice Pricing JS↔C# Parity Lock

**Mode:** TEST-ONLY  
**Architecture migration:** NOT implemented  
**Date:** 1405/05/29 (20 August 2026 14:03 UTC)  
**Branch:** `cursor/phase-3-change-gate-3733`  
**HEAD (tests commit):** `bc7e8fe`  
**Live version:** `1405.5.27γ` (unchanged)  

```text
PHASE 3 CHANGE GATE

Requested change:
Lock existing invoice.line / invoice.totals calculation contract with a shared JS↔C# vector table. Tests only.

Classification:
C (existing contract — test lock; no signature change)

Capability:
invoice.line + invoice.totals

Files expected to change:
test_laegh.js
desktop/Sirman.Core.Tests/InvoicePricingParityTests.cs
desktop/Sirman.Core.Tests/InvoicePricingParityVectors.json
desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj

UI Owner:
Sirman_Final.html calcInvoiceLine / calcT (UNCHANGED)

Business Owner:
InvoicePricing via BusinessFacade (UNCHANGED)

Domain Owner:
InvoicePricing.Line / Totals (UNCHANGED)

Persistence Owner:
HTML localStorage — not this op

Host:
sirmanHost.RunBusiness (UNCHANGED)

Source-of-truth class:
DUAL

RunBusiness touched:
NO (called by existing tests only; Host method not edited)

Persistence touched:
NO

Backup schema touched:
NO

Print touched:
NO

Security touched:
NO

LOCKED area touched:
NO (pricing calc only; invoice save/close/delete untouched)

FROZEN area touched:
NO

PROTECTED boundary touched:
NO (RunBusiness not modified)

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
Test-only lock of an existing dual-path calculation. No product source.
```

---

# 1. BASELINE

Recorded before B1 test files were added (HEAD then `5fb2b7aa252aff6f332e37bbe66e5304be6c183b`):

| Check | Result |
|---|---|
| Branch | `cursor/phase-3-change-gate-3733` |
| Worktree | CLEAN except untracked `memory/2026-08-16.md`, `memory/2026-08-18.md` |
| Version | `1405.5.27γ` |
| HTML floor | 577 PASS |
| Core floor | 134 PASS |
| A1–A6 | `deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_A1_A6.md` — first seam = `invoice.line` + `invoice.totals`; IMPLEMENTATION READY = NO for product extraction |

Product files inspected, not edited: `Sirman_Final.html` `calcInvoiceLine` (~12398), `calcT` (~12370); `desktop/Sirman.Core/Business/InvoicePricing.cs`; `desktop/Sirman.Core/Application/BusinessFacade.cs` `"invoice.line"` / `"invoice.totals"`; existing `InvoicePricingTests` in `BusinessCoreTests.cs`; existing HTML Phase 2 / 2B tests in `test_laegh.js` ~8999–9054.

---

# 2. VECTOR TABLE

Shared file (one table, two consumers):

`desktop/Sirman.Core.Tests/InvoicePricingParityVectors.json`

Id: `SIRMAN_PHASE_3_B1_INVOICE_PRICING_PARITY`

### Line (`est`, `disc`, `da`, `fin`)

| id | est | disc | finRaw | da | fin | Why |
|---|---|---|---|---|---|---|
| disc-10 | 1000 | 10 | 9999 | 100 | 900 | Required |
| disc-0-manual-fin | 1000 | 0 | 800 | 0 | 800 | Required |
| zero-est | 0 | 10 | 9999 | 0 | 0 | Zero estimate; `disc>0` uses `est-da` |
| zero-disc-zero-fin | 1000 | 0 | 0 | 0 | 1000 | Zero-like `finRaw` → `est-da` (`finRaw\|\|` / `finRaw != 0`) |
| disc-100 | 1000 | 100 | 9999 | 1000 | 0 | 100% discount |
| decimal-est | 1000.5 | 10 | 0 | 100 | 900.5 | Decimal estimate; `round(100.05)=100` |
| round-half-1.5 | 15 | 10 | 0 | 2 | 13 | `.5` → 2 |
| round-half-0.5 | 5 | 10 | 0 | 1 | 4 | `.5` → 1 |
| round-half-0.5-small | 1 | 50 | 0 | 1 | 0 | `0.5` → 1 |
| round-half-0.5-pct | 25 | 2 | 0 | 1 | 24 | `0.5` → 1 |
| below-half | 7 | 7 | 0 | 0 | 7 | `0.49` → 0 |
| manual-fin-decimal | 1000 | 0 | 800.5 | 0 | 800.5 | Keep decimal `finRaw` when `disc==0` |

### Totals (`tE`, `tD`, `tF`)

| id | lines | tE | tD | tF |
|---|---|---|---|---|
| required-mix | disc-10 + disc-0-manual-fin | 2000 | 100 | 1700 |
| rounding-mix | 15/10 + 5/10 + 1000/0/800 | 1020 | 3 | 817 |
| decimal-and-full-disc | 1000.5/10 + 1000/100 | 2000.5 | 1100 | 900.5 |

Negatives were **not** frozen. Invoice inputs use `min="0"` (`Sirman_Final.html` ~12280). Probe showed JS `Math.round(-1.5) === -1` vs C# `JsRound(-1.5) === -2`. Per B1 rules: do not invent a clamp; do not choose a winner; do not include that path in the lock. See §6 / §10.

No new business rule: every expected value was taken from the current JS HTML-only formula and confirmed against `InvoicePricing.Line` / `Totals`.

---

# 3. JS TESTS

File: `test_laegh.js` group `فاز ۳ B1 قفل برابری invoice.line / invoice.totals` (~9056–9145).

| Test | What it runs |
|---|---|
| `جدول بردار مشترک JS↔C# باید روی calcInvoiceLine HTML-only قفل شود` | Loads JSON; `getSirmanHostSync(){return null}`; real `calcInvoiceLine` via `extractFunctionSource` |
| `مسیر جمع calcT بدون Host باید همان Totals جدول B1 را بدهد` | Real `calcT` on `buildMockDocument()` with `dN_est/_disc/_fin`; Host null |
| `قفل B1 باید HTML-only و Host-wins قبلی را نگه دارد و نیم‌واحد مثبت را گرد کند` | `fin=900`; `da` 1.5→2 and 0.5→1; mock Host `fin:777` still wins |

Helpers: `loadInvoicePricingParityVectors()`, `makeHtmlOnlyInvoiceLine()`.

Existing Phase 2 / 2B tests (~8999–9054) were not removed.

Red-test (temp mutated `Math.round` → `Math.floor` inside extracted `calcInvoiceLine` only): **4 vectors failed** (`round-half-1.5`, `round-half-0.5`, `round-half-0.5-small`, `round-half-0.5-pct`). Assertions are not tautologies.

---

# 4. C# TESTS

File: `desktop/Sirman.Core.Tests/InvoicePricingParityTests.cs`

| Test | Target |
|---|---|
| `Line_MatchesFrozenVectors` | `InvoicePricing.Line` |
| `Totals_MatchesFrozenVectors` | `InvoicePricing.Totals` on Line outputs |
| `Facade_InvoiceLine_UsesSameFieldNamesAndVectors` | `BusinessFacade.Run("invoice.line")` fields `est`,`disc`,`da`,`fin` |
| `Facade_InvoiceTotals_UsesSameFieldNamesAndVectors` | `BusinessFacade.Run("invoice.totals")` fields `tE`,`tD`,`tF` |
| `JsRound_PositiveMidpoint_MatchesMathRound` | `CalculationEngine.JsRound` 0.5→1, 1.5→2, 0.49→0 |

Existing `InvoicePricingTests` in `BusinessCoreTests.cs` kept.

csproj copies `InvoicePricingParityVectors.json` to output (`CopyToOutputDirectory`).

---

# 5. PARITY RESULT

```text
PARITY = PASS
```

On every frozen (non-negative) vector:

- JS `calcInvoiceLine` HTML-only = table
- JS `calcT` HTML-only = table totals
- C# `InvoicePricing.Line` / `Totals` = table
- C# `BusinessFacade` `invoice.line` / `invoice.totals` = table + DTO names

No genuine mismatch on the locked domain. Negative midpoint divergence exists **outside** the table (documented, not “fixed”).

---

# 6. ROUNDING RESULT

```text
ROUNDING (locked domain, est≥0, disc≥0) = EQUIVALENT
```

| Side | Implementation | Evidence |
|---|---|---|
| JS | `Math.round(est*disc/100)` in `calcInvoiceLine` ~12402 | HTML-only path |
| C# | `CalculationEngine.JsRound` = `(int)Math.Round(n, MidpointRounding.AwayFromZero)` | `CalculationEngine.cs` ~74; `InvoicePricing.Line` ~11 |

Positive midpoints: both yield 0.5→1, 1.5→2. Covered by `round-half-*` vectors and `JsRound_PositiveMidpoint_MatchesMathRound`.

Negative midpoints: **not equivalent** (`Math.round` toward +∞ vs AwayFromZero). Not in the lock. Implementations were **not** changed.

---

# 7. HTML-ONLY RESULT

```text
HTML-ONLY = PASS
```

- Host null → JS formula (`makeHtmlOnlyInvoiceLine`, `calcT` with `getSirmanHostSync(){return null}`).
- Existing test still: `calcInvoiceLine(1000,10,9999).fin === 900` (`test_laegh.js` ~9043 and B1 ~9129).
- Fallback functions not deleted. `Sirman_Final.html` not modified.

EXE Host-wins:

```text
HOST-WINS = PASS
```

Mock `RunBusiness` result `fin:777` still overrides JS 900 (`test_laegh.js` ~9053 and B1 ~9144).

---

# 8. REGRESSION RESULT

```text
TESTS:
PASS: HTML 580 / Core 139
FAIL: 0
SKIPPED: 0

REGRESSION:
PASS

HTML-ONLY:
PASS

FROZEN PRINT:
UNTOUCHED

PERSISTENCE:
UNCHANGED

LOCKED BUSINESS:
UNCHANGED
```

Floors: HTML **577 → 580** (≥577). Core **134 → 139** (≥134).

Commands:

```text
node test_laegh.js Sirman_Final.html   → 580 PASS / 0 FAIL
dotnet test desktop/Sirman.Core.Tests  → 139 PASS / 0 FAIL
```

---

# 9. FILES CHANGED

Changed (tests only):

- `test_laegh.js`
- `desktop/Sirman.Core.Tests/InvoicePricingParityTests.cs` (created)
- `desktop/Sirman.Core.Tests/InvoicePricingParityVectors.json` (created)
- `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj`

Not changed:

- `Sirman_Final.html`
- `Laegh_Final.html`
- `InvoicePricing.cs`
- `BusinessFacade.cs`
- Host / Desktop / print / backup / version

Deleted: none.

Commit: `bc7e8fe` (`test: lock invoice.line / invoice.totals JS↔C# parity vectors`)

---

# 10. RISKS

| ID | Level | Note |
|---|---|---|
| R1 | MEDIUM | Negative `est*disc/100` midpoints still diverge JS vs C#. UI `min=0` hides it. Do not “fix” without an explicit lock/gate. |
| R2 | LOW | `calcT` is executed with a mock DOM, not a browser. It is the real function body. |
| R3 | LOW | Next agent may treat B1 PASS as permission to move persist or delete JS. **It is not.** |
| R4 | LOW | `JsonSerializer` default naming must keep `tE`/`da`/`fin`. Facade tests lock those names. |

---

# 11. READINESS FOR FIRST REAL MIGRATION

```text
FIRST REAL OWNERSHIP MIGRATION = NOT AUTHORIZED
B1 GATE FOR PRODUCT CODE = STILL NO
NEXT REAL MIGRATION GATE MAY BE PREPARED = YES
```

B1 only frozen the **calculation contract**. It did not move ownership of persist, invoice save/close/delete, or HTML-only fallback.

A later human prompt may now name **one** next step (still Change-Gated). That prompt must not assume SQL, a second Host, or deletion of JS.

Do not start B2 in this step.

---

# 12. FINAL STATUS

```text
B1 = COMPLETED

PARITY = PASS
ROUNDING (locked domain) = EQUIVALENT
HTML-ONLY = PASS
HOST-WINS = PASS
REGRESSION = PASS
ARCHITECTURE MIGRATION = NOT STARTED
CODE (product) MODIFIED = NO
VERSION = 1405.5.27γ (unchanged)

NEXT REAL MIGRATION GATE MAY BE PREPARED = YES
NEXT REAL MIGRATION IMPLEMENTATION = NOT AUTHORIZED
```

```text
PHASE 3 CHANGE GATE — FINAL

Requested change:
Invoice pricing JS↔C# parity lock (tests only)

Implementation:
DONE (tests)

Files changed:
test_laegh.js
desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj

Files created:
desktop/Sirman.Core.Tests/InvoicePricingParityTests.cs
desktop/Sirman.Core.Tests/InvoicePricingParityVectors.json
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B1_PARITY_LOCK.md

Files deleted:
none

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
HTML 580 PASS / 0 FAIL
Core 139 PASS / 0 FAIL

Regression:
PASS

Final status:
PASS

Commit:
bc7e8fe
```
