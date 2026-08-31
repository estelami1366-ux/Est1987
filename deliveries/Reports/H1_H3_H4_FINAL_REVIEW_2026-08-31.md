# SIRMAN — H1 / H3 / H4 FINAL FORENSIC + PATCH DESIGN
## 2026-08-31 — READ-ONLY; no product changes

**Mode:** FINAL REVIEW — inspect current HEAD + prior forensic. Do not patch, build, package, or bump version.  
**Prior forensic:** `deliveries/OFFSITE_HUMAN_BUG_FORENSIC_2026-08-27.md` (HEAD then `cc7461a`)  
**This inspection HEAD:** `3623e2b` on `cursor/master-project-status-audit-fa01` (parent of this docs branch)  
**Live product (unchanged):** `1405.6.3α` / assembly `1405.6.3.1`  
**Store invoice in this product:** shop/service invoices (`invoices`, `closeInv`, page `saved`) — not parts sales.

```text
Product source changed: NO
Print changed:          NO
Storage changed:        NO
Backup/Restore changed: NO
Invoice state model:    NO
RTL globally:           NO
Tests added:            NO
Fix implemented:        NO
Version changed:        NO
Build/package:          NO
```

Inspected, **not** edited:

| File | Role |
|---|---|
| `Sirman_Final.html` | `closeInv`, `saveInv`, `loadInv`, `safePersist`, `beforeunload`, postal fields, HTML print |
| `desktop/Sirman.Core/Business/InvoiceService.cs` | `Validate` rejects `status == "closed"` |
| `desktop/Sirman.Core/Printing/NativePrintBidi.cs` | LTR wrap vs hyphen reverse helper |
| `desktop/Sirman.Core/Printing/PostalLabelFieldPlan.cs` | `NumericPresentation` for zip/tel |
| `desktop/Sirman.Desktop/NativeWindowsPrintService.cs` | native postal draw uses LTR wrap |
| `desktop/Sirman.Core.Tests/NativePrintTests.cs` | stored zip stays `2000-35155` |
| `test_laegh.js` | beforeunload must **not** gate on `isDirty`; postal zip must not reverse in storage |

Linux cannot show Chrome/WebView2 leave dialogs or GDI glyph order. Shop visual confirmation remains required for H1 exact dialog text and H4 native paper.

---

## 1. Executive summary

H1 is **not** a proven “complete failed / page reloaded” bug. Completing a Store invoice persists, toasts success, clears the form, and navigates in-document to the saved list. No `location.reload` is on that path. The always-on `beforeunload` handler is **armed even with no dirty check**, but complete itself does not unload. On Desktop (`sirmanHost.WriteBackupText` present) the no-folder error toast is **unlikely** after complete. Exact shop dialog text is still missing.

H3 is **not** “edit UI missing”. Closed means `status === 'closed'`. Second complete is blocked. List «ویرایش» loads a closed invoice. `saveInv` can still overwrite it **without** stock reversal. Help tells operators to edit a completed invoice. That is a **policy conflict**, not a proven defect.

H4 is a **proven HTML display bug** (Unicode Bidirectional Algorithm in RTL containers). Stored values are **not** reversed. Native print already isolates zip/tel in source. Smallest safe fix is HTML-only `dir="ltr"` / `unicode-bidi: isolate` on postal zip/tel — **not** Native Postal, **not** Print renderer, **not** Storage.

**Packet verdict: B** — evidence is sufficient; H4 is the only patch authorized without extra policy; H1 needs the shop’s exact string; H3 needs a written business rule.

HEAD delta vs 2026-08-27 forensic that matters:

- `isBackupFolderReady()` returns true when `sirmanHost.WriteBackupText` exists (`Sirman_Final.html` L9613–9624). The old “no-folder err toast after every Desktop complete” hypothesis is **weaker** for shop `Sirman.exe`.
- Native postal draw of zip/tel is now `DrawPostalIdBlock` / `MeasurePostalIdBlock` with `PostalLtrWrapFormat()` (L483–533), not the older L447 line numbers.

---

## 2. H1 — Refresh / warning after Store invoice complete

