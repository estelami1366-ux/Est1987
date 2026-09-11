# SIRMAN — POST-P3 CURRENT STATE RECONCILIATION

**Mode:** READ-ONLY ANALYSIS  
**Date:** 1405/06/20 (2026-09-11)  
**Authority:** live git + current reports (not the stale Phase 3 tracker HEAD)  
**Contract:** uploaded `SIRMAN_AGENT_RULES.md` + `docs/ARCHITECTURE_RULES.md` + `docs/DEVELOPMENT_GOVERNANCE.md`  
**Product code modified:** NO  
**Recommended next program implemented:** NO

`SIRMAN_AGENT_RULES.md` is **not** in the repository (`docs/SIRMAN_AGENT_RULES.md` missing). It was applied from the packet upload.

---

# 1. GIT STATE

```text
Branch:    cursor/diagnostic-center-p3-ui-fault-fa01
HEAD:      f5e3ebaf51dd0787d35957b880b8a164a61b4880
           f5e3eba  feat: record UI faults in Diagnostic Core via ReportUiFault
Upstream:  origin/cursor/diagnostic-center-p3-ui-fault-fa01
Worktree:  dirty (unrelated leftovers only)
```

Unrelated dirty (not Diagnostic, not this analysis):

```text
deliveries/migration/P1-services/services.candidate.sqlite
deliveries/migration/P1-services/services.sha256
```

First-parent after the `1405.6.16α` release tag:

```text
f5e3eba  Diagnostic P3  ReportUiFault
607843d  Diagnostic P2  native DiagnosticCenterForm
7f79098  Diagnostic P1  RunBusiness correlation
6fd23e8  Diagnostic P0  Core JSONL + Host query/export
0ab867e  Diagnostic architecture (docs only)
b5f532c  tag release-1405.6.16-alpha  (docs: record release SHA)
307c5dd  release: 1405.6.16-alpha
```

`1fcf054` (B19R product) **is an ancestor** of HEAD. No branch switch / reset / rebase / merge / cherry-pick was performed for this packet.

---

# 2. PRODUCT VERSION

Unchanged. Diagnostic P0–P3 did not bump version.

| Source | Value |
|---|---|
| `SIRMAN_VERSION.json` | `1405.6.16α` / assembly `1405.6.16.1` |
| `desktop/Directory.Build.props` | `Version` `1405.6.16.1`, `InformationalVersion` `1405.6.16α` |
| `Sirman_Final.html` meta / `APP_VERSION` | `1405.6.16α` |
| `Laegh_Final.html` | byte-identical to `Sirman_Final.html` at HEAD (`cd21964a…`) |

`docs/STABLE_BASELINE.md` still records `1405.6.16α` but its suite floor (HTML 1118 / Core 859) is **stale** versus Diagnostic P3 (HTML 1120 / Core 907). Baseline file was not edited in this packet.

---

# 3. CURRENT VERIFIED CHECKPOINT

Two different “last good” meanings must not be mixed.

### 3.1 Phase 3 B-migration product checkpoint (historical)

```text
B19R-FINAL-GOOD = 1fcf054
fix: close remaining inventory mutation boundary risks
version then: 1405.5.27γ
```

B20 (`b11ac50` on the old tracker) closed **authorized Phase 3 dual-path B-steps**. It did not freeze all future engineering.

### 3.2 Latest shipped product-code checkpoint after B19R

```text
release-1405.6.16-alpha
307c5dd  release: 1405.6.16-alpha
b5f532c  tag + docs SHA record
version: 1405.6.16α / 1405.6.16.1
```

Between `1fcf054` and `307c5dd` (not Phase 3 B-steps): native print work, backup ARCH series through ARCH-26, phonebook restore contracts, inventory EXE cutovers (manual adjust / Excel import / stocktake), operational checkpoint `1405.6.3α`, then the `1405.6.16α` kit.

ARCH-27’s recommended code packet (`P0-inventory-manual-adjust-cutover`) **already landed** before that release (`48bc9b2` and follow-ons). It is not the next unused program.

