import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
import { boundarySources, boundaryInput } from './border-boundary-inputs.mjs';
const inputCache = new Map();
for (const mode of ['source', 'built']) for (const choice of boundarySources)
  test(`${mode}: source border size boundaries ${choice.slug}`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    if (!inputCache.has(choice.slug)) inputCache.set(choice.slug, boundaryInput(choice));
    const input = await inputCache.get(choice.slug);
    let result;
    try {
      result = await page.evaluate(async ({ mode, input }) => {
        const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        const { boundaryVariants, boundarySizes, borderWriter, admitSolidBody, solidBodyOrInitial, admitPatternBody, patternBodyOrInitial } = await import('/tests/rendering-options/border-boundary-model.mjs');
        const check = (value, message) => { if (!value) throw new Error(message); };
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
        const run = async (cinfEnvironment, variants = boundaryVariants) => {
        const declared = !!cinfEnvironment;
        const theme = await api.loadTheme(`/themes/${input.choice.slug}`, { source: input.choice.path.split('/').at(-1), provenance: true, ...(declared ? { cinfEnvironment } : {}) });
        const rows = [], faces = {}, patterns = {}, patternCache = new Map(), provenance = theme.byteProvenance, sourceCache = new Map();
        const resources = new Map(provenance.resources.map(r => [r.resourceIndex, r]));
        const join = resource => {
          const key = resource?.manifestKey, original = theme.manifest.chromeElements[key], rawExpected = input.elements[key], ref = resource?.byteProvenance;
          const e = declared && original?.bodyCinf?.metadata ? { ...original, ...original.bodyCinf.metadata } : original;
          const expected = declared && rawExpected?.status === 'missing-cinf'
            ? { ...rawExpected, status: 'candidate', cinf: { corner: 3, side: 1, tile: false }, body: rawExpected.declaredBody } : rawExpected;
          check(e && expected && ref && resource.type === 'cicn', `Missing selected face identity ${key}`);
          check(resource.assetUrl === api.assetUrl(theme, e.asset) && resource.signedId === expected.signedId, 'Selected asset/ID mismatch');
          check(ref.loadId === provenance.loadId && ref.manifestKey === key && e.byteProvenance.loadId === ref.loadId,
            'Selected load/key mismatch');
          for (const field of ['cicnResourceIndex', 'cinfResourceIndex']) {
            check(ref[field] === expected[field] && ref[field] === e.byteProvenance[field], `Wrong ${field}`);
            if (ref[field] !== null) {
              const actual = resources.get(ref[field]), raw = input.resources[ref[field]];
              check(actual?.status === 'decoded' && actual.type === raw.type && actual.signedId === raw.signedId
                && actual.byteLength === raw.byteLength && actual.sha256 === raw.sha256, `Payload mismatch ${field}`);
            }
          }
          return { key, e, expected };
        };
        const patternJoin = (step, bodyInput) => {
          const resource = step?.resource, key = resource?.manifestKey, p = theme.manifest.patterns?.[key], expected = input.patterns[key];
          const ref = resource?.byteProvenance, raw = expected && input.resources[expected.resourceIndex], actual = expected && resources.get(expected.resourceIndex);
          check(step?.action === 'selected' && step.role === 'body-fill' && step.usage === 'paint'
            && step.bodyMode === bodyInput.request.mode && step.requestedId === bodyInput.request.resourceId
            && step.requestedResourceType === 'ppat' && step.owner?.chainDepth === 0 && step.owner.baseUrl === theme.baseUrl,
          'Actual selected pattern request/owner mismatch');
          check(resource?.type === 'ppat' && p && expected && ref && raw && actual?.status === 'decoded'
            && same(bodyInput.rawPatternOccurrences, [expected.resourceIndex])
            && resource.signedId === expected.signedId && p.sourcePpatId === bodyInput.request.resourceId
            && resource.assetUrl === api.assetUrl(theme, p.asset) && ref.manifestKey === key
            && ref.loadId === provenance.loadId && p.byteProvenance.loadId === provenance.loadId
            && ref.ppatResourceIndex === expected.resourceIndex && p.byteProvenance.ppatResourceIndex === expected.resourceIndex
            && actual.type === 'ppat' && actual.signedId === raw.signedId && actual.sha256 === raw.sha256 && actual.byteLength === raw.byteLength,
          'Actual pattern occurrence/payload mismatch');
          check(expected.opaque && expected.displayPolicy === 'mac-1.8-to-2.2-high-byte', 'Pattern input not opaque/current-display');
          if (!patterns[key]) patterns[key] = { input: expected, resource, owner: step.owner, payload: actual };
          return { key, p, expected };
        };
        const consumedJoin = (trace, e, expected) => {
          const view = e.bodyCinf, { metadata, ...lookup } = view ?? {};
          const p = input.declaredProvider, selected = lookup.selected;
          check(view?.status === 'ready' && view.requestedId === expected.signedId
            && view.bindingId === theme.manifest.cinfEnvironment.bindingId
            && view.environmentId === cinfEnvironment.id && view.themeForkSha256 === input.choice.forkSha256,
          'Consumed cinf environment/face mismatch');
          check(same(view.attempts.map(a => [a.id, a.outcome]), [[expected.signedId, 'missing'], [0, 'found']])
            && selected.providerId === 'owned-cinf0' && selected.providerKind === 'raw-fork'
            && ['forkSha256', 'occurrence', 'signedId', 'byteLength', 'sha256'].every(k => selected[k] === p[k])
            && same(view.attempts[1].resource, selected), 'Foreign cinf exact NULL→0 payload join failed');
          check(trace.steps.some(s => s.role === 'face' && s.usage === 'admission' && s.action === 'selected'
            && s.owner?.chainDepth === 0 && s.owner.baseUrl === theme.baseUrl && same(s.cinfLookup, lookup)),
            'Missing actual consumed-view admission');
          return lookup;
        };
        const compose = async (variant, width, height, knownPattern = false) => {
          let trace;
          const context = { controlOrigin: [13, 17], portOrigin: [0, 0], patternOrigin: knownPattern ? { status: 'known', offset: [-3, 5] } : { status: 'unknown' },
            clip: { kind: 'rect', rect: { x: 13, y: 17, w: width, h: height } } };
          const options = { label: '', minWidth: width, height, pressed: variant.state === 'pressed', disabled: variant.state === 'inactive',
            ...(variant.family === 'push' ? { default: false } : { small: variant.small, on: variant.on }),
            compositionContext: context, diagnostics: { onComplete: t => { trace = t; } } };
          const buffer = await api[variant.family === 'push' ? 'composeButton' : 'composeBevelButton'](theme, options);
          check(trace && trace.outcome.status !== 'error', 'No completed composition');
          return { buffer, trace, context };
        };
        try {
          check(provenance.input.sha256 === input.choice.archiveSha256 && provenance.fork.sha256 === input.choice.forkSha256,
            'Canonical input/actual loader fork mismatch');
          check(provenance.fork.selection.entryIndex === input.choice.entryIndex && provenance.fork.selection.entryName === input.choice.entryName,
            'Archive occurrence mismatch');
          for (const variant of variants) {
            const minimum = variant.family === 'push' ? 24 : 16;
            // Selection-only probe: no pixel correctness assertion at this size.
            const probe = await compose(variant, minimum, 1);
            const selected = probe.trace.steps.filter(s => s.role === 'face' && s.usage === 'paint' && s.action === 'selected').at(-1);
            if (!probe.buffer) {
              check(!selected && probe.trace.outcome.status === 'unavailable', 'Unavailable face reported selected');
              rows.push({ variant, status: 'missing-face', selection: probe.trace.steps }); continue;
            }
            const { key, e, expected } = join(selected.resource);
            check(selected.owner.chainDepth === 0 && selected.owner.baseUrl === theme.baseUrl, 'Unexpected face owner');
            if (!faces[key]) faces[key] = { input: expected, resource: selected.resource, owner: selected.owner,
              cicn: resources.get(expected.cicnResourceIndex), cinf: resources.get(expected.cinfResourceIndex) ?? null };
            if (expected.status !== 'candidate') { rows.push({ variant, key, status: expected.status }); continue; }
            const requestedId = variant.family === 'push'
              ? { active: -10239, pressed: -10238, inactive: -10240 }[variant.state]
              : -((variant.small ? 10171 : 10162) + (variant.on ? 0 : 3)
                + { pressed: 0, active: 1, inactive: 2 }[variant.state]);
            if (declared) check(expected.signedId === requestedId, 'Declared provider selected substitute face');
            const consumed = declared ? consumedJoin(probe.trace, e, expected) : null;
            const model = { width: expected.width, height: expected.height, ...expected.cinf };
            check(e.slice && ['corner', 'side', 'tile'].every(field => e.slice[field] === expected.cinf[field]),
              'Actual slice differs from raw selected cinf');
            if (model.width < 2 * model.corner || model.height < 2 * model.corner || !model.width || !model.height) {
              rows.push({ variant, key, status: 'unknown-unsafe-source-span', ...(consumed ? { consumed } : {}) }); continue;
            }
            if (!sourceCache.has(key)) {
              const art = await api.loadCicnBuffer(api.assetUrl(theme, e.asset));
              check(art.width === model.width && art.height === model.height, 'Actual raster dimensions mismatch');
              const normalized = new Uint8Array(art.data);
              for (let i = 0; i < normalized.length; i += 4) if (!normalized[i + 3]) normalized.fill(0, i, i + 3);
              check(await digest(normalized) === expected.rgbaSha256, 'Actual decoded plane differs from bound converter input');
              sourceCache.set(key, art);
            }
            const art = sourceCache.get(key);
            if (art.data.some((v, i) => i % 4 === 3 && v !== 0 && v !== 255)) {
              rows.push({ variant, key, status: 'unknown-nonbinary-mask' }); continue;
            }
            const equivalence = e.samplingEquivalence;
            const equalSampler = equivalence?.model === 'kaleidoscope-2.3.1-opaque-sampling-v1'
              && equivalence.comparison === 'opaque-current-display-rgb' && equivalence.displayPolicy === 'mac-1.8-to-2.2-high-byte'
              && equivalence.width === model.width && equivalence.height === model.height && equivalence.status === 'equivalent'
              && equivalence.reason === 'all-opaque-display-rgb-equal';
            const bodyInput = expected.body;
            check(same(e.bodyRequest, bodyInput.request) && same(e.bgAnchor, bodyInput.anchor)
              && same(e.colorSamples?.background ?? null, bodyInput.sample)
              && (e.colorSamples?.model ?? null) === bodyInput.sampleModel
              && (e.colorSamples?.displayPolicy ?? null) === bodyInput.displayPolicy
              && (e.colorSamplesUnavailableReason ?? null) === bodyInput.unavailableReason, 'Actual body metadata differs from bound input');
            const solid = equalSampler ? admitSolidBody({ ...bodyInput, width: model.width, height: model.height,
              lookup: 'declared-same-owner-null' }) : null;
            let pattern = null;
            const selectedPattern = probe.trace.steps.filter(s => s.role === 'body-fill' && s.usage === 'paint' && s.action === 'selected').at(-1);
            const candidatePatterns = Object.entries(input.patterns).filter(([, p]) => p.signedId === bodyInput.request.resourceId
              && p.opaque && p.rgbaSha256 && same(bodyInput.rawPatternOccurrences, [p.resourceIndex]));
            const expectedPattern = equalSampler && bodyInput.request.mode !== 5 && candidatePatterns.length === 1;
            if (expectedPattern) {
              check(selectedPattern, 'Bound decoded pattern was not actually selected');
              pattern = patternJoin(selectedPattern, bodyInput);
              check(pattern.key === candidatePatterns[0][0], 'Actual pattern differs from bound candidate');
              if (!patternCache.has(pattern.key)) {
                const tile = await api.loadCicnBuffer(api.assetUrl(theme, pattern.p.asset));
                check(tile.width === pattern.expected.width && tile.height === pattern.expected.height
                  && await digest(tile.data) === pattern.expected.rgbaSha256 && tile.data.every((v, i) => i % 4 !== 3 || v === 255),
                'Actual pattern decoded plane/opacity mismatch');
                patternCache.set(pattern.key, tile);
              }
            }
            const plan = boundarySizes(model, variant.family), row = { variant, key, ...(consumed ? { consumed } : {}), status: 'observed', bodyScope: solid ? 'conditional-solid-full-face' : 'border-only', plan, cases: [], ...(pattern ? { knownPatternKey: pattern.key, knownPatternContext: { controlOrigin: [13, 17], portOrigin: [0, 0], patternOrigin: { status: 'known', offset: [-3, 5] }, clip: 'finite-face-rect-from-case-size' }, knownPatternCases: [] } : {}) };
            rows.push(row);
            for (const knownPattern of pattern ? [false, true] : [false]) for (const [width, height] of plan.sizes) {
              const { buffer, trace, context } = await compose(variant, width, height, knownPattern);
              const caseRows = knownPattern ? row.knownPatternCases : row.cases;
              const tile = knownPattern ? patternCache.get(pattern.key) : null;
              const patterned = knownPattern ? admitPatternBody({ mode: bodyInput.request.mode, context, width, height,
                tileWidth: tile.width, tileHeight: tile.height, rgba: tile.data }) : null;
              if (knownPattern) check(patterned, 'Known pattern context/tile admission failed');
              check(buffer && trace.outcome.status === 'themed', 'Expected completed themed face');
              const actualSelection = trace.steps.filter(s => s.role === 'face' && s.usage === 'paint' && s.action === 'selected').at(-1);
              check(join(actualSelection.resource).key === key, 'Boundary changed actual selected face');
              if (declared) check(same(consumedJoin(trace, e, expected), consumed), 'Boundary changed consumed cinf');
              check(same(trace.composition?.context, { basis: 'caller-declared', ...context })
                && same(trace.composition?.faceRect, { x: 13, y: 17, w: width, h: height }), 'Actual composition context/face mismatch');
              const offset = variant.family === 'push' && Object.values(theme.manifest.chromeElements).some(v => [10230, 10231, 10232].includes(Math.abs(v.sourceCicnId))) ? 4 : 0;
              check(buffer.width === width + 2 * offset && buffer.height === height + 2 * offset, 'Public size policy mismatch');
              if (knownPattern || declared) check(!trace.legacyFacePaint, 'Bound known-pattern case entered legacy painter');
              if (trace.legacyFacePaint) { caseRows.push({ size: [width, height], status: 'unknown-legacy-painter', asserted: 0, unassessed: width * height }); continue; }
              const paints = trace.bandPaints ?? [];
              for (const p of paints) {
                check(p.role === 'face' && p.owner.chainDepth === 0 && p.owner.baseUrl === theme.baseUrl && join(p.resource).key === key,
                  'Completed band dependency mismatch');
                if (declared) check(same(p.resource.consumedCinf, consumed), 'Completed band foreign cinf mismatch');
              }
              let bodyAdmission;
              if (patterned) {
                const bodySteps = trace.steps.filter(s => s.role === 'body-fill' && s.usage === 'paint');
                const step = bodySteps.filter(s => s.action === 'selected').at(-1);
                check(patternJoin(step, bodyInput).key === pattern.key
                  && !bodySteps.some(s => ['missing', 'rejected', 'fallback'].includes(s.action)), 'Known pattern admission changed');
              }
              if (solid) {
                const bodySteps = trace.steps.filter(s => s.role === 'body-fill' && s.usage === 'paint');
                bodyAdmission = bodySteps.find(s => s.action === 'missing' && s.reason === 'same-face-owner-pattern-unavailable');
                check(bodyAdmission && bodyAdmission.requestedId === bodyInput.request.resourceId
                  && bodyAdmission.bodyMode === bodyInput.request.mode && bodyAdmission.requestedResourceType === 'ppat'
                  && bodyAdmission.owner?.baseUrl === theme.baseUrl && bodyAdmission.owner?.chainDepth === 0
                  && !bodySteps.some(s => s.action === 'selected' || s.action === 'rejected' || s.action === 'fallback'),
                'Conditional NULL body admission not observed');
              }
              let asserted = 0, unassessed = 0, unknownSampler = 0, mismatches = 0, bodyPixels = 0, initialPixels = 0, borderPixels = 0;
              const writers = {}, failures = [];
              for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                const writer = borderWriter(model, { width, height }, x, y, (sx, sy) => art.getPixel(sx, sy)[3]);
                if (!writer && !solid && !patterned) { unassessed++; continue; }
                if (writer && writer.branch !== 'copy' && !equalSampler) { unknownSampler++; unassessed++; continue; }
                const fallback = writer ? null : patterned ? patternBodyOrInitial(model, patterned, x, y) : solidBodyOrInitial(model, { width, height }, x, y, solid);
                const expectedPixel = writer ? art.getPixel(...writer.source) : fallback.rgba, actual = buffer.getPixel(x + offset, y + offset);
                asserted++;
                if (writer) {
                  borderPixels++; writers[writer.region] = (writers[writer.region] ?? 0) + 1;
                  check(paints.some(p => p.region === writer.region && p.branch === writer.branch
                    && p.policy === (writer.branch === 'copy' ? 'ordinary-raster' : 'equivalent-raster')), 'Missing completed source-band dependency');
                } else if (fallback.kind === 'body') bodyPixels++; else initialPixels++;
                if (!same(actual, expectedPixel)) { mismatches++; if (failures.length < 8) failures.push({ at: [x, y], writer, fallback, expected: expectedPixel, actual }); }
              }
              const summary = { size: [width, height], status: patterned ? 'asserted-known-pattern-full-face' : solid ? 'asserted-conditional-solid-full-face' : asserted ? (unknownSampler ? 'partial-unknown-sampler' : 'asserted-opaque-border') : 'unknown-no-assessed-border',
                asserted, unassessed, borderPixels, bodyPixels, initialPixels, unknownSampler, writers, mismatches,
                ...(patterned ? { patternKey: pattern.key, context: 'row-known-pattern-context', initialDestination: [0, 0, 0, 0], completedOutcome: trace.outcome.status } : {}),
                ...(solid ? { bodyAdmission, background: solid, initialDestination: [0, 0, 0, 0], completedOutcome: trace.outcome.status } : {}), outputSha256: await digest(buffer.data),
                paintRegions: paints.map(p => [p.region, p.branch, p.policy]), ...(failures.length ? { failures } : {}) };
              if (solid || patterned) check(asserted === width * height && unassessed === 0, 'Full-face coverage incomplete');
              caseRows.push(summary);
              if (mismatches) { document.body.append(api.bufferToCanvas(buffer)); return { failed: { variant, key, model, summary }, rows, faces, patterns, loadId: provenance.loadId }; }
            }
          }
          return { rows, faces, patterns, loadId: provenance.loadId, input: provenance.input, fork: provenance.fork };
        } finally { theme.dispose(); }
        };
        const result = await run();
        if (result.failed) return result;
        const missing = result.rows.filter(r => r.status === 'missing-cinf');
        check(missing.length === input.expectedMissingTuples, 'Default missing-cinf tuple inventory changed');
        if (missing.length) {
          const cinfEnvironment = await api.prepareCinfEnvironment({ version: 1, complete: true, providers: [
            { kind: 'theme-fork', id: 'actual-theme', complete: true },
            { kind: 'raw-fork', id: 'owned-cinf0', complete: true, bytes: new Uint8Array(input.declaredProvider.bytes) },
          ] });
          result.declaredProvider = await run(cinfEnvironment, missing.map(r => r.variant));
          check(same(result.declaredProvider.rows.map(r => [r.variant, r.key]), missing.map(r => [r.variant, r.key])),
            'Declared provider changed/discarded original missing-cinf tuples');
          if (result.declaredProvider.failed) result.failed = result.declaredProvider.failed;
        }
        return result;
      }, { mode, input });
      expect(result.failed, JSON.stringify(result.failed)).toBeUndefined();
      expect(result.rows).toHaveLength(15);
    } catch (error) { await attachCase(page, info, { mode, slug: choice.slug, result }, error); throw error; }
    await attachObservations(info, 'border-boundaries', `${mode}-${choice.slug}`, { mode, slug: choice.slug,
      sourceChoicesSha256: input.choicesSha256, claim: 'conditional solid/known-pattern full-face plus retained unknown-origin opaque-border-only source model; decoded inputs, modern same-owner NULL and transparent initialization declared, separate owned cinf0 provider rows retain all default missing-cinf tuples; original providers/destination and broader fidelity OPEN', result });
  });