### Classification

**AMBIGUOUS** as a product “false refresh warning” bug.

Proven pieces:

- Success path does **not** reload.
- A success toast **does** appear after persistence.
- `beforeunload` **is** always armed (does not check `isDirty`).
- Completing an invoice does **not** fire `beforeunload`.

Not proven: that shop saw a **false** warning caused by complete itself on `Sirman.exe`.

### Runtime path (current HEAD)

```text
operator: تکمیل فاکتور  (#btn-close → closeInv)
  → withSaveLock('closeInv')
  → getData()                    // rec.status = invStatus  (L12482)
  → host: takeBusinessCore('invoice.close')
     OR local close + stock consume
  → persist: persistCoreSnapshot(['invoices','inventory'])  OR  sv()
  → safePersist('invoice')
  → ntf('فاکتور تکمیل شد' [+ stock/swap suffix])     // type default 'ok'
  → optional promptDepositPick  if tF > 0 && accounts.length
  → emit('invoice:closed')  → renderDashboard / renderSidebarBadges
  → clearInv()                   // invStatus reset to 'open'; does NOT clearDirty
  → leaveFormToList('saved')     // winMountPage / winClose sibling / showPageClassic
```

`closeInv`: `Sirman_Final.html` L12493–12593.

`leaveFormToList` (L12650–12671) remounts SPA pages in the **same document**. It does not set `location`, does not call `reload`, does not unload WebView.

### Answers (required)

| # | Question | Answer |
|---|---|---|
| 1 | Exact user-visible message | **Success (always, after persist):** `فاکتور تکمیل شد` plus optional ` — موجودی انبار به‌روز شد` and/or ` — N تعویض به انبار معیوب`. Produced by `ntf(...)` default type `ok` in `closeInv` L12537 / L12585. **Candidates that can look like a warning:** (a) `برای امنیت داده، از تنظیمات → انتخاب فایل ذخیره را بزنید` as `err` from `safePersist` L7450; (b) browser generic leave/reload dialog from `_sirmanBeforeUnloadHandler` which sets `e.returnValue = 'قبل از خروج بک‌آپ بگیرید'` (Chrome/WebView typically **hides** this Persian string); (c) deposit modal, not a warning; (d) SW toast `🔄 نسخه جدید برنامه نصب شد — صفحه را Refresh کنید` L15324 — **not** on `closeInv`. Shop exact string is **not captured** in this packet. |
| 2 | Exact function producing it | Success: `closeInv` → `ntf`. No-folder: `safePersist`. Leave dialog: `_sirmanBeforeUnloadHandler`. Deposit: `promptDepositPick`. SW: `registerLaeghSW`. |
| 3 | Exact condition | Success: persist succeeded. No-folder toast: `!window._warnedNoFolder && !folderReady` where `folderReady = isBackupFolderReady()`. Desktop: `isBackupFolderReady` is **true** if `getSirmanHostSync().WriteBackupText` exists (L9618). Leave dialog: any document unload while `_sirmanAllowUnload` is false. SW: worker `activated` with an existing controller. |
| 4 | Appears AFTER successful persistence? | Success toast: **yes, by design**. No-folder toast: **yes, after** `sv`/`persistCoreSnapshot`, if it fires. Leave dialog: **only if a later unload happens**, not as a step of complete. |
| 5 | Does an actual reload happen? | **No** on the complete path. All `location.reload` sites are update/downgrade (L7213, L7378, L7392, L7407). |
| 6 | Is `beforeunload` armed with no dirty state? | **Yes.** Handler L9723–9736 does not read `isDirty`. Test `test_laegh.js` L2581 **requires** `uh.indexOf('if (isDirty)') === -1`. `sv()` L7611 always `markDirty()` after persist, and `closeInv` never calls `clearDirty()` (L12037). So after complete, `isDirty === true` anyway — but the handler would warn even if it were false. |
| 7 | Is the message a false positive? | **If** shop saw the no-folder `err` toast after a successful Desktop complete: that toast would be a **false alarm about persistence** (invoice already saved). On `Sirman.exe` that toast is **unlikely** because `WriteBackupText` makes `isBackupFolderReady()` true. **If** shop saw Chrome “Reload site?” after F5/close: that is **EXPECTED** always-on leave behavior, not a complete-path false positive. **If** shop treated the green success toast as a warning: misread, not a bug. |
| 8 | Could changing it hide a real backup/persistence problem? | **Yes, if `beforeunload` is gated on `isDirty`:** closing ✕ would stop warning when the session looks clean, which current tests and help-adjacent backup practice forbid. **Yes, if `safePersist` no-folder toast is removed globally:** HTML-only users with no folder would lose the one-shot reminder. Softening that toast from `err` to info **on the closeInv success path only**, or skipping it when persist just succeeded, does **not** hide a failed save (the save already finished). |