### 3.3 Current code HEAD (not a new release)

```text
HEAD = f5e3eba  Diagnostic P3
version still 1405.6.16α
shop kit / installer for P0–P3 = NOT BUILT
Linux suites at P3: HTML 1120 / Core 907 / Desktop build succeeded
Shop/Windows = NEEDS HUMAN VERIFICATION
```

**Authoritative current engineering checkpoint:** HEAD `f5e3eba` on this branch, version `1405.6.16α`, **YELLOW** (code+Linux tests, no shop EXE proof).  
**Authoritative shipped checkpoint:** `307c5dd` / tag `release-1405.6.16-alpha`.

Do not validate Diagnostic P0–P3 with a pre-`f5e3eba` shop EXE.

---

# 4. DIAGNOSTIC P0-P3 STATUS

| Packet | Commit | What landed | Linux tests (packet report) | Shop/Windows | Status |
|---|---|---|---|---|---|
| Architecture | `0ab867e` | Design only | n/a | n/a | COMPLETED (docs) |
| P0 | `6fd23e8` | Core store, Desktop hooks, Host query/export, unscoped `SYS-*` | Core 879+ then | not verified | COMPLETED / YELLOW |
| P1 | `7f79098` | `RunBusiness` correlation + additive `diagnostic` (9 fields); `SafeError` unchanged | Core 892 / HTML 1118 | not verified | COMPLETED / YELLOW |
| P2 | `607843d` | `GuidanceCatalog`, native `DiagnosticCenterForm`, Host `OpenDiagnosticCenter` | Core 900 / HTML 1118 | form not GUI-tested | COMPLETED / YELLOW |
| P3 | `f5e3eba` | `ReportUiFault`, 15s Core dedup, thin HTML/Desktop adapter | Core **907** / HTML **1120** | `onerror`→JSONL not GUI-tested | COMPLETED / YELLOW |

Implemented and still true:

- Classification / catalog / guidance / persistence / report = Core
- HTML = adapter only (`reportUiFaultToHost`); no catalog/guidance/JSONL in that path
- Host still one object `sirmanHost`; P3 added `ReportUiFault` (AlwaysAllowed)
- Print `history.jsonl` not used as the diagnostic store

Intentionally **not** done (architecture leftovers, not a failed P3):

- HTML render of Host `diagnostic` five blocks (P1 named it; P2 chose native WinForms instead)
- Scoped INV/SAL/WAR numeric codes
- Incident acknowledge/close
- Print/Backup **publish-only** adapters
- Shop GUI of Diagnostic Center + live `window.onerror`

P3 STOP was honored: no P4 started before this reconciliation.

---

# 5. PHASE 3 RECONCILIATION

`deliveries/Reports/PHASE_3_MIGRATION_TRACKER.md` is **historically correct and operationally stale**.

| Tracker claim (last updated 1405/06/02) | Current fact |
|---|---|
| Branch `cursor/phase-3-architecture-migration-3733` HEAD `b11ac50` | This worktree is Diagnostic P3 `f5e3eba` |
| Live version `1405.5.27γ` | Live version `1405.6.16α` |
| HTML 644 / Core 159 | HTML 1120 / Core 907 (Linux, P3) |
| Last product checkpoint `1fcf054` | Still the B-migration freeze; **not** the current product HEAD |
| AUTHORIZED PHASE 3 MIGRATION COMPLETE | **Still true** for B2–B11-class dual-path + authorized `inventory.stock` + B19/B19R gates |
| Do not invent B21 | **Still true** |

B20 Option C does **not** conflict with Diagnostic P0–P3. Diagnostic is a **separate program** (explicit architecture packet after `1405.6.16α`), not a Phase 3 B-step and not B21.

Work after B19R that is **not** Phase 3:

