// Data only: imported by both Node runners and the browser harness. Cases invoke
// supported public options; native-sized families do not invent width/height APIs.
export const LABELS = { labeled: 'OK', empty: '', long: 'Open the selected document', ink: 'AgjpQy' };
export const SIZES = {
  auto: {}, small: { width: 32, height: 12, length: 48 },
  standard: { width: 80, height: 20, length: 120 },
  large: { width: 180, height: 32, length: 240 },
};
export const FAMILIES = ['push', 'default', 'bevel', 'list-header', 'checkbox', 'radio', 'select', 'slider', 'progress', 'tab', 'scrollbar', 'disclosure', 'growbox'];
const sized = new Set(['push', 'default', 'bevel', 'list-header', 'slider', 'progress', 'scrollbar']);
const labeled = new Set(['push', 'default', 'bevel', 'list-header', 'checkbox', 'radio', 'select', 'tab']);
const states = {
  push: ['normal', 'pressed', 'disabled'], default: ['normal', 'pressed', 'disabled'],
  bevel: ['normal', 'pressed', 'disabled', 'on'], 'list-header': ['normal', 'inactive'],
  checkbox: ['normal', 'checked', 'mixed', 'disabled'], radio: ['normal', 'checked', 'mixed', 'disabled'],
  select: ['normal', 'disabled'], slider: ['normal', 'pressed', 'disabled', 'inactive'],
  progress: ['normal', 'inactive'], tab: ['normal', 'selected'],
  scrollbar: ['normal', 'pressed', 'disabled', 'inactive'], disclosure: ['normal', 'pressed', 'disabled', 'inactive'],
  growbox: ['normal', 'inactive'],
};

function definition(family, sizing, labelKind, state, orientation = 'horizontal', value = 0.5, proportional = true, mode = 'direct') {
  if (family === 'select') mode = 'declarative';
  const size = SIZES[sizing], options = {};
  if (labeled.has(family)) options.label = LABELS[labelKind];
  if (['push', 'default', 'bevel'].includes(family)) {
    if (sizing !== 'auto') Object.assign(options, { minWidth: size.width, height: size.height });
    if (family === 'default') options.default = true;
    if (family === 'bevel') { options.small = sizing === 'small'; options.on = state === 'on'; }
    options.pressed = state === 'pressed'; options.disabled = state === 'disabled';
  } else if (family === 'list-header') {
    // A single column keeps the requested label identifiable; width is required
    // by the public column API, including the otherwise-automatic height case.
    options.columns = [{ label: options.label, width: size.width ?? 140 }];
    delete options.label;
    if (sizing !== 'auto') options.height = size.height;
    options.inactive = state === 'inactive';
  } else if (family === 'checkbox' || family === 'radio') {
    options.checked = state === 'checked'; options.mixed = state === 'mixed'; options.disabled = state === 'disabled';
  } else if (family === 'tab') options.selected = state === 'selected';
  else if (family === 'select') options.disabled = state === 'disabled';
  else if (family === 'growbox') options.state = state;
  else if (family === 'disclosure') { options.direction = orientation === 'horizontal' ? 'right' : 'down'; options.state = state; }
  else {
    if (sizing !== 'auto') options.length = size.length;
    options.value = value; options.state = state;
    if (family !== 'progress') options.orientation = orientation;
    if (family === 'scrollbar') { options.proportional = proportional; options.thumbExtent = 0.25; }
  }
  const group = [mode, family, sizing, labelKind, orientation, value, proportional].join('/');
  const id = `${group}/${state}`;
  return { id, group, family, mode, sizing, labelKind, state, options };
}

export function listCases({ profile = 'smoke', families = FAMILIES } = {}) {
  if (!['smoke', 'extended'].includes(profile)) throw new Error(`Unknown matrix profile: ${profile}`);
  for (const family of families) if (!FAMILIES.includes(family)) throw new Error(`Unknown control family: ${family}`);
  const cases = new Map();
  const add = c => cases.set(c.id, c);
  for (const family of families) {
    const sizeModes = sized.has(family) ? Object.keys(SIZES) : ['auto'];
    const labels = labeled.has(family) ? Object.keys(LABELS) : ['empty'];
    const orientations = ['slider', 'scrollbar', 'disclosure'].includes(family) ? ['horizontal', 'vertical'] : ['horizontal'];
    const values = ['slider', 'scrollbar', 'progress'].includes(family) ? [0, 0.5, 1] : [0.5];
    const models = family === 'scrollbar' ? [true, false] : [true];
    if (profile === 'extended') {
      for (const size of sizeModes) for (const label of labels) for (const state of states[family])
        for (const orientation of orientations) for (const value of values) for (const proportional of models)
          add(definition(family, size, label, state, orientation, value, proportional));
    } else {
      // Bounded diagonal coverage, not a claim of exhaustive combinations.
      const n = Math.max(sizeModes.length, labels.length, states[family].length);
      for (let i = 0; i < n; i++) add(definition(family, sizeModes[i % sizeModes.length], labels[i % labels.length],
        states[family][i % states[family].length], orientations[i % orientations.length], values[i % values.length], models[i % models.length]));
      // A comparable state group for geometry/ink checks, independent of sizing.
      if (family === 'push' || family === 'default') for (const state of states[family]) add(definition(family, 'auto', 'ink', state));
    }
    // Test the real scanner in addition to the pure control entry. Declarative
    // markup currently exposes no explicit control dimensions; do not pretend it does.
    if (['push', 'default', 'checkbox', 'radio', 'slider', 'tab'].includes(family)) {
      const labelsForDom = labeled.has(family) ? (profile === 'extended' ? labels : ['ink']) : ['empty'];
      const domStates = family === 'slider' ? ['normal'] : states[family].filter(s => !['pressed', 'mixed'].includes(s));
      for (const label of labelsForDom) for (const state of domStates)
        add(definition(family, 'auto', label, state, 'horizontal', 0.5, true, 'declarative'));
    }
  }
  if (profile === 'extended') {
    for (const c of [...cases.values()]) {
      if (c.mode !== 'direct') continue;
      if (['checkbox', 'radio'].includes(c.family) && ['checked', 'mixed'].includes(c.state))
        add({ ...c, id: `${c.id}/disabled`, state: `disabled-${c.state}`, options: { ...c.options, disabled: true } });
      if (c.family === 'bevel' && c.state === 'on') for (const state of ['pressed', 'disabled'])
        add({ ...c, id: `${c.id}/${state}`, state: `${state}-on`, options: { ...c.options, [state]: true } });
    }
  }
  if (families.includes('push')) {
    const c = definition('push', 'auto', 'ink', 'normal');
    add({ ...c, id: `${c.id}/custom-fg`, group: `${c.group}/custom-fg`, options: { ...c.options, fg: '#204080' } });
  }
  return [...cases.values()];
}