### Help / code mismatch (not the shop bug by itself)

Help L5433: smart-close warning appears **if there are unsaved changes**.  
Source: `_sirmanBeforeUnloadHandler` always sets `returnValue`.  
`promptExitBackup` is also not gated on dirty (`test_laegh.js` L2574).

### Minimal patch design (DO NOT IMPLEMENT)

Do **not** add `if (isDirty)` to `_sirmanBeforeUnloadHandler`. That is the highest-risk change and fails an existing test.

Smallest safe change **if** shop confirms the no-folder `err` toast (or HTML-only path):

1. In `closeInv`, after successful persist, call `safePersist('invoice')` as today.
2. Either pass a flag so `safePersist` does not toast `err` on this success path, **or** toast the same sentence as info (`ntf(..., 'ok')` or a dedicated info type) instead of `err`.
3. Optional, **policy-gated**: `clearDirty()` after successful complete+persist. Only if product policy agrees that a completed invoice is “saved work”. Conflicts with “always warn on ✕”.

Do **not** change Backup/Restore, Storage schema, Print, or `sv()` write keys.

If shop confirms Chrome leave/reload **without** F5/close: that would be a WebView unload mystery and needs a **new** forensic (classification stays AMBIGUOUS until then). Do not “fix” it by disabling `beforeunload`.

---

## 3. H3 — Closed Store invoice editability

### Classification

**POLICY UNRESOLVED**

Intended in source and help: leave the form after complete; cannot complete twice.  
Hard immutability of a closed invoice: **not implemented**.  
Help L5844 **documents editing a completed invoice**. Inventing “closed must be frozen” would contradict that help text.

### What “closed / completed” means (current source)

| Layer | Meaning |
|---|---|
| In-memory form | `invStatus` (`'open'` / `'closed'`). `clearInv` L12679 resets it to `'open'`. |
| Record | `getData()` L12482 sets `status: invStatus`. Local `closeInv` L12569–12570 sets `invStatus='closed'` and `d.status='closed'`. Host path L12522 plus Core `InvoiceService.Close` sets `status = "closed"` and `closedAt`. |
| Badge / button | `#inv-st` → `✓ تکمیل`; `#btn-close` hidden (`display:none`). |
| List | `renderSaved` L12807–12808: badge `✓ تکمیل` vs `⏳ باز`. |
| Core | `InvoiceService.Validate`: `status == "closed"` → Fail `"این فاکتور قبلاً تکمیل شده"` (`InvoiceService.cs` L16–18). Used by **close**, not by HTML `saveInv`. |

There is **no** reopen / un-complete operation.

### Trace

```text
create/open form     invStatus='open', #btn-close visible
  saveInv            status copied from invStatus (often still 'open')
                     overwrite or push → sv → safePersist → clearInv → list
  closeInv           status='closed', hide #btn-close, persist, stock consume,
                     clearInv, leaveFormToList('saved')
list row             always «✏ ویرایش» + «👁 مشاهده»  (renderSaved L12808)
  loadInv            sets invStatus from record; hides #btn-close if closed;
                     toast «فاکتور N برای ویرایش بارگذاری شد»  (L12935)
  saveInv            NO closed guard → overwrites same record via editingInvIdx
                     sv + safePersist; does NOT call invoice.close;
                     does NOT reverse or re-consume stock
  closeInv again     HTML L12550–12551 and Core Validate: blocked
correction           deleteInvoiceAt → invoice.delete / reverseInvoiceLocal
                     restock if closed && !_stockReversed (L8343–8353)
```

