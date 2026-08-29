# SIRMAN — OFFSITE 02 — HUMAN BUG FORENSIC
## H1 / H3 / H4 — READ-ONLY; no fixes

**Mode:** FORENSIC ONLY — do not patch, do not change Print / Storage / Backup / invoice state / RTL  
**Packet filename date:** 2026-08-27  
**Agent clock:** Saturday 29 August 2026 UTC  
**Live product (unchanged):** `1405.6.3α` / assembly `1405.6.3.1`  
**Store invoice in this product:** shop/service invoices (`invoices`, `closeInv`, page `saved`) — not parts sales.

```text
Product source changed: NO
Print changed:          NO
Storage changed:        NO
Backup/Restore changed: NO
Invoice state model:    NO
RTL globally:           NO
Tests added:            NO (packet forbids encoding unproven assumptions into tests)
Fix implemented:        NO
```

---

## Git (recorded)

```text
branch: cursor/offsite-02-human-bug-forensic-fa01
HEAD:   cc7461a  (parent: P0.5R2 postal-label layout fix report)
status: M deliveries/migration/P1-services/services.candidate.sqlite
        M deliveries/migration/P1-services/services.sha256
        (unrelated candidate SQLite — not part of this forensic; not committed)
```

Inspected, **not** edited:

| File | Role |
|---|---|
| `Sirman_Final.html` | `closeInv`, `saveInv`, `loadInv`, `safePersist`, `beforeunload`, postal fields, HTML print |
| `Laegh_Final.html` | byte-identical UI twin (not opened for edit) |
| `desktop/Sirman.Core/Business/InvoiceService.cs` | `Validate` rejects `status == "closed"` |
| `desktop/Sirman.Core/Printing/NativePrintBidi.cs` | LTR wrap vs hyphen reverse helper |
| `desktop/Sirman.Core/Printing/PostalLabelFieldPlan.cs` | `NumericPresentation` for zip/tel |
| `desktop/Sirman.Desktop/NativeWindowsPrintService.cs` | native postal draw uses LTR wrap |
| `desktop/Sirman.Core.Tests/NativePrintTests.cs` | stored zip stays `2000-35155` |
| `test_laegh.js` | beforeunload must **not** gate on `isDirty`; postal zip must not reverse in storage |

Linux cannot show Chrome/WebView2 leave dialogs or GDI glyph order. Shop visual confirmation remains required.

---

## H1 — Refresh warning after completing a Store invoice

### Trace

```text
operator: تکمیل فاکتور (btn-close / closeInv)
  → withSaveLock('closeInv')
  → getData()  (status from invStatus)
  → host path: takeBusinessCore('invoice.close')  OR  local close + stock
  → persist: persistCoreSnapshot(['invoices','inventory']) → sv()
             OR sv()
  → safePersist('invoice')
  → ntf('فاکتور تکمیل شد…')
  → optional promptDepositPick (if tF > 0 and accounts exist)
  → emit('invoice:closed')  → renderDashboard / renderSidebarBadges (try/catch)
  → clearInv()
  → leaveFormToList('saved')  → winMountPage / winClose sibling / showPageClassic
```

`closeInv` does **not** call `location.reload`. Every `location.reload` in `Sirman_Final.html` is on the update/downgrade path only (L7204, L7369, L7383, L7398). `winClose` / `winMountPage` move page DOM inside the same document; they do not unload the WebView document.

### Exact messages on or next to the success path

