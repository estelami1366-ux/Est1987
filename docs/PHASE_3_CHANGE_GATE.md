# SIRMAN — PHASE 3 CHANGE GATE
## Mandatory Pre-Implementation Governance

**Version:** 1.0  
**Product:** SIRMAN  
**Live version:** `1405.5.27γ`  
**Phase:** 3  
**Mode:** Change Gate / Governance  
**Authority:** Source code + Phase 3 Capability & Ownership Map  
**Default behavior:** READ-ONLY until a change passes this gate

---

## 1. PURPOSE

This document is a mandatory governance rule for every proposed change to SIRMAN during Phase 3.

The purpose is to prevent:

- speculative refactoring;
- architectural drift;
- accidental duplication of business logic;
- changes to frozen printing infrastructure;
- changes to locked business behavior;
- persistence/schema corruption;
- breaking HTML-only mode;
- introducing a second transport, database, ACL, or host bridge;
- modifying code before the change has been explicitly classified and approved.

**This is a change gate, not a redesign proposal.**

SOURCE CODE IS THE AUTHORITY.

Do not redesign the architecture because a different architecture appears cleaner.

---

# 2. ABSOLUTE RULE

Before writing, editing, deleting, moving, renaming, generating, or refactoring any source file:

> **STOP → CLASSIFY → TRACE → CHECK BOUNDARIES → PRODUCE GATE RESULT → ONLY THEN IMPLEMENT**

No implementation is permitted before the gate result is `PASS`.

If the gate result is `BLOCK`, do not modify files.

If evidence is insufficient, the result is `INSUFFICIENT EVIDENCE`, not `PASS`.

---

# 3. CURRENT ARCHITECTURAL FACTS

SIRMAN currently consists of:

```text
┌───────────────────────────────────────────────┐
│ HTML / JavaScript — Sirman_Final.html         │
│                                               │
│ UI / routing / roles                          │
│ HTML-only fallback business                   │
│ localStorage / IndexedDB                     │
│ BackupEngine / backup schema                  │
│ Print templates / Print Center UI            │
│ Dashboard / Help / Tasks / Contacts / Reports │
└─────────────────────┬─────────────────────────┘
                      │ sirmanHost
                      ▼
┌───────────────────────────────────────────────┐
│ Sirman.Desktop — Sirman.exe                   │
│                                               │
│ WebView2 host                                 │
│ Windows integration                           │
│ Notifications                                │
│ File/workspace operations                     │
│ Print engine                                  │
│ Diagnostic harness                            │
└─────────────────────┬─────────────────────────┘
                      │ RunBusiness / contracts
                      ▼
┌───────────────────────────────────────────────┐
│ Sirman.Core                                   │
│                                               │
│ BusinessFacade                                │
│ calculations                                  │
│ invoice / sale / payment                      │
│ inventory / warranty / service / rules        │
│ security                                      │
│ print contract                                │
└───────────────────────────────────────────────┘
```

### Current ownership facts

- HTML owns application persistence.
- HTML owns the backup schema.
- HTML owns HTML-only fallback behavior.
- Desktop owns Windows-specific infrastructure.
- Core owns extracted business operations and contracts.
- `sirmanHost` is the existing Host boundary.
- `RunBusiness` is the existing business RPC.
- There is no SQL persistence layer.
- There is no second ACL.
- There is no second Host bridge.
- There is no REST business API.
- HTML-only mode is an intentional supported mode.

---

# 4. FROZEN AREAS — DO NOT TOUCH

The following are FROZEN during this Phase 3 Change Gate.

## 4.1 Production Print

Do not modify:

- `printEngine*`
- Print Center production path
- `GetPrinters`
- `PrintHtml`
- `PrintDocument`
- `GetPrintJob`
- `IPrintService`
- `PrintServiceAdapter`
- `WindowsPrintHost`
- WebView2 `PrintAsync`
- printer job/status contract
- PDF-vs-paper separation
- PDF-printer rejection logic

Production print architecture:

```text
HTML Print Center
 ↓
JS printEngine*
 ↓
sirmanHost
 ↓
IPrintService
 ↓
PrintServiceAdapter
 ↓
WindowsPrintHost
 ↓
WebView2 PrintAsync
 ↓
Windows Spooler
 ↓
Physical Printer
```

**No redesign. No rewrite. No speculative fix.**

---