### Answers (required)

| # | Question | Answer |
|---|---|---|
| 1 | What closed/completed means | `status === 'closed'` on the invoice record; form `invStatus`; Core close writes `closedAt`. Not a separate workflow state machine. |
| 2 | Is reopening/editing intentionally allowed? | **Editing from the list is implemented and documented** (help L5844: if completed, edit the same invoice unless manager wants a new one). **Reopen to complete again is intentionally forbidden.** Help L5425: after save or complete, leave the form so the previous invoice does not stay on it. |
| 3 | Is Save blocked for a completed invoice? | **No.** `saveInv` L12618–12648 has no `status==='closed'` check. |
| 4 | Can Edit load a completed invoice? | **Yes.** `loadInv` L12893–12935 loads any index; only hides `#btn-close`. Detail modal also has «ویرایش» (L12875). |
| 5 | Can `saveInv` mutate a completed invoice? | **Yes.** `getData()` copies current `invStatus` (`closed` after `loadInv`). `invoices[editingInvIdx]=d` overwrites seller, phone, notes, **items, totals**. Persist via `sv()`. Core `invoice.close` is not invoked. |
| 6 | Stock / payment / business consequences? | **At complete:** stock consume (Core `InventoryCore.Consume` or local qty-1) and optional `promptDepositPick`. **At later `saveInv`:** no reverse, no re-consume, no payment reverse. Changing item codes/qty on a closed invoice can **desync stock** from the record. Payments already posted stay unless the invoice is deleted. |
| 7 | Correction / reversal mechanism? | **Delete**, not in-place reopen. `deleteInvoiceAt` L8414 → Core `invoice.delete` or `reverseInvoiceLocal` L8343. Closed invoices get restock unless `_stockReversed`. Linked account trx reversed. Confirm copy: «موجودی و مبلغ مربوط به همین فاکتور برمی‌گردد.» |
| 8 | Business-rule defect or UX ambiguity? | **UX of “cannot keep typing after complete” is intended.** Residual **integrity gap** if policy is immutability. Residual **operator confusion** if they never used the list button. **Cannot classify as BUG** without choosing a policy: help currently allows list-edit of completed invoices. |

### Minimal patch design (DO NOT IMPLEMENT)

Do **not** invent a rule in code.

**If policy = closed is immutable except delete/reverse:**

1. At the top of `saveInv`, if `invStatus==='closed'` or `d.status==='closed'`: `ntf('فاکتور تکمیل‌شده را نمی‌توان از اینجا تغییر داد. برای اصلاح، حذف با برگشت موجودی را بزنید یا با مدیر هماهنگ کنید.','err'); return;`
2. In `renderSaved` / `viewInv`, keep «👁 مشاهده»; change «✏ ویرایش» on closed rows to view-only or hide it.
3. `loadInv` may still open as read-only, or refuse closed records.
4. Update help L5844 to match.
5. Do **not** add in-place reopen in the same packet (stock double-consume risk).

**If policy = closed cannot be completed again, but header/notes (or even lines) stay editable:**

1. No `saveInv` guard.
2. Help L5425/L5844 already match; optionally label the list button «ویرایش / اصلاح» and state that stock does not re-run.
3. Optional later packet: warn when closed line items change, without blocking header fields.

Neither option is authorized in this packet.

---

## 4. H4 — RTL / numeric visual order (`2000-35155`)

### Classification

| Surface | Classification |
|---|---|
| Stored value (input `.value`, `senderInfo`, postal history, native parse) | **EXPECTED** — not reversed |
| HTML input display (`#snd-zip`, `#rcv-zip`, `#snd-tel`, `#rcv-tel`) | **BUG** — UBA in RTL field |
| HTML preview (`.postal-wrap`) | **BUG** — same mechanism |
| HTML print (`printPostal`) | **BUG** — dumps preview into `dir="rtl"` |
| Native print source | **EXPECTED** — LTR isolation present; shop GDI pixels still **UNKNOWN** |