| Source | Message | When |
|---|---|---|
| `closeInv` success | `فاکتور تکمیل شد` (+ optional stock/swap suffix) | every successful complete |
| `safePersist` | `برای امنیت داده، از تنظیمات → انتخاب فایل ذخیره را بزنید` as `err` | first persist in a session with **no** backup folder (`!_warnedNoFolder && !folderReady`) |
| `withSaveLock` | `در حال ذخیره… لطفاً صبر کنید` as `err` | second click while lock held |
| already closed | `این فاکتور قبلاً تکمیل شده` as `err` | local path if `status`/`invStatus` already `closed` |
| Core close fail | `تکمیل فاکتور انجام نشد` / Core `error` | host `invoice.close` not ok |
| `_sirmanBeforeUnloadHandler` | `e.returnValue = 'قبل از خروج بک‌آپ بگیرید'` | **any** document unload while `_sirmanAllowUnload` is false. Chrome typically shows a generic “Reload site?” / leave-page dialog, not this Persian string |
| Service worker (unrelated) | `🔄 نسخه جدید برنامه نصب شد — صفحه را Refresh کنید` | SW `updatefound` → activated — **not** on `closeInv` |
| `promptDepositPick` | account-pick modal | after complete when `tF > 0` and accounts exist — not a refresh warning |

### Dirty flag vs warning

- `sv()` (L7594–7603) writes localStorage then **always** `markDirty()`. Completing an invoice therefore leaves `isDirty === true`.
- `clearDirty()` is used on export/autosave success, **not** from `closeInv`.
- `_sirmanBeforeUnloadHandler` (L9714–9727) does **not** check `isDirty`. Automated test in `test_laegh.js` **requires** that: `uh.indexOf('if (isDirty)') === -1` — “بستن ✕ باید همیشه هشدار بدهد”.
- Help text (L5424) says the smart-close warning appears **if there are unsaved changes**. Source does not gate `beforeunload` on dirty. That is a help/code mismatch, not proof that complete reloads the page.

### Does a refresh actually occur after complete?

**No in source.** Complete is an in-document persist + SPA navigation to the saved list. A browser “reload warning” fires only if something else unloads the document (user F5, WebView navigation, host CloseApp, update reload). Completing an invoice does not itself unload.

### Can a warning appear after a successful complete?

**Yes — in-app toast, not a page reload.** `closeInv` always calls `safePersist('invoice')` after a successful persist. If no backup folder is selected, the first such call in the session toasts an **error-styled** backup reminder immediately after `فاکتور تکمیل شد`. That toast is unrelated to refresh/cache and does not mean the invoice failed to save.

If the human saw Chrome’s generic leave/reload dialog, that requires an unload event. Source does not emit one from `closeInv`. Whether WebView2 ever synthesizes `beforeunload` on SPA window close is **not proven** here.

### Conclusion

**POSSIBLE**

Strongest proven on-path mechanism: `safePersist` no-folder toast after successful `closeInv`.  
Browser refresh/leave dialog: **possible if unload happens**, always-armed, **not caused by `closeInv` itself**.  
False “invoice did not save” from `closeInv`: **not supported** — success toast and persist run before the warning candidates.

Evidence:
- `Sirman_Final.html` `closeInv` L12484–12584: persist → success `ntf` → `clearInv` → `leaveFormToList`; no `location.reload`.
- `Sirman_Final.html` `safePersist` L7428–7444: error toast when backup folder missing.
- `Sirman_Final.html` `_sirmanBeforeUnloadHandler` L9714–9729: always sets `returnValue`; not gated on `isDirty`.
- `Sirman_Final.html` `sv` L7602: `markDirty()` after every invoice persist.
- `test_laegh.js` L2577–2581: beforeunload must not check `isDirty`.

Severity: Medium (UX / trust). Not a proven data-loss path.

Risk: Operator may treat a backup-folder reminder or a later leave dialog as “complete failed”, or may dismiss real backup prompts. Completing still marks the session dirty, so a later real close is more likely to show the always-on leave dialog.

Exact source location:
- `closeInv` — `Sirman_Final.html` L12484–12584
- `safePersist` — `Sirman_Final.html` L7428–7444
- `_sirmanBeforeUnloadHandler` — `Sirman_Final.html` L9714–9729
- `sv` / `markDirty` — `Sirman_Final.html` L7594–7613
- `leaveFormToList` / `winClose` — `Sirman_Final.html` L12641–12663, L11016–11035