## 4.2 Print Hardware Diagnostic

The diagnostic harness is separate from production print.

Do not:

- merge it into Print Center;
- use it as a replacement print engine;
- rewrite production printing around it;
- change the production print boundary because physical printing has not yet been verified.

---

# 5. LOCKED AREAS — DO NOT CHANGE BEHAVIOR

The following business domains are LOCKED:

- Invoice identity
- `InvoiceId`
- duplicate invoice number rules
- invoice close/delete
- inventory reserve/consume/release
- warehouse application/reversal
- accounting/payment apply/edit/delete/reversal
- warranty save/close/delete
- linked reversal behavior
- backup schema
- `migrateBackup`
- backup merge/replace/selective restore
- checksum behavior
- HTML fallback business implementations for locked domains
- `CurrentStorage` kind
- localStorage/IndexedDB persistence model

A change that alters behavior in any locked area is automatically:

```text
BLOCK
```

unless a later phase explicitly authorizes that exact change.

---

# 6. PROTECTED AREAS

The following are PROTECTED:

- `sirmanHost`
- `RunBusiness`
- HTML single-file UI
- HTML-only mode
- role/page-key system
- `CurrentStorage`
- Jalali version file
- LAN protocol boundary
- backup JSON structure
- Host security gates
- existing Host method contracts

Protected does not mean immutable forever.

It means:

> Do not alter the boundary unless the change itself has passed an explicit architecture review.

---

# 7. FORBIDDEN ARCHITECTURAL CHANGES

During this Phase 3 gate, the following are forbidden unless explicitly authorized by a later architecture decision:

### Persistence

- SQL
- SQLite
- Entity Framework persistence
- replacing localStorage as the application SoT
- replacing IndexedDB
- introducing a second persistence authority
- changing backup schema
- moving business data into Core storage

### Transport

- REST business API
- new HTTP business service
- WebSocket business service
- second localhost business server
- replacing `sirmanHost`
- creating a second Host bridge

### Business architecture

- deleting JS fallbacks
- making Core mandatory for HTML-only mode
- creating a third implementation of locked business behavior
- rewriting locked business workflows
- moving persistence ownership into Core

### Security

- second ACL
- second role/page permission system
- replacing HTML login merely because Host `Login` exists
- replacing the existing session/role model without an approved security change

### Printing

- new print engine
- alternate production print pipeline
- replacing WebView2 `PrintAsync`
- moving print to another process/service
- using the diagnostic harness as production printing

---

# 8. CHANGE CLASSIFICATION

Every proposed change MUST be classified into exactly one category.

## CLASS A — UI/COPY ONLY

Examples:

- Help Center wording
- dashboard layout
- labels
- icons
- spacing
- visual presentation
- calendar page chrome

Requirements:

- no persistence changes;
- no business logic changes;
- no `RunBusiness`;
- no print engine changes;
- no security changes;
- HTML-only remains functional.

Possible result:

```text
PASS
```

---

## CLASS B — READ-ONLY PRESENTATION

Examples:

- dashboard KPI presentation;
- read-only information panel;
- existing data rendered differently.

Requirements:

- reads only;
- no writes;
- no new persistence;
- no new business mutation;
- no print changes;
- no security changes.

Possible result:

```text
PASS
```

---

## CLASS C — EXISTING CONTRACT EXTENSION

Examples:

- adding a small capability to an existing Host contract;
- extending an existing Core operation.

This class is NOT automatically safe.

Required:

- exact call path;
- ownership analysis;
- HTML-only fallback analysis;
- persistence analysis;
- test impact;
- regression analysis;
- explicit approval.

Possible result:

```text
BLOCK
```

unless all gates pass.

---

## CLASS D — BUSINESS LOGIC CHANGE

Examples:

- invoice calculation;
- inventory mutation;
- payment behavior;
- warranty workflow;
- reversal behavior.

Default:

```text
BLOCK
```

---

## CLASS E — PERSISTENCE / SCHEMA CHANGE

Examples:

- changing localStorage keys;
- changing backup schema;
- changing migration;
- changing IndexedDB schema;
- moving data to another store.

Default:

```text
BLOCK
```

---

## CLASS F — PRINT CHANGE

Any change touching production print.

Default:

```text
BLOCK
```

---

## CLASS G — ARCHITECTURAL EXTRACTION

Examples:

