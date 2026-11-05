# Doc-sweep recipe

A checklist for "I've shipped 5+ commits in 24 hours, sync the docs before the next session loads stale context."

Consumer guides and references drift after API changes. Run this sweep after heavy iteration or before a release; start with the documents affected by the code change rather than expanding every context file.

## Editorial policy

Apply this policy in any project, including when an agent writes the draft:

1. Name one primary reader and the task or question the page serves. Use
   [Diátaxis](https://diataxis.fr/compass/) to distinguish a learning tutorial,
   task-specific how-to, lookup reference and conceptual explanation.
2. Keep README as orientation, one complete starter, adoption limits and routes.
   Update the authoritative guide/reference for new detail; link instead of
   repeating tables, examples or implementation status.
3. Review each affected section as **keep, move, merge, delete or verify**.
   Moving text is useful only when the destination serves an identifiable need.
   Preserve prerequisites, cleanup, provenance and material limitations.
4. Verify changed claims against public exports, source or executable examples.
   Current guides describe released behavior; release notes and dated decision
   records own change history. Record uncertainty rather than inventing facts.
5. Check that a new reader can choose a setup, run its complete example, find
   an advanced option and identify relevant limitations. Check links and anchors,
   including links from agent discovery files and packed-package documentation.
6. Report both README size and total documentation change in a cleanup review.
   Word counts flag growth; successful reader tasks determine usefulness.

### Canonical homes in this project

| Information | Home |
| --- | --- |
| First working hosted page | README |
| Complete npm application lifecycle | `docs/npm-consumer.md` and `examples/npm/` |
| Hosted integration tasks | `docs/hosted-recipes.md` |
| Attributes, page-host options and CDN paths | `docs/hosted-reference.md` |
| Lower-level rendering and advanced API examples | `docs/runtime-api.md` |
| Keyboard, pointer and event behavior | `docs/interaction.md` |
| Integration constraints and troubleshooting | `docs/integration-edge-cases.md` |
| Project rationale and historical roadmap | `docs/project-background.md` |
| Release changes / implementation status | CHANGELOG / CONTRIBUTING and linked trackers |

Keep these routes in `llms.txt` aligned when a home changes. Runtime implementers'
role restrictions override general documentation-reading suggestions here.

## The recipe

### 1. Enumerate the deltas

```sh
git log --oneline <last-doc-commit>..HEAD
```

Categorise each commit:
- **Public API addition** — new attribute, event, method, option.
- **Public API deletion** — option you removed (remove from its authoritative reference and affected examples).
- **False-start + revert** — shipped then reverted within the same day (deserves a LEARNINGS entry on *why* the first try was wrong).
- **Decision-churn** — same knob flipped twice; needs a LEARNINGS supersede pointer.
- **Internal refactor** — no doc impact, skip.
- **External pitch change** — README opener; rationale belongs in project background.

### 2. Grep each context doc for stale knob names

```sh
for term in <deleted-knob-1> <deleted-knob-2> <reverted-attr>; do
  rg -n "$term" README.md CLAUDE.md LEARNINGS.md docs/hosted-*.md docs/runtime-api.md docs/npm-consumer.md docs/integration-edge-cases.md docs/interaction.md
done
```

- **LEARNINGS hits** → mark with `> ⚠️ Superseded by <date> — <new entry name>` blockquote pointing forward. **Never delete LEARNINGS entries** — they're the historical record. Mark and move on.
- **Other docs** → delete the stale text.

### 3. For each new public API, verify it appears in

- Its canonical reference: `docs/hosted-reference.md` for markup/page-host options, `docs/runtime-api.md` for lower-level APIs, or `docs/interaction.md` for behavior/events. Add a how-to only when a distinct task needs one. README changes only if setup choices, its starter or adoption limits change.
- `docs/integration-edge-cases.md` if it changes how a consumer integrates (lifecycle, focus, modals, drag, resize).
- `docs/interaction.md` if it changes what a user can do with a window or control, or adds, removes or changes an event, key binding or opt-out.
- `CLAUDE.md` only if a future Claude session needs it in the 5-min onboarding. Most APIs do NOT belong here; only load-bearing patterns + chokepoints do.
- Update the existing explanation rather than append another recap. Keep README and `llms.txt` as routes to the canonical reference.

### 4. For each decision-churn series, ONE LEARNINGS entry

Don't write one entry per pick — write one entry showing *why* the chain happened. Example: "Schemes Folder window-type went movable-modal → titled-utility-window → document-window in 24h. Period correctness ceded to runtime-supported behavior because the themed scrollbar only renders on document-window."

The lesson is the chain, not each link.

### 5. For each false-start + revert, ONE LEARNINGS entry on the misread

Pattern: user reports symptom → first fix maps to "delete the offending behavior" → revert → real fix adds a side-channel (placeholder element, opt-in attribute, lifecycle event). Future Claude will make the same mistake on a different feature if the entry isn't there.

### 6. Drift-prone numeric claims

Bundle size, lockdown property count, test count, "supports N themes." Either:
- Prefer a link to the generated inventory or executable check over a manually repeated count.
- If an exact count supports a reader decision, name its source and verify it in this sweep. A review date alone does not establish accuracy.

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