### Trace of tokens

No source path mutates `2000-35155` → `35155-2000` on save or print. `NativePrintBidi.ReverseHyphenated` is **tests-only**.

| Token | Stored | HTML input / preview / HTML print | Native draw |
|---|---|---|---|
| `2000-35155` | unchanged (`test_laegh.js` L6259; `NativePrintTests.cs` L273–281) | two EN runs + hyphen in RTL → classic UBA visual `35155-2000` | `AsLeftToRight` + `PostalLtrWrapFormat()` |
| `1234-5678` | unchanged | same UBA class | same isolate |
| `A12-345` | unchanged | mixed L+EN; hyphen neighborhood can look reordered | isolate on zip/tel only |
| Persian address + numeric token | address stored as typed (`rcv.addr` L6260 keeps `اصفهان، خیابان چهارباغ`) | address fields **must stay RTL**; a bare number inside an RTL address can visually jump | address uses `PostalRtlWrapFormat()`; zip/tel isolated separately |

### Answers (required)

| # | Question | Answer |
|---|---|---|
| 1 | Stored value unchanged? | **Yes.** `readPostalLabelData` copies `element.value`. Inputs have no transform on `input`. Native parse keeps `2000-35155`. HTML test forbids stored reverse. |
| 2 | HTML uses RTL container for numeric values? | **Yes.** Global `.f input` L743: `direction:rtl`. Zip/tel inputs L2623–2644 have **no** `dir="ltr"`. Preview `.postal-wrap` L923: `direction:rtl`. `buildPostalPreviewCards` interpolates `${snd.zip}` / `${rcv.zip}` / tel into that wrap with **no** LTR span (L13492–13509). |
| 3 | UBA/Bidi visual reversal? | **Yes, as mechanism.** Hyphenated European-number tokens in an RTL embedding reorder visually while DOM/storage stay logical. This is the same class of bug the Native layer already mitigates. |
| 4 | Native uses LTR isolation? | **Yes in source.** `PostalLabelFieldPlan.NumericPresentation` → `NativePrintBidi.AsLeftToRight` (U+202A … U+202C). `DrawPostalIdBlock` / `MeasurePostalIdBlock` use `PostalLtrWrapFormat()` (no `DirectionRightToLeft`) at `NativeWindowsPrintService.cs` L483–533. This packet must **not** change that path. |
| 5 | Exact selectors / functions | Inputs: `#snd-zip`, `#snd-tel`, `#rcv-zip`, `#rcv-tel`. CSS: `.f input` L743; `.postal-wrap` L923. Read: `readPostalLabelData`. Preview: `buildPostalPreviewCards`, `updatePostalPreview`. HTML print: `printPostal` L13564–13570 (`<html dir="rtl">` + body `direction:rtl` + preview `cont`). Native (do not touch): `PostalLabelFieldPlan.NumericPresentation`, `NativePrintBidi.AsLeftToRight`, `PostalLtrWrapFormat`, `DrawPostalIdBlock`. Contrast existing isolates: `#co-name-en`, `#net-shared-folder`, `#sms-url` already have `dir="ltr"`. Invoice `#inv-phone` L2282 is the same RTL class but is **out of the smallest postal-scoped patch**. |
| 6 | Can scoped `dir=ltr` / `unicode-bidi:isolate` apply only to postal-code/phone? | **Yes.** Attribute + CSS on the four zip/tel inputs; wrap interpolated zip/tel (not address, not name) in `<span dir="ltr" style="unicode-bidi:isolate">` inside `buildPostalPreviewCards`. HTML print reuses that HTML, so it inherits the isolate. Do not set `dir=ltr` on `#snd-addr` / `#rcv-addr` / names. Do not change Native Postal. Do not hyphen-reverse stored strings. |

### Minimal patch design (DO NOT IMPLEMENT)

HTML only. Keep `Sirman_Final.html` and `Laegh_Final.html` byte-identical if HTML is changed later.