- moving a domain from HTML to Core;
- moving persistence ownership;
- creating a new service;
- replacing the Host boundary;
- introducing a database.

Default:

```text
BLOCK
```

The Phase 3 capability audit identified:

```text
NO SAFE ARCHITECTURAL SEAM
```

Therefore do not manufacture one.

---

# 9. THE SIX-MANDATORY GATE QUESTIONS

Before implementation, answer all six.

## Q1 — Is this a capability change or a UI change?

State:

```text
UI ONLY
```

or:

```text
CAPABILITY / BUSINESS CHANGE
```

If it is a capability change, continue with full architecture review.

---

## Q2 — Does the change touch `RunBusiness`?

Check:

- direct calls;
- Host method changes;
- Core operation changes;
- DTO changes;
- fallback changes.

If yes:

```text
HIGH REVIEW REQUIRED
```

---

## Q3 — Does the change touch persistence?

Check:

- localStorage;
- IndexedDB;
- backup schema;
- migration;
- `CurrentStorage`;
- backup/restore;
- filesystem persistence.

If yes:

```text
BLOCK BY DEFAULT
```

---

## Q4 — Does the change touch printing?

Check:

- `printEngine*`;
- Print Center;
- `PrintDocument`;
- `PrintHtml`;
- `GetPrinters`;
- `GetPrintJob`;
- `IPrintService`;
- `PrintServiceAdapter`;
- `WindowsPrintHost`;
- WebView2 printing;
- PDF/paper separation.

If yes:

```text
BLOCK
```

---

## Q5 — Does the change touch LOCKED/FROZEN/PROTECTED behavior?

If yes, identify the exact boundary.

If it changes behavior:

```text
BLOCK
```

If it only reads an existing protected interface without modifying it:

```text
REVIEW REQUIRED
```

---

## Q6 — Does HTML-only mode remain fully functional?

The proposed change MUST answer:

```text
What happens when sirmanHost is unavailable?
```

If the answer is:

```text
the feature stops working
```

then the change is not automatically acceptable.

If a feature is intentionally Desktop-only, that must be explicitly declared and approved.

---

# 10. SOURCE-OF-TRUTH TEST

Before changing any capability, identify:

```text
UI Owner:
Business Owner:
Domain Owner:
Persistence Owner:
Infrastructure Owner:
Host:
Tests:
EXE SoT:
HTML-only SoT:
Persistence SoT:
```

Then classify:

```text
SINGLE
DUAL
SPLIT
UNCLEAR
```

Never assume that moving code to Core automatically makes Core the source of truth.

---

# 11. DUPLICATION TEST

If a capability exists in both JS and C#:

```text
JS implementation
+
C# implementation
```

do NOT delete one merely because duplication exists.

Determine:

```text
Why does the duplication exist?
Is HTML-only supported?
Is the behavior locked?
Are both implementations tested?
Is equivalence intentional?
```

For locked business domains, dual implementation is intentional.

Deleting a fallback is a breaking architecture change.

---

# 12. PERSISTENCE TEST

For every proposed change, answer:

```text
Does it read persisted data?
Does it write persisted data?
Does it add a key?
Does it rename a key?
Does it remove a key?
Does it change a data shape?
Does it change backup output?
Does it change migration?
Does it change restore?
Does it change schemaVersion?
```

If any answer is yes:

```text
PERSISTENCE REVIEW REQUIRED
```

If the backup schema changes:

```text
BLOCK
```

---

# 13. PRINT TEST

Even apparently unrelated changes must be checked for accidental print coupling.

Search for:

```text
printEngine
pcDoPrint
pcDoPdf
PrintDocument
PrintHtml
GetPrinters
GetPrintJob
IPrintService
WindowsPrintHost
PrintServiceAdapter
window.print
_printTable
```

If the proposed change modifies production print behavior:

```text
BLOCK
```

If it merely changes unrelated UI text:

```text
PASS POSSIBLE
```

provided the print path itself is untouched.

---

# 14. SECURITY TEST

Check whether the change affects:

- login;
- password hashing;
- 2FA;
- failed-attempt lock;
- session lock;
- role permissions;
- `ALL_PAGES`;
- `currentRole.pages`;
- `BindSession`;
- Host security gates.

Do not replace HTML authentication with Host authentication merely because unused Host methods exist.

Unused Host methods are not evidence of an approved migration seam.

---

# 15. NETWORK TEST