1. Print isolation / native print (FROZEN module; physical still unverified)
2. Backup/Recovery ARCH series through ARCH-26 (accepted COMPLETE, synthetic)
3. Phonebook restore contracts (frozen unless defect)
4. Inventory EXE cutovers named by ARCH-27 (manual adjust / Excel / stocktake) — **done** before `1405.6.16α`
5. Diagnostic architecture + P0–P3 — **done in source**, not released as a new version

Do not reopen Phase 3 B-steps. Do not invent B21. Do not treat the tracker file as the current HEAD.

---

# 6. REMAINING ARCHITECTURE PROGRAMS

Separate from Phase 3. Ranked later in §7. Not started here.

**A. Production verification (not code)**  
Shop Windows install of `1405.6.16α`, then a build that includes Diagnostic P0–P3. Print paper, Diagnostic Center, UI-fault JSONL, inventory cutovers.

**B. Remaining EXE inventory bypasses** (CHANGELOG `1405.6.16α` Known Issues)  
`deductFromGeneralStock`, `delWarehouseEntity`, `importParts` still not Core paths. Same *class* as ARCH-27 P0, which already shipped. Needs its own finite packet, fail-closed, no SQLite.

**C. Diagnostic operator completeness**  
HTML display of Host `diagnostic`; shop GUI of native center; optional acknowledge/query polish. No new catalog in HTML. No business codes invented casually.

**D. Inventory read projections** (B20 leftovers)  
`lowStock` / `kardex` / `search` / `value` / `deadStock` / `consumed` / `normalizeWarehouse` still JS on EXE. Wiring Host **invents** a dual-path. Requires an explicit architecture decision + parity lock. Not a leftover B-step.

**E. Persist / SQLite SoT**  
ADR exists (`STORAGE_ARCHITECTURE_DECISION_RECORD.md`, first entity `services`). Agent rules: **do not introduce SQLite as canonical SoT prematurely**. CHANGELOG: SQLite remains candidate. Not the next program.

**F. Optional cleanup**  
Unused `calc.*` fail-open wrappers; unused Facade ops (`service.*`, `invoice.validate` still unwired for draft save). Cleanup without a live caller is low value.

**G. Draft invoice validate cutover** (`saveInv` → existing `invoice.validate`)  
Named in ARCH-27 as a possible later thin slice. Adjacent to locked invoice identity. Only after verification + a dedicated gate.

---

# 7. TOP 3 OPTIONS

Priority used: operational stability → data preservation → rollback → real value → architecture (`SIRMAN_AGENT_RULES.md` §3).

| Rank | Program | Type | Why this high | Why not higher / risk |
|---|---|---|---|---|
| **1** | Shop/Windows verification of `1405.6.16α` **plus** Diagnostic P2/P3 on an EXE that actually contains `f5e3eba` | Production verification | Several YELLOW layers are stacked. Governance forbids claiming shop success from Linux. Next code on an unverified shop EXE repeats the “old build validates new code” failure. | Not a coding packet; needs a human + shop PC |
| **2** | Remaining inventory EXE bypass cutover (`deductFromGeneralStock` / `delWarehouseEntity` / `importParts`) | Architecture / live-data | Same loss class ARCH-27 already ranked highest; CHANGELOG still lists them; Core ops exist | Touches inventory; must stay fail-closed; must not reopen B19R algorithms or SQLite |
| **3** | Diagnostic operator completeness (native center on Windows + optional HTML **render-only** of `diagnostic`) | Architecture / operator value | P2/P3 are code-complete but unused in the shop; HTML still shows `ntf` only | Must not grow HTML catalog; scoped INV codes are a later packet |

Not in the top 3: SQLite SoT, Backup/Recovery reopen, Print unfreeze, Phonebook identity, dead `calc.*` wrappers, inventory read-projection family, B21.

---

# 8. RECOMMENDED NEXT PROGRAM

**ONE program:** `VERIFY-1405.6.16α-AND-DIAGNOSTIC-P2-P3`

```text
Kind:        production verification (human / shop Windows)
Not:         a coding packet
Not:         B21
Not:         SQLite / Print / Backup / Phonebook
Depends on:  an EXE built from HEAD f5e3eba (or a later commit that contains P0–P3)
```