1. On `#snd-zip`, `#snd-tel`, `#rcv-zip`, `#rcv-tel`: add `dir="ltr"` and `style="text-align:left;unicode-bidi:isolate"` (or a dedicated class e.g. `.id-ltr { direction:ltr; unicode-bidi:isolate; text-align:left; }` applied only to those four).
2. In `buildPostalPreviewCards`, wrap zip and tel interpolations only:

```html
کدپستی: <b><span dir="ltr" style="unicode-bidi:isolate">${snd.zip||''}</span></b>
شماره تماس: <span dir="ltr" style="unicode-bidi:isolate">${snd.tel||''}</span> ${snd.person||''}
```

Keep `${snd.person||''}` **outside** the LTR span (Persian name). Same for receiver zip/tel.

3. Do **not** edit `printPostal` CSS globally; preview HTML already flows into `printPostal`.
4. Do **not** touch `NativeWindowsPrintService`, `NativePrintBidi`, `PostalLabelFieldPlan`, PaperSize, Storage, Backup.
5. Add an HTML test that the four inputs include `dir="ltr"` and that `buildPostalPreviewCards` contains `dir="ltr"` around zip — without asserting GDI pixels.

---

## 5. Cross-impact

### H1 (only if shop confirms no-folder `err` toast)

| Item | Detail |
|---|---|
| Files | `Sirman_Final.html` (and `Laegh_Final.html` twin) — `safePersist`, optionally `closeInv` |
| Functions | `safePersist`, `closeInv`, **not** `_sirmanBeforeUnloadHandler` |
| Regression risk | Removing the toast globally hides a real “no backup folder” reminder on HTML-only. Gating `beforeunload` on `isDirty` hides real close-backup prompts and fails `test_laegh.js` L2581. |
| Affected | Invoice complete success UX; first-session persist reminder |
| Unaffected | Print, Native Postal, PaperSize, Storage schema, Backup/Restore merge/replace, stock, invoice status |
| Required tests | Existing persist tests still pass; assert complete path still calls `safePersist` / `sv`; do not encode shop dialog text into tests until captured |
| Shop verification | Exact toast/dialog screenshot **before** changing anything. After change: complete invoice, confirm success toast, confirm no `err` false alarm, confirm ✕ still warns |

### H3 (only after written policy)

| Item | Detail |
|---|---|
| Files | `Sirman_Final.html` — `saveInv`, `renderSaved`, `loadInv`, `viewInv`, help L5844. Core `InvoiceService` already rejects **close** of closed; do not expand Core unless policy says save must go through Core. |
| Functions / selectors | `saveInv`, `loadInv`, `renderSaved` button `onclick="loadInv"` , `#btn-close` |
| Regression risk | Blocking `saveInv` on closed **breaks** the currently working list-edit path and contradicts help L5844. Allowing reopen without reverse **double-consumes stock**. |
| Affected | Saved-invoice list, invoice form Save, correction via delete |
| Unaffected | Print renderer, Native Postal, PaperSize, Storage keys, Backup/Restore |
| Required tests | If freeze: execution test that `saveInv` on `status==='closed'` does not overwrite. If allow: test that list-edit of closed still updates notes without calling `invoice.close`. Keep `InvoiceClose_RejectsAlreadyClosed`. |
| Shop verification | Manager states whether completed invoices may be header-edited. Then one closed invoice: Edit, change notes, Save; confirm stock qty unchanged. Separate: try Complete again — must stay blocked. |

### H4 (HTML isolate)