The current LAN architecture is:

```text
HTML
 ↓
Desktop / existing LAN helpers
 ↓
limited local network protocol
```

Do not introduce:

- business REST;
- second API;
- database server;
- new service discovery;
- new business transport.

If the proposed change needs a new transport:

```text
BLOCK
```

---

# 16. SAFE PHASE 3 CHANGE AREAS

The following are currently the strongest candidates for implementation:

### A — Help Center

Allowed scope:

- copy;
- tree structure;
- buttons;
- visual organization;
- page descriptions.

Do not change:

- business behavior;
- print behavior;
- persistence;
- security.

---

### B — Dashboard Presentation

Allowed:

- layout;
- typography;
- grouping;
- read-only KPI presentation;
- visual hierarchy.

Forbidden:

- new writes;
- new business mutations;
- new persistence;
- new print engine calls;
- changing the underlying business calculation.

---

### C — DateTime / Calendar Chrome

Allowed:

- visual presentation;
- page organization;
- display formatting.

Do not modify:

- Core Jalali calculation behavior;
- timezone persistence;
- backup schema.

---

# 17. IMPLEMENTATION RULE

If the change passes:

```text
PASS
```

implementation must still be minimal.

The agent MUST:

1. identify exact files;
2. identify exact sections/functions;
3. make the smallest possible change;
4. avoid unrelated cleanup;
5. avoid refactoring;
6. avoid renaming unrelated symbols;
7. avoid formatting the entire file;
8. avoid dependency upgrades;
9. avoid generated architecture;
10. avoid touching frozen modules.

---

# 18. NO OPPORTUNISTIC REFACTORING

While implementing an approved change, do NOT fix unrelated issues.

Forbidden examples:

```text
"I noticed the auth code could be cleaner."
"I noticed JS/C# are duplicated."
"I noticed Core could own this."
"I noticed SQL would be better."
"I noticed print could be rewritten."
"I noticed this Host method is unused."
```

These are not reasons to expand scope.

Record them separately if necessary.

Do not implement them.

---

# 19. TEST GATE

After an approved change:

### Required

- existing relevant tests;
- relevant HTML tests;
- relevant Core tests if Core was touched;
- regression tests;
- HTML-only verification when applicable.

### Required result format

```text
TESTS:
PASS: <number>
FAIL: <number>
SKIPPED: <number>

REGRESSION:
PASS / FAIL

HTML-ONLY:
PASS / FAIL / NOT APPLICABLE

FROZEN PRINT:
UNTOUCHED / VIOLATION

PERSISTENCE:
UNCHANGED / CHANGED

LOCKED BUSINESS:
UNCHANGED / CHANGED
```

A failed test is not an invitation to bypass the gate.

---

# 20. GIT SAFETY

Before implementation:

```text
record current HEAD
record branch
record working tree status
```

The agent MUST NOT silently reset, rebase, force-push, delete branches, or rewrite history.

After implementation:

```text
show changed files
show diff summary
show tests
show final gate status
```

Do not claim a change was made if no file was actually modified.

Do not claim tests passed if they were not executed.

---

# 21. REQUIRED PRE-IMPLEMENTATION REPORT

Before editing any file, produce exactly this structure:

```text
PHASE 3 CHANGE GATE

Requested change:
<one sentence>

Classification:
<A/B/C/D/E/F/G>

Capability:
<capability name>

Files expected to change:
<exact paths or UNKNOWN>

UI Owner:
<...>

Business Owner:
<...>

Domain Owner:
<...>

Persistence Owner:
<...>

Host:
<...>

Source-of-truth class:
<SINGLE / DUAL / SPLIT / UNCLEAR>

RunBusiness touched:
YES / NO

Persistence touched:
YES / NO

Backup schema touched:
YES / NO

Print touched:
YES / NO

Security touched:
YES / NO

LOCKED area touched:
YES / NO

FROZEN area touched:
YES / NO

PROTECTED boundary touched:
YES / NO

HTML-only preserved:
YES / NO / NOT APPLICABLE

New architecture introduced:
YES / NO

New transport introduced:
YES / NO

New persistence introduced:
YES / NO

New business implementation introduced:
YES / NO

Risk:
LOW / MEDIUM / HIGH / CRITICAL

Gate:
PASS / REVIEW REQUIRED / BLOCK / INSUFFICIENT EVIDENCE

Reason:
<short exact reason>
```

