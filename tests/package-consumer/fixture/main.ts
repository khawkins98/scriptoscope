import { VERSION, loadKaleidoscopeScheme, composeTab, type ControlDiagnostics, type TabBodyTrace } from 'scriptoscope';
import { mountDeclarative, type MountHandle } from 'scriptoscope/declarative';
import 'scriptoscope/scriptoscope.css';

const root = document.querySelector<HTMLElement>('#consumer-root')!;
const article = root.querySelector<HTMLElement>('article')!;
const inputs = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select')];
const events: { type: string; value: string }[] = [];
root.addEventListener('input', event => events.push({ type: event.type, value: (event.target as HTMLInputElement).value }));
root.addEventListener('change', event => events.push({ type: event.type, value: (event.target as HTMLInputElement).value }));

// Installed declaration graph must expose additive tab diagnostics without
// resolving repository-only modules. The fixture does not change its UI.
const tabDiagnostics: ControlDiagnostics = { onComplete(trace) { const body: TabBodyTrace | undefined = trace.tabBody; void body; } };
const tabOptions: NonNullable<Parameters<typeof composeTab>[1]> = { selected: true, diagnostics: tabDiagnostics };
void tabOptions;

const consumer = {
  version: VERSION,
  decoderExport: typeof loadKaleidoscopeScheme,
  root, article, inputs, events,
  handle: null as MountHandle | null,
  ready: Promise.resolve(),
};
declare global { interface Window { packedConsumer: typeof consumer } }
window.packedConsumer = consumer;
consumer.ready = (async () => {
  consumer.handle = await mountDeclarative({
    root, pageThemeDefault: 'windows-95',
    themeBaseUrl: `${import.meta.env.BASE_URL}themes`,
    themes: [{ slug: 'windows-95', source: 'scheme.sit' }],
    bootAffordance: 'none', rejectOnEmptyMount: true,
  });
})();