| Item | Detail |
|---|---|
| Files | `Sirman_Final.html` / `Laegh_Final.html` — four inputs + `buildPostalPreviewCards` only |
| Functions / selectors | `#snd-zip`, `#snd-tel`, `#rcv-zip`, `#rcv-tel`; `buildPostalPreviewCards`; CSS `.f input` **not** globally inverted |
| Regression risk | Isolating address/name fields breaks Persian RTL. Changing stored strings fails `test_laegh.js` L6259 and `NativePrintTests`. Touching Native Postal / Print renderer is **out of authorization** for this packet. HTML-only isolate can make on-screen zip look different from older native paper if shop GDI still reverses — that is a later Native packet, not this patch. |
| Affected | Postal form inputs, `#postal-preview`, HTML `printPostal` appearance of zip/tel |
| Unaffected | Native Postal renderer, PaperSize, invoice native print, Storage, Backup/Restore, invoice complete/save, stock |
| Required tests | Keep stored `2000-35155`. New text/execution check: zip/tel markup has `dir="ltr"`. Preview HTML for `2000-35155` contains an LTR isolate. Do not assert shop GDI. |
| Shop verification | Type `2000-35155` in `#snd-zip`; photo of input + `input.value` probe; photo of HTML preview; HTML print preview. Native A5 paper **observe only** (no Native code change). Repeat `1234-5678`, `A12-345`, Persian address with a number in `#rcv-addr` (address must remain RTL). |

---

## 6. Authorization matrix

Use exactly:

```text
H1:
NEEDS SHOP EVIDENCE

H3:
NEEDS POLICY

H4:
AUTHORIZED
```

Notes:

- H1 is not AUTHORIZED: the shop string is unknown; disabling `beforeunload` is NEEDS POLICY and would be rejected even with a string.
- H3 is not AUTHORIZED: help vs immutability is unresolved. A freeze guard is justified **only after** policy picks immutability.
- H4 HTML zip/tel isolate is AUTHORIZED without a new business rule. It does not touch Print renderer, Native Postal, PaperSize, Storage, or Backup. Shop photos remain **verification after implement**, not a gate on designing the HTML isolate.

None of H1/H3/H4 should be implemented in **this** packet.

---

## 7. Test plan (for a later implementation packet)

Do not add tests in this packet.

### Automated (later)

1. Existing: `node test_laegh.js Sirman_Final.html` — beforeunload must still omit `if (isDirty)`; postal zip storage `2000-35155`.
2. Existing: `dotnet test desktop/Sirman.Core.Tests` — `InvoiceClose_RejectsAlreadyClosed`; `NativePrintTests` zip unwrap.
3. New only with H4 implement: zip/tel `dir="ltr"` present; preview isolate present; stored value still `2000-35155`.
4. New only with H3 freeze: `saveInv` does not mutate `status==='closed'`.
5. New only with H1 toast soften: complete still persists; `safePersist` still invoked; no-folder `err` not on that success path.

### Shop (later)

1. H1: complete one Store invoice; write the **exact** dialog/toast characters; note F5 vs ✕ vs deposit modal vs green success.
2. H3: after policy, closed invoice Edit/Save vs View vs Delete-reverse vs second Complete.
3. H4: photos of `2000-35155` on input, HTML preview, HTML print; native paper observe-only.

Linux agent cannot perform those shop steps.

---

## 8. Exact next implementation order

After this review is accepted:

1. **H4 HTML isolate** — first and only change that is AUTHORIZED now. `Sirman_Final.html` + `Laegh_Final.html`. Four postal zip/tel fields + preview spans. No Native, no Print renderer, no version bump unless that later packet is a release.
2. **H1** — only after shop pastes/photographs the exact warning. Then either (a) no code if it was success toast / deposit / F5 leave dialog, or (b) soften/skip no-folder `err` on `closeInv` success. Never gate `beforeunload` on `isDirty` in that packet.
3. **H3** — only after a one-line written policy: immutable vs list-edit allowed. Then either a `saveInv` guard + help fix, or help/label clarification with no freeze.

Do not combine H1/H3/H4 in one product commit. Do not use H4 as a vehicle to “also” change Native Postal.

---

## Packet verdict

**B — Evidence is sufficient but one or more need policy/shop confirmation**

H4 is AUTHORIZED for a later HTML-only packet. H1 still needs the shop’s exact string. H3 still needs a business-policy sentence. This packet implements nothing.

---

## FINAL

```text
Product code changed: NO
Print changed:        NO
Storage changed:      NO
Backup changed:       NO
Version changed:      NO
Build/package:        NO
Final status:         COMPLETED
STOP — WAIT FOR REVIEW.
```
