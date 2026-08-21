# SIRMAN — PHASE 3 ARCHITECTURE MIGRATION
## STEP B16 — ARCHITECTURE DECISION AND ROLLBACK GATE

**Mode:** ARCHITECTURE DECISION / PARITY PREPARATION ONLY  
**Date:** 1405/05/30 12:02:36 (Asia/Tehran)  
**Gregorian:** 21 August 2026  
**Branch:** `cursor/phase-3-architecture-migration-3733`  
**HEAD before:** `085222a` (`docs: record B15 change-gate report commit hash on tracker`)  
**Test commit:** `23a4776` (`test: lock inventory.stock JS/C# parity vectors`)  
**Live version:** `1405.5.27γ` (unchanged)

```text
PRODUCT CODE MODIFIED = NO
B16 OWNERSHIP MIGRATION = NOT STARTED
INVENTORY MUTATION = NONE
PRINT CHANGED = NO
PERSISTENCE CHANGED = NO
BACKUP CHANGED = NO
PARITY = CONFIRMED
ROLLBACK PROTOCOL = DEFINED
CHECKPOINT PROTOCOL = DEFINED
```

B15 blocked selection. B16 does **not** abandon migration. It records the last known-good checkpoint, defines rollback, and authorizes **`inventory.stock` parity preparation only**. EXE ownership is **not** migrated.

```text
STOP — B16 parity preparation complete. Wait for B17 instruction.
```

---

# 1. Jalali date

```text
1405/05/30
```

---

# 2. Gregorian date

```text
21 August 2026
```

---

# 3. Exact local time

```text
12:02:36
```

Regression completed at this Tehran clock time. Test commit `23a4776` preceded the run.

---

# 4. Timezone

```text
Asia/Tehran
```

---

# 5. Branch

```text
cursor/phase-3-architecture-migration-3733
```

Did not switch branches. Preferred PR base remains `cursor/phase-3-change-gate-3733`. Never on `main`.

---

# 6. HEAD before

```text
085222a  docs: record B15 change-gate report commit hash on tracker
085222a1eb95e6ea8f88f281d9404e1cdae54c8f
worktree = clean
B14 = COMPLETED (dae7cde)
B15 = BLOCKED / analysis only
```

---

# 7. HEAD after

Product HTML/Core/Host: still `dae7cde` (B14 ownership).  
B16 test commit: `23a4776`. Docs commit(s) follow this report.

---

# 8. Worktree before/after

Commands:

```text
git branch --show-current
git rev-parse --short HEAD
git status --short
```

| Check | Result |
|---|---|
| Branch | `cursor/phase-3-architecture-migration-3733` |
| Worktree at gate | clean |
| After tests | clean (tests already committed as `23a4776`) |
| Product files | unchanged |

No stash, reset, rebase, merge, cherry-pick, or `git reset --hard`.

---

# 9. B14 checkpoint (last known good product)

```text
CHECKPOINT:
B14-GOOD

SHA:
dae7cde
dae7cde7c3397282ff9946cdac359e7510495220

Date:
1405/05/30

Time:
11:34:57

Timezone:
Asia/Tehran

Branch:
cursor/phase-3-architecture-migration-3733

Product version:
1405.5.27γ

HTML test result:
616 PASS / 0 FAIL

Core test result:
151 PASS / 0 FAIL

Regression:
PASS

Human verification state:
NEEDS HUMAN VERIFICATION
```

This is the recoverable **product** architecture if a later ownership experiment fails in a way that cannot roll back to the B16 parity lock. Docs after `dae7cde` (B14/B15 reports) do not change product behavior.

---

# 10. B15 blocker

B15 found **no** remaining seam that satisfied all ten change-gate rules.

The only remaining **live EXE** dual-path is `inventory.stock` (`invStockSnapshot` → `InventoryCore.Stock`). B15 rejected it because:

- inventory **family** is locked (B4/B9/B12);
- B15 §6 forbids automatically choosing it;
- parity was UNKNOWN;
- fail-closed Core miss would blank shop qty/reserved/available cells.