---

# 22. REQUIRED POST-IMPLEMENTATION REPORT

After an approved implementation:

```text
PHASE 3 CHANGE GATE — FINAL

Requested change:
<...>

Implementation:
DONE / NOT DONE

Files changed:
<exact list>

Files created:
<exact list>

Files deleted:
<exact list>

Frozen modules touched:
YES / NO

Locked behavior changed:
YES / NO

Persistence changed:
YES / NO

Backup schema changed:
YES / NO

Print changed:
YES / NO

Security changed:
YES / NO

HTML-only preserved:
YES / NO

Tests:
<results>

Regression:
PASS / FAIL

Final status:
PASS / BLOCKED / FAILED

Commit:
<hash if created>
```

---

# 23. AUTOMATIC BLOCK CONDITIONS

The agent MUST return `BLOCK` without implementation if any of these occurs:

1. production print code must be changed;
2. backup schema must be changed;
3. localStorage/IndexedDB ownership must be changed;
4. HTML-only mode would stop supporting the affected capability without explicit approval;
5. a locked business workflow must be changed;
6. a JS fallback must be deleted;
7. a second Host bridge is proposed;
8. a new REST business API is proposed;
9. SQL/database persistence is proposed;
10. a second authorization system is proposed;
11. a security-critical migration is proposed without explicit approval;
12. the requested architecture seam does not exist in the source;
13. source evidence is insufficient to establish ownership;
14. the agent would need to invent behavior not found in the source.

---

# 24. WHAT "PASS" MEANS

`PASS` does NOT mean:

> "This architecture is now perfect."

It means only:

> "This specific change is sufficiently bounded, evidenced, and safe to implement under the current Phase 3 architecture."

---

# 25. WHAT "BLOCK" MEANS

`BLOCK` means:

- do not edit files;
- do not generate replacement architecture;
- do not create speculative code;
- explain the exact boundary that blocks the change;
- identify what additional explicit authorization would be required.

---

# 26. NO SAFE ARCHITECTURAL SEAM

The current audit conclusion is:

```text
NO SAFE ARCHITECTURAL SEAM IDENTIFIED
```

Therefore:

> Do not invent an architectural seam simply because a cleaner design is desirable.

The absence of a safe seam is itself an architectural finding.

Safe UI changes are allowed.

Architectural extraction is not.

---

# 27. PRIORITY ORDER

When instructions conflict, use this order:

```text
1. Source code
2. Explicit locked/frozen behavior
3. Current persistence and backup schema
4. Existing Host contract
5. Existing tests
6. This Change Gate
7. Documentation
8. Architectural preference
```

Do not use a cleaner theoretical design to override actual source behavior.

---

# 28. AGENT OPERATING COMMAND

When the user asks for a change, begin with:

```text
I will not edit the repository yet.

I will first run the Phase 3 Change Gate against the requested change.
```

Then inspect the source and produce the required pre-implementation report.

Only after:

```text
Gate: PASS
```

may implementation begin.

If:

```text
Gate: REVIEW REQUIRED
```

stop and report the required review points.

If:

```text
Gate: BLOCK
```

do not modify anything.

---

# 29. FINAL GOVERNANCE STATEMENT

SIRMAN Phase 3 is not an architecture rewrite phase.

It is a controlled evolution phase.

The objective is:

```text
PRESERVE
 ↓
VERIFY
 ↓
BOUND
 ↓
MAKE SMALL SAFE CHANGES
 ↓
TEST
 ↓
DOCUMENT
```

Not:

```text
REWRITE
 ↓
EXTRACT EVERYTHING
 ↓
REPLACE HTML
 ↓
REPLACE PERSISTENCE
 ↓
REBUILD PRINT
```

Current architectural constraints remain authoritative:

```text
HTML persistence = KEEP
HTML-only mode = KEEP
JS fallbacks = KEEP
sirmanHost = KEEP
RunBusiness = KEEP
Print architecture = FROZEN
Print diagnostic = ISOLATED
Backup schema = LOCKED
Invoice = LOCKED
Inventory = LOCKED
Accounting = LOCKED
Warranty = LOCKED
No SQL = KEEP
No REST business API = KEEP
No second Host = KEEP
No second ACL = KEEP
```

**PHASE 3 CHANGE GATE = MANDATORY**

**NO IMPLEMENTATION BEFORE PASS.**