Candidate fix (DO NOT IMPLEMENT in this packet):
- Do not call the no-folder `safePersist` toast on the invoice-complete success path, or show it as info rather than `err`, and/or call `clearDirty()` after a successful complete+persist if product policy allows.
- Optionally gate `beforeunload` on real unsaved work (conflicts with current automated test that forbids `if (isDirty)`).
- Align help L5424 with actual always-on leave behavior.

Regression risk: Changing `beforeunload` or `isDirty` after complete can hide a real backup prompt on app close. Changing `safePersist` can hide a real “no backup folder” reminder. Any fix must stay off Print / Storage schema / Backup restore.

Human verification required: YES  
Shop should note the **exact** dialog/toast text after complete (Persian toast vs Chrome “Reload site?” vs deposit-account modal).

---

## H3 — Store invoice cannot be edited after closing

### Lifecycle

```text
open form  invStatus='open'   btn-close visible
  saveInv  → status from invStatus (often still 'open') → clearInv → list
  closeInv → status='closed', hide btn-close, persist, clearInv, leaveFormToList('saved')
closed list row still has button «✏ ویرایش» → loadInv
  loadInv sets invStatus from record, hides btn-close if closed, toast «برای ویرایش بارگذاری شد»
  saveInv does not check status==='closed' → overwrites the same record
  closeInv local path rejects second complete: «این فاکتور قبلاً تکمیل شده»
  Core InvoiceService.Validate: status=="closed" → Fail "این فاکتور قبلاً تکمیل شده"
correction: deleteInvoiceAt → reverseInvoiceLocal restocks closed invoices (not in-place reopen)
```

### Business-rule evidence in source and help

- Help L5416: after save or complete, the form closes and the operator returns to the invoice list so the previous invoice does not stay on the form.
- AI KB L28090: «با تکمیل فاکتور بسته می‌شود».
- Local `closeInv` L12541–12542 and Core `InvoiceService.Validate` L17–18: second complete is rejected.
- Test `InvoiceClose_RejectsAlreadyClosed` (`Phase2CompleteTests.cs` L156–161).

### What is locked vs what is not

| Action after complete | Source behavior |
|---|---|
| Keep filling the same form | **Blocked by design:** `clearInv()` resets `invStatus` to `open` and empties fields; `leaveFormToList('saved')` leaves the form |
| Complete a second time | **Blocked:** HTML + Core business rule |
| Open from saved list «ویرایش» | **Allowed:** `loadInv` loads closed invoices; only hides `#btn-close` |
| Save changes to a closed invoice | **Allowed in HTML:** `saveInv` has no `status==='closed'` guard; `getData()` copies `invStatus` (still `closed` after `loadInv`) and overwrites the record without `invoice.close` / stock reversal |
| Reopen / un-complete | **Not implemented.** Correction is delete + `reverseInvoiceLocal` restock |

If the operator remained on the cleared form and concluded “cannot edit”, that matches the intended leave-form behavior, not a missing list button.

If the operator meant “closed invoices must be immutable”, HTML `saveInv` does **not** implement that lock. That is a residual integrity gap, not the same as “no edit UI”.

### Conclusion

**INTENDED BUSINESS RULE** for: (1) cannot keep filling the completed form, (2) cannot complete twice.  
Hard lock on all post-close edits: **not present** in HTML `saveInv`. Whether the shop could not find «ویرایش» on the saved list is **UNKNOWN** without the human’s exact clicks.

Evidence:
- `closeInv` + `clearInv` + `leaveFormToList` — `Sirman_Final.html` L12484–12678
- Help — `Sirman_Final.html` L5416, L28090
- List «ویرایش» — `Sirman_Final.html` L12799
- `loadInv` — `Sirman_Final.html` L12884–12926 (loads closed; hides complete; still toasts edit-loaded)
- `saveInv` — `Sirman_Final.html` L12609–12639 (no closed guard)
- `InvoiceService.Validate` — `desktop/Sirman.Core/Business/InvoiceService.cs` L17–18
- `reverseInvoiceLocal` — `Sirman_Final.html` L8334–8361

