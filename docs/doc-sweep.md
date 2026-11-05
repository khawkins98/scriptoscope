# Doc-sweep recipe

A checklist for "I've shipped 5+ commits in 24 hours, sync the docs before the next session loads stale context."

The four context docs loaded into every Claude session — `CLAUDE.md`, `LEARNINGS.md`, `README.md`, `docs/integration-edge-cases.md` — and the consumer-facing [`docs/interaction.md`](./interaction.md) drift fast in prototype mode. False starts, knob churns, and reverted attributes leave lying comments and stale examples behind. Run this sweep after any heavy iteration day; it takes ~20 minutes and prevents every future session paying 5-10 minutes of "doc says X, code says Y" reconciliation.

## The recipe

### 1. Enumerate the deltas

```sh
git log --oneline <last-doc-commit>..HEAD
```

Categorise each commit:
- **Public API addition** — new attribute, event, method, option.
- **Public API deletion** — remove it from its authoritative reference and any affected recipes.
- **False-start + revert** — shipped then reverted within the same day (deserves a LEARNINGS entry on *why* the first try was wrong).
- **Decision-churn** — same knob flipped twice; needs a LEARNINGS supersede pointer.
- **Internal refactor** — no doc impact, skip.
- **External pitch change** — README opener or project background.

### 2. Grep each context doc for stale knob names

```sh
for term in <deleted-knob-1> <deleted-knob-2> <reverted-attr>; do
  grep -n "$term" CLAUDE.md LEARNINGS.md README.md docs/integration-edge-cases.md docs/interaction.md
done
```

- **LEARNINGS hits** → mark with `> ⚠️ Superseded by <date> — <new entry name>` blockquote pointing forward. **Never delete LEARNINGS entries** — they're the historical record. Mark and move on.
- **Other docs** → delete the stale text.

### 3. Update the authoritative home for the affected reader task

- Markup and hosted-helper contracts belong in [decorate a page](./decorate-a-page.md); lower-level recipes belong in [runtime API](./runtime-api.md). Update the existing explanation before adding another.
- Update [npm integration](./npm-consumer.md), [integration edge cases](./integration-edge-cases.md) or [interaction](./interaction.md) only when the change affects that document’s task. Do not copy every API into every guide.
- The README is orientation, one working starter, material adoption limitations and routes to the next task. Change it when those change; new APIs do not automatically warrant a README entry.
- `CLAUDE.md` holds essential contributor instructions, not a second API catalog. Keep detailed change history in the changelog and decision records.
- Verify claims against exports, source or executable examples. Remove duplicate/outdated explanations, fix moved links and check `llms.txt` discovery pointers. A new review date alone does not verify a claim.

### 4. For each decision-churn series, ONE LEARNINGS entry

Don't write one entry per pick — write one entry showing *why* the chain happened. Example: "Schemes Folder window-type went movable-modal → titled-utility-window → document-window in 24h. Period correctness ceded to runtime-supported behavior because the themed scrollbar only renders on document-window."

The lesson is the chain, not each link.

### 5. For each false-start + revert, ONE LEARNINGS entry on the misread

Pattern: user reports symptom → first fix maps to "delete the offending behavior" → revert → real fix adds a side-channel (placeholder element, opt-in attribute, lifecycle event). Future Claude will make the same mistake on a different feature if the entry isn't there.

### 6. Drift-prone numeric claims

Bundle size, lockdown property count, test count, "supports N themes." Either:
- Prefer a link to the authoritative manifest or inventory when the exact count does not help the reader, or
- Verify and update the number in the same change when the task needs it. Avoid adding “currently” as a substitute for verification.

### 7. Internal DOM stamps audit

Search the diff for new `data-scriptoscope-*` attributes the runtime sets on hosts. Each one belongs in `docs/integration-edge-cases.md`'s "Internal stamps" list so SSR consumers know to strip them.

### 8. Demo-vs-docs sync

Read every `data-scriptoscope-window-type=` line in `demo/index.html`. If the README or `integration-edge-cases.md` describes the demo's window-type choices, those descriptions MUST match. Mismatches are the most common form of doc rot.

### 9. Comments on the demo windows

The `<article>` HTML comments in `demo/index.html` often carry the rationale for the chosen attributes. If you changed an attribute, did you also update the comment above the article? Stale rationale comments mislead the next reader more than missing ones.

## When this matters most

- **The day after** a heavy iteration session — context is freshest, errors easiest to spot.
- **Before a Claude session that will touch the same area** — you'll hit the stale doc within minutes.
- **Before merging a long-running branch** — same shape, different timeline.

## The meta-principle

When a consumer footgun keeps recurring (no close hook → MutationObserver hack; type-as-hint → ambiguous; hand-rolled focus trap → a11y bug), the right answer is *promoting the consumer's workaround into a library primitive*. The widgets-opt-in + `openModal` helper + `scriptoscope:close` event triplet (commits af2a106-onward) all came from this pattern. Step 3 of this recipe — "does a NEW API addition warrant a LEARNINGS entry on what consumer-side workaround it deletes" — is the trigger.

That's the half of the answer the maintainer asked about on 2026-05-31: "incorporate some of the learnings here into… either the documentation or ensuring the code behaves in ways that just works." The other half is exactly this sweep.