B16 treats that blocker as a **protocol + parity** problem, not permission to stop migrating, and not permission to migrate ownership in this step.

---

# 11. Decision on `inventory.stock`

```text
inventory.stock
  AUTHORIZED     = PARITY PREPARATION ONLY
  OWNERSHIP      = NOT AUTHORIZED
  MUTATIONS      = NOT AUTHORIZED
  FAIL-CLOSED    = NOT DESIGNED (current path remains fail-open)
```

Authorized because all B16 safety conditions for **parity** hold:

| Condition | Evidence |
|---|---|
| Existing JS snapshot | `invStockSnapshot` ~18395 |
| Existing Core projection | `InventoryCore.Stock` |
| Existing Host route | `takeBusinessCore('inventory.stock', {item, whId})` |
| HTML-only fallback | JS snapshot when Host absent / Core miss |
| Behavior can be locked without new rules | 18 frozen vectors from live JS, Core matches |
| Read-only harness | snapshots only; item JSON unchanged after `Stock` |
| No SQL/REST/print/persist | tests and vector file only |
| Mutations not in the same change | reserve/release/consume/addStock/applyWarehouseDoc untouched |

Not authorized for ownership because:

1. Fail-closed semantics for `qty` / `reserved` / `available` are **not** designed. A blank inventory table is **not** an acceptable default.
2. Two-phase rule: never combine parity (A) and ownership (B).
3. Inventory mutations remain a separate decision even though they consume this snapshot on the HTML-only path.

```text
PHASE A = B16 (this step)  → CHECKPOINT B16-PARITY
PHASE B = later gate       → EXE ownership + fail-closed UI contract
```

---

# 12. Rollback protocol

```text
DEFINED
```

Rule:

```text
LAST KNOWN GOOD CHECKPOINT
        ↓
ONE CONTROLLED CHANGE
        ↓
TEST
        ↓
VERIFY
        ↓
CREATE NEW CHECKPOINT
        ↓
NEXT CHANGE
```

On failure:

```text
STOP
identify exact failing step
rollback ONLY to the last verified checkpoint
preserve the failure evidence in deliveries/Reports/
restart from that checkpoint
```

Git:

| State | Action |
|---|---|
| Uncommitted failed experiment | `git restore --source=<GOOD_SHA> -- .` (product tree). Keep the failure report. |
| Committed failed experiment | `git revert <BAD_COMMIT>` — do **not** rewrite public history. |
| `git reset --hard` | **Forbidden** unless an explicit human instruction authorizes it. |

Boundaries for this seam:

```text
B14-GOOD (dae7cde, product)
   ↓
B16 parity preparation (23a4776 tests; this report)
   ↓
CHECKPOINT B16-PARITY
   ↓
future inventory.stock ownership (B17+ if authorized)
   ↓
CHECKPOINT
```

If a future **ownership** step fails → rollback to **B16-PARITY** (parity vectors stay).  
If **this** parity lock had mismatched → rollback to **B14-GOOD** and keep the mismatch report. It did not mismatch.

B16 itself did not need product rollback. Failure evidence rule was not triggered.

---

# 13. Checkpoint protocol

From this point forward every architecture step must record:

```text
checkpoint ID
commit SHA
date / time / timezone
branch
product version
HTML tests
Core tests
regression
human verification state
```

A compile is not a checkpoint. A checkpoint requires source verification + HTML tests + Core tests + relevant regression + protected-area audit.

### Checkpoint B16-PARITY (this step)

```text
CHECKPOINT:
B16-PARITY

SHA (tests):
23a4776
23a47763d4c3b2400cccddad7948541e865b9e33

Date:
1405/05/30

Time:
12:02:36

Timezone:
Asia/Tehran

Branch:
cursor/phase-3-architecture-migration-3733

Product version:
1405.5.27γ

HTML test result:
619 PASS / 0 FAIL  (Sirman_Final.html and Laegh_Final.html)

Core test result:
154 PASS / 0 FAIL

Regression:
PASS (B5/B6/B8/B10/B11/B13/B14 groups green; print group green; inventory engine group green)

Human verification state:
NEEDS HUMAN VERIFICATION
```