Severity: Low as “cannot continue after complete” (intended). Medium residual if closed invoices are mutated via `saveInv` without stock reversal.

Risk: Operators who need a correction may think the invoice is frozen; operators who find «ویرایش» can change a closed invoice without going through `invoice.close`. Stock was already consumed at complete; `saveInv` does not reverse or re-consume.

Exact source location:
- `closeInv` — `Sirman_Final.html` L12484–12584
- `saveInv` — `Sirman_Final.html` L12609–12639
- `loadInv` — `Sirman_Final.html` L12884–12926
- `renderSaved` edit button — `Sirman_Final.html` L12799
- `InvoiceService.cs` L17–18
- Help L5416

Candidate fix (DO NOT IMPLEMENT in this packet):
- If product policy is “closed = immutable except delete/reverse”: guard `saveInv` (and field writes) when `status==='closed'`, keep «ویرایش» as view-only or remove it, point operators to delete/reverse.
- If product policy is “closed = cannot complete again, but header/notes remain editable”: keep `saveInv`, document it, and do not treat H3 as a bug.
- Do not reopen closed invoices in-place without an explicit reversal packet.

Regression risk: Blocking `saveInv` on closed invoices would stop a currently working list-edit path. Allowing reopen would double-consume stock unless reversal is designed. Invoice state model is frozen in this packet.

Human verification required: YES  
Confirm whether the operator stayed on the empty form, used the saved list, or expected to complete again.

---

## H4 — Mixed RTL strings such as `2000-35155` display as `35155-2000`

### Stored value

**Not reversed.**

- Inputs `#snd-zip` / `#rcv-zip` have no transform on `input`.
- `readPostalLabelData` copies `element.value` (L13471–13481).
- Native parse tests keep `2000-35155` (`NativePrintTests.cs` L273–281).
- HTML test: `assertEqual(r.zip, '2000-35155', 'کدپستی ذخیره‌شده نباید معکوس شود')` (`test_laegh.js` ~L6195).
- `NativePrintBidi.ReverseHyphenated("2000-35155")` returns `35155-2000` and is used in tests only — **not** on the print/save path.

`.value` stays `2000-35155` even when the glyphs on screen look swapped. That is Unicode Bidirectional Algorithm display, not a storage mutation.

### Input attributes and CSS

```html
<!-- Sirman_Final.html L2623, L2641 — no dir="ltr" -->
<input id="snd-zip" placeholder="کدپستی ۱۰ رقمی">
<input id="rcv-zip" placeholder="کدپستی">
```

Global form CSS L743:

```css
.f input,.f select,.f textarea{ ... direction:rtl; ... }
```

Existing `dir="ltr"` elsewhere (company English name, network path, SMS URL, IP) is **not** applied to zip/tel. `#snd-zip` / `#rcv-zip` inherit RTL.

In an RTL embedding, a hyphenated European-number token such as `2000-35155` is a well-known UBA reordering: the two numeric runs can paint as `35155-2000` while the DOM value is unchanged. Same class of effect for `1234-5678`. `A12-345` is mixed L + EN and can also look reordered around the hyphen. A Persian address (RTL letters) plus a numeric token in the same RTL box can place the token on the visual left/right independently of storage order.

### Render / HTML print

- Preview `buildPostalPreviewCards` interpolates `${snd.zip}` / `${rcv.zip}` into `.postal-wrap { direction:rtl }` with **no** LTR isolate (L923, L13483–13500).
- `printPostal` dumps that preview HTML into `<html dir="rtl">` + `body{direction:rtl}` (L13555–13561).
- Invoice/warranty HTML print also uses `direction:rtl` without zip LTR spans.

HTML display and HTML print share the same mechanism.

### Native print

- `PostalLabelFieldPlan.NumericPresentation` wraps stored zip/tel with U+202A … U+202C (`AsLeftToRight`).
- `NativeWindowsPrintService` draws those fields with `PostalLtrWrapFormat()` (no RTL flag) at L447–448 and L486–487.
- Stored model is not hyphen-reversed.
- GDI visual order on shop paper is **not** verified on this Linux agent.

