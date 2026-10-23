// Independently authored behavioral faults, applied in-memory only. A mutation
// is killed only by the named assertion after a passing unmodified control.
export const sliderRuntimeMutations = [
  {id:'provider-order',path:'src/engine/resources/sliderEnvironment.ts',before:'binding.providers.map(p =>',after:'[...binding.providers].reverse().map(p =>',lane:'node',test:'corner lookup prioritizes',assertion:'strictly equal'},
  {id:'corner-byte-zero',path:'src/engine/resources/sliderEnvironment.ts',before:'corner: selected.bytes[0]!',after:'corner: 0',lane:'node',test:'corner lookup prioritizes',assertion:'strictly equal'},
  {id:'duplicate-first-wins',path:'src/engine/resources/sliderEnvironment.ts',before:'existing ? { ambiguous: true } :',after:'existing ? existing :',lane:'node',test:'missing, empty, duplicate',assertion:'Missing expected exception'},
  {id:'empty-corner-admitted',path:'src/engine/resources/sliderEnvironment.ts',before:'if (!selected || selected.bytes.length === 0)',after:'if (!selected)',lane:'node',test:'missing, empty, duplicate',assertion:'Missing expected exception'},
  {id:'unknown-provider-ignored',path:'src/engine/resources/sliderEnvironment.ts',before:'binding.providers.some(p => !p.complete)',after:'false',lane:'node',test:'missing, empty, duplicate',assertion:'Missing expected exception'},
  {id:'incomplete-tail-ignored',path:'src/engine/resources/sliderEnvironment.ts',before:'binding.providers.some(p => !p.complete)',after:'binding.providers.slice(0, 1).some(p => !p.complete)',lane:'node',test:'declaration-wide completeness',assertion:'Missing expected exception'},
  {id:'thumb-asset-unbound',path:'src/engine/resources/sliderEnvironment.ts',before:"['asset', 'width', 'height', 'sourceCicnId', 'byteProvenance']",after:"['width', 'height', 'sourceCicnId', 'byteProvenance']",lane:'node',test:'typed adapter binds',assertion:'Missing expected exception'},
  {id:'marker-deletion-ordinary',path:'tools/theme-loader/cinf-environment.js',before:'if (!theme[field] && !owner) return undefined;',after:'if (!theme[field]) return undefined;',lane:'node',test:'opaque owner capability',file:'tools/theme-loader/sliderLayoutCinf.test.mjs',assertion:'Missing expected exception'},
  {id:'archive-cinf-mixing',path:'src/engine/resources/theme.ts',before:'if (declaredCinfs)',after:'if (declaredCinfs && (id === -10132 || id === -10116 || id === -10144 || id === -10128))',lane:'browser',test:'source: declared cinf providers control',assertion:'DECLARED_PIXELS'},
  {id:'groove-payload-truncated',path:'src/engine/resources/sliderEnvironment.ts',before:'copiedCinfPayload(r)',after:'copiedCinfPayload(r).slice(0, 3)',lane:'browser',test:'source: declared cinf providers control',assertion:'DECLARED_PIXELS'},
  {id:'pointer-full-canvas-travel',path:'src/interactive.ts',before:'layout.travelEnd - layout.travelStart',after:'layout.axisLength',lane:'browser',test:'source: ordinary and declared pointers',assertion:'TRAVEL_DELTA'},
  {id:'pointer-track-no-centering',path:'src/interactive.ts',before:'- half) / travel',after:') / travel',lane:'browser',test:'source: ordinary and declared pointers',assertion:'CENTERED_TRACK'},
  {id:'pointer-grab-reanchors',path:'src/interactive.ts',before:'const grabbed = thumb &&',after:'const grabbed = false && thumb &&',lane:'browser',test:'source: ordinary and declared pointers',assertion:'EXACT_GRAB'},
  {id:'pointer-vertical-sign',path:'src/interactive.ts',before:'nativeDrag.direction * delta',after:'delta',lane:'browser',test:'source: ordinary and declared pointers',assertion:'TRAVEL_DELTA'},
];
export function mutateSliderRuntime(source, mutation) {
  const count=source.split(mutation.before).length-1;
  if(count!==1)throw new Error(`Mutation setup failed: ${mutation.id} expected one target, got ${count}`);
  return source.replace(mutation.before,mutation.after);
}