Minimum shop checks (evidence, not this agent):

1. Install/run `1405.6.16α` shell that includes Diagnostic P0–P3 (do not use a pre-P3 kit).
2. Help → «مرکز گزارش و تشخیص…» opens `DiagnosticCenterForm`; list/filter/detail/export work.
3. Force a JS `window.onerror` (or rejected promise); one `SYS-UI-UNSCOPED` line in `%LocalAppData%\Sirman\diagnostics\events.jsonl`; flood does not multiply inside 15s.
4. One failed `RunBusiness` still shows existing UI; additive `diagnostic` does not break parsers; `SafeError` still three fields.
5. Print paper remains `PHYSICAL_PRINT_NOT_VERIFIED` unless a **separate** print packet is approved — do not mix print “while verifying diagnostics.”

**First code program after that verification (do not start now):** remaining inventory EXE bypasses in CHANGELOG (`deductFromGeneralStock`, `delWarehouseEntity`, `importParts`).

This reconciliation does **not** implement either program.

---

# 9. HUMAN VERIFICATION

```text
LIVE EXE / SHOP WINDOWS = NEEDS HUMAN VERIFICATION
```

Outstanding (do not mark VERIFIED from this Linux agent):

- Physical print (`PHYSICAL_PRINT_NOT_VERIFIED`)
- Historical Phase 3 B8–B19R live EXE boxes (tracker still unchecked)
- Inventory manual-adjust / Excel / stocktake cutovers on a shop PC
- ARCH-26 recovery (synthetic / copy-only, not shop restore)
- Diagnostic P2 native form
- Diagnostic P3 UI-fault → JSONL
- `1405.6.16α` kit on the real shop machine with **this** HEAD

`docs/STABLE_BASELINE.md` suite numbers are Linux historical, not shop proof.

---

# 10. PROTECTED/FROZEN AREAS

Do not reopen without an explicit defect packet:

| Area | State |
|---|---|
| Print | FROZEN / ISOLATED; paper not shop-verified |
| Backup / Recovery apply | Closed except a concrete production defect |
| Phonebook live identity / dual `pb` | Frozen (ARCH-22–25) |
| SQLite | Candidate only; not canonical SoT |
| Restore `warehouseDocs` / `stockMoves` persist gap | Parked (restore-owned, not inventory) |
| Phase 3 B-steps / B21 | Closed; do not invent |
| Locked mutation **algorithms** (invoice/sale/warranty/stock already on Core) | Do not redesign |
| REST / second Host / Blazor / HTML business logic growth | Forbidden |

---

# 11. FILES CHANGED

```text
PRODUCT CODE          = NONE
Sirman_Final.html     = UNCHANGED by this packet
Laegh_Final.html      = UNCHANGED by this packet
Core / Desktop / Host = UNCHANGED by this packet
tests                 = UNCHANGED by this packet
storage / backup / print / inventory = UNCHANGED

This packet added:
deliveries/Reports/POST-P3-CURRENT-STATE-RECONCILIATION.md
```

No product-code tests were run for this analysis. Counts cited are from the Diagnostic P3 report already on HEAD.

---

# 12. FINAL STATUS

```text
Packet              = POST-P3 CURRENT STATE RECONCILIATION
Implementation      = NOT STARTED (analysis only)
Phase 3 B-migration = STILL COMPLETE (B20 Option C stands)
Current version     = 1405.6.16α
Current HEAD        = f5e3eba (Diagnostic P3)
Shipped checkpoint  = 307c5dd / release-1405.6.16-alpha
Recommended next    = VERIFY-1405.6.16α-AND-DIAGNOSTIC-P2-P3
Next code (later)   = remaining inventory EXE bypasses (CHANGELOG)
B21                 = NOT INVENTED
Checkpoint          = YELLOW
```

**YELLOW:** git/version/Diagnostic P0–P3 source status is clear; shop proof is missing; Phase 3 tracker is stale and must not be used as HEAD.

**STOP.** Recommended program was **not** started.