### Impact table

| Surface | `2000-35155` vs `35155-2000` |
|---|---|
| Stored `.value` / localStorage / native parse | **Not swapped** (PROVEN) |
| HTML zip/tel fields (`direction:rtl`, no `dir="ltr"`) | **Visual swap expected** (PROVEN as UBA+CSS mechanism) |
| HTML postal preview + `printPostal` | **Same mechanism** (PROVEN in source; shop pixels not captured here) |
| Native postal GDI | Isolation present in source; shop visual **UNKNOWN** |
| Invoice HTML print of phone-like tokens | Same RTL interpolation; zip is not a primary invoice field |

Examples used in this trace: `2000-35155`, `1234-5678`, `A12-345`, Persian address + numeric token. No source mutates those strings to the hyphen-reversed form.

### Conclusion

**PROVEN** for HTML **display** (and HTML print) of hyphenated ASCII numeric tokens in RTL fields/cards.  
Stored value is **not** mutated.  
Native print is **mitigated in source** (`AsLeftToRight` + LTR `StringFormat`); shop paper still needs human eyes.

Evidence:
- CSS `.f input { direction:rtl }` — `Sirman_Final.html` L743
- Zip inputs without `dir="ltr"` — L2623, L2641
- `readPostalLabelData` — L13471–13481
- `buildPostalPreviewCards` / `printPostal` — L13483–13561
- Contrast LTR isolates elsewhere — L4367, L4503, L4758, L27437
- `NativePrintBidi.AsLeftToRight` — `desktop/Sirman.Core/Printing/NativePrintBidi.cs`
- Draw path — `desktop/Sirman.Desktop/NativeWindowsPrintService.cs` L447–448, L486–487
- Storage test — `test_laegh.js` ~L6195; `NativePrintTests.cs` L273–281

Severity: Medium for postal labels and any RTL hyphenated id the operator reads from the screen. Low for storage integrity.

Risk: Operator copies the **visual** form (`35155-2000`) into another system while the file still holds `2000-35155`. HTML print can ship the reversed appearance. Changing global RTL would regress Persian fields — packet forbids that.

Exact source location:
- `Sirman_Final.html` L743, L2623, L2641, L13471–13561
- `desktop/Sirman.Core/Printing/NativePrintBidi.cs` L15–41
- `desktop/Sirman.Core/Printing/PostalLabelFieldPlan.cs` L60–61
- `desktop/Sirman.Desktop/NativeWindowsPrintService.cs` L447–448, L486–487, L522–527

Candidate fix (DO NOT IMPLEMENT in this packet; do **not** change RTL globally):
- Set `dir="ltr"` and `unicode-bidi: isolate` (and left align) only on zip/tel (and similar identifier) inputs.
- Wrap interpolated zip/tel in HTML preview/print in `<span dir="ltr">` / `unicode-bidi:isolate`.
- Leave native `AsLeftToRight` as-is unless shop paper still shows reversal.

Regression risk: Isolating the wrong fields (addresses, names) would break Persian RTL. Hyphen-reversing stored values would corrupt postal codes and fail existing tests. Global `direction` changes are out of scope.

Human verification required: YES  
On shop UI: type `2000-35155` in `#snd-zip`, compare on-screen glyphs vs `input.value` in a probe. Repeat on HTML postal preview/print and native A5 paper.

---

## Cross-cutting

No runtime shop capture was available on this Linux agent. Classifications are from source, existing tests, and Unicode/CSS behavior that those sources imply. Unproven shop pixels are marked UNKNOWN / human verification.

Packet constraints honored: no source patch, no Print/Storage/Backup change, no invoice state model change, no global RTL change, no new tests that encode unproven assumptions.

---

## FINAL

```text
Product code changed: NO
Print changed: NO
Storage changed: NO
Backup/Restore changed: NO
Final status: COMPLETED
STOP — WAIT FOR REVIEW.
```
