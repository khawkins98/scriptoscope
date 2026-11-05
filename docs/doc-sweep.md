# Doc-sweep recipe

A checklist for "I've shipped 5+ commits in 24 hours, sync the docs before the next session loads stale context."

The core context docs — `CLAUDE.md`, `LEARNINGS.md`, `README.md`, `docs/integration-edge-cases.md` — and the consumer-facing [`docs/interaction.md`](./interaction.md) drift fast in prototype mode. False starts, knob churns, and reverted attributes leave lying comments and stale examples behind. Run this sweep after heavy iteration, reviewing the documents affected by the changes.

## The recipe

### 1. Enumerate the deltas

```sh
git log --oneline <last-doc-commit>..HEAD
```

Categorise each commit:
- **Public API addition** — new attribute, event, method, option.
- **Public API deletion** — option you removed (remove from current usage docs and examples).
- **False-start + revert** — shipped then reverted within the same day (deserves a LEARNINGS entry on *why* the first try was wrong).
- **Decision-churn** — same knob flipped twice; needs a LEARNINGS supersede pointer.
- **Internal refactor** — no doc impact, skip.
- **External pitch change** — README opener / North Star.

### 2. Grep each context doc for stale knob names

```sh
for term in <deleted-knob-1> <deleted-knob-2> <reverted-attr>; do
  grep -n "$term" CLAUDE.md LEARNINGS.md README.md docs/integration-edge-cases.md docs/interaction.md
done
```

- **LEARNINGS hits** → mark with `> ⚠️ Superseded by <date> — <new entry name>` blockquote pointing forward. **Never delete LEARNINGS entries** — they're the historical record. Mark and move on.
- **Other docs** → delete the stale text.

### 3. Update the authoritative explanation

- Identify the affected reader and task before editing. Verify public names and behavior against exports, source and executable examples.
- Update the existing home for that information: README's compact attribute/host reference, `docs/npm-consumer.md` for the package lifecycle, `docs/integration-edge-cases.md` for integration constraints, or `docs/interaction.md` for gestures and events. Specialist APIs belong in their linked contract; a public addition does **not** automatically need a new README section.
- Replace an obsolete account rather than append another. Keep prerequisites, ownership rules, failure handling and material limitations next to the example they qualify. Link from other locations instead of repeating the explanation.
- Keep release changes in CHANGELOG/migration notes, rationale in decision records, and historical lessons in LEARNINGS. `CLAUDE.md` carries only onboarding and load-bearing working rules.
- Review the result as a newcomer: can they run the starter, choose an integration path, find an advanced option and understand its limitations? Check links and anchors, including `llms.txt` and the documentation shipped in the npm tarball.
- Report README and total documentation growth when doing a cleanup; moving words into new files alone does not reduce maintenance.

### 4. For each decision-churn series, ONE LEARNINGS entry

Don't write one entry per pick — write one entry showing *why* the chain happened. Example: "Schemes Folder window-type went movable-modal → titled-utility-window → document-window in 24h. Period correctness ceded to runtime-supported behavior because the themed scrollbar only renders on document-window."

The lesson is the chain, not each link.

### 5. For each false-start + revert, ONE LEARNINGS entry on the misread

Pattern: user reports symptom → first fix maps to "delete the offending behavior" → revert → real fix adds a side-channel (placeholder element, opt-in attribute, lifecycle event). Future Claude will make the same mistake on a different feature if the entry isn't there.

### 6. Drift-prone numeric claims

Prefer a link to the live manifest, test inventory or authoritative source over a copied count. Keep an exact number only when it helps the reader decide or act, and verify it during the sweep. A new "currently" or date stamp does not make an unchecked claim accurate.

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