Product SHA remains `dae7cde`. B16-PARITY is a **test-lock** checkpoint on top of B14-GOOD.

---

# 14. Parity vector inventory

Shared table: `desktop/Sirman.Core.Tests/InventoryStockParityVectors.json` (18 cases).

HTML-only runner stubs `takeBusinessCore` → `null` so JS `invStockSnapshot` + `_sumByWh` execute. Core runner calls `InventoryCore.Stock` and Facade `inventory.stock`.

Locked fields (all consumed by live UI):

```text
qty
reserved
available
min
reorder
price
```

| id | axis | JS == Core |
|---|---|---|
| empty-item | item missing | YES `0/0/0/0/0/0` |
| null-item | item missing | YES |
| simple-qty-reserved | qty/reserved/available | YES `10/4/6/2/3/1000` |
| zero-stock | zero stock | YES |
| warehouse-specific | warehouse exists (WH-A) | YES `10/4/6` (not the 99 aggregate field) |
| warehouse-missing-key | warehouse missing | YES qty/reserved 0; min/reorder/price kept |
| unknown-warehouse | unknown warehouse | YES |
| multi-warehouse-aggregate | multiple warehouses | YES `10/3/7` |
| warehouse-b-of-multi | warehouse-specific stock | YES `3/1/2` |
| no-bywh-uses-qty | qty path | YES |
| reorder-omitted-uses-min | reorder | YES reorder=min 2 |
| reorder-empty-string-uses-min | reorder | YES |
| reorder-zero-kept | reorder | YES reorder 0 kept |
| reserved-exceeds-qty | available clamp | YES available 0 |
| negative-qty | negative/invalid | YES qty −4, available 0 |
| invalid-qty-string | invalid normalization | YES zeros |
| empty-bywh-ignores-qty-field | byWh present | YES empty maps win over qty 50 |
| price-and-min | price/min | YES `99.5` / min 5 / reorder 8 |

Semantics locked from source (not invented):

- `available = max(0, qty − reserved)`
- if `byWh` / `reservedByWh` **objects exist**, they win over `qty` / `reserved` even when empty
- empty/`falsy` `whId` uses the aggregate path
- `min` / `reorder` / `price` are **not** warehouse-scoped
- `reorder` omitted or `''` uses `min`; `reorder` `0` is kept
- negative `qty` is stored; `available` is clamped
- invalid strings normalize to 0 via existing `parseInt` / `ToInt` / `parseFloat` / `ToNum`

Read-only: Core `Stock` does not mutate the input item. HTML vectors stringify the item before/after.

```text
PARITY = CONFIRMED
```

Not a mismatch. No business-logic patch.

---

# 15. Test results

### HTML

```text
node test_laegh.js Sirman_Final.html
  کل تست‌ها: 619  موفق: 619  ناموفق: 0
```

```text
node test_laegh.js Laegh_Final.html
  کل تست‌ها: 619  موفق: 619  ناموفق: 0
```

`Sirman_Final.html` and `Laegh_Final.html` remain byte-identical (1807687 bytes).

B16 group:

```text
مسیر HTML-only باید بردارهای قفل‌شده inventory.stock را بدون Host اجرا کند
inventory.stock نباید persist یا جهش انبار بنویسد و مالکیت B16 مهاجرت نشده باشد
شکست Host در inventory.stock هنوز snapshot جاوااسکریپت را اجرا می‌کند (fail-open فعلی)
```

Previous floors preserved: B5, B6, B8, B10, B11, B13, B14 all green. Inventory engine group green. Print Center group green.

Floor: B14 HTML 616 → B16 HTML **619** (+3).

### Core

```text
dotnet test desktop/Sirman.Core.Tests
  Passed: 154  Failed: 0
```

New facts: `Stock_MatchesFrozenVectors`, `Facade_InventoryStock_MatchesFrozenVectors`, `Stock_DoesNotMutateItem`.

Floor: B14 Core 151 → B16 Core **154** (+3).

### Regression

```text
Regression = PASS
```

No print, persist, backup, or mutation tests were weakened.

---

# 16. Protected-area audit

| Area | Status |
|---|---|
| Print / WebView2 print engine | UNCHANGED |
| Persistence / localStorage / IndexedDB | UNCHANGED |
| Backup schema | UNCHANGED |
| Invoice locked workflows | UNCHANGED |
| Inventory mutations (`reserve`/`release`/`consume`/`addStock`/`apply*`) | UNCHANGED |
| Accounting | UNCHANGED |
| Warranty save/close/delete | UNCHANGED |
| Authentication / authorization | UNCHANGED |
| Host contract | SAME HOST |
| SQL / REST / second Host | NONE |
| HTML-only fallback | PRESERVED (fail-open snapshot still runs) |
| Product version | UNCHANGED (`1405.5.27γ`) |
| `invStockSnapshot` / `InventoryCore.Stock` algorithms | UNCHANGED |

---

# 17. Product code changes

```text
NO
```

`Sirman_Final.html`, `Laegh_Final.html`, Core business, Host, print, persist, `SIRMAN_VERSION.json` were not edited.

---

# 18. Changed files

```text
desktop/Sirman.Core.Tests/InventoryStockParityVectors.json
desktop/Sirman.Core.Tests/InventoryStockParityTests.cs
desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj
test_laegh.js
deliveries/Reports/PHASE_3_ARCHITECTURE_MIGRATION_STEP_B16_ARCHITECTURE_DECISION_AND_ROLLBACK_GATE.md
deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md
```

---

# 19. Failure/recovery evidence

```text
NONE
```

Parity matched. No rollback executed. No failure report required.

### Fail-closed risk (recorded, not implemented)

Current `invStockSnapshot`:

```text
takeBusinessCore("inventory.stock")
  if Core object with qty != null: return Core
  else JS snapshot
```

No `hasBusinessCore` gate. Host present + Core `null` still runs JS (fail-open). Live callers use `snap.qty` / `snap.reserved` / `snap.available` / `snap.min` without a null guard (inventory table ~13029, warehouse docs, HTML-only reserve, `applyStockByWarehouse` out-path). Returning `null` from a future fail-closed ownership change would throw or blank those cells. **A blank inventory display is not an acceptable fail-closed result.** A later ownership gate must design and test safe `qty`/`reserved`/`available` behavior **without** changing mutation semantics.

---

# 20. Human verification requirement

```text
LIVE EXE = NEEDS HUMAN VERIFICATION
```

No Windows/`Sirman.exe` test in this step. Future inventory ownership (not B16) must explicitly test:

- product stock display
- warehouse stock
- reserved quantity
- available quantity
- parts suggestion that reads stock
- normal operation with Core available
- Core unavailable/fail behavior, if testable

Do not claim those were performed.

---

# 21. Final decision

```text
B16 REPORT

Branch:
cursor/phase-3-architecture-migration-3733

HEAD before:
085222a

HEAD after:
23a4776 (tests); docs commit follows; product still dae7cde

Worktree:
clean at gate; tests committed; docs-only after report

Last known good checkpoint:
B14-GOOD
SHA:
dae7cde

Decision:
inventory.stock
  AUTHORIZED = PARITY PREPARATION ONLY
  OWNERSHIP = NOT AUTHORIZED

Parity:
CONFIRMED

Product code modified:
NO

Inventory mutation:
NONE

Rollback protocol:
DEFINED

Checkpoint protocol:
DEFINED

HTML tests:
619 PASS / 0 FAIL

Core tests:
154 PASS / 0 FAIL

Regression:
PASS

Protected areas:
UNCHANGED

Human verification:
NEEDS HUMAN VERIFICATION

Final status:
COMPLETED
```

```text
B16 = COMPLETED (architecture decision + parity lock)
B16 OWNERSHIP = NOT STARTED
CODE MODIFIED = tests/docs only
PRODUCT CODE MODIFIED = NO
```

```text
B17 = NOT STARTED
OWNERSHIP = NOT AUTHORIZED BY THIS REPORT
```

```text
STOP — B16 parity preparation complete. Wait for B17 instruction.
```
