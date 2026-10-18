const row = rows => rows.find(r => !r.collision && r.family === 'push' && r.resourceId === 0 && r.state === 'normal' && !r.override);
const face = rows => row(rows).trace.steps.find(s => s.role === 'face' && s.action === 'selected');
export const solidMutations = [
  ['omitted exact row', rows => rows.splice(rows.indexOf(row(rows)), 1)],
  ['duplicate exact row', rows => rows.push(structuredClone(row(rows)))],
  ['wrong predicate', rows => { row(rows).resourceId = 17; }],
  ['wrong invocation', rows => { row(rows).options.height = 10; }],
  ['wrong request', rows => { row(rows).trace.requested.default = true; }],
  ['wrong owner', rows => { face(rows).owner.baseUrl = row(rows).childBaseUrl; }],
  ['wrong base depth', rows => { face(rows).owner.chainDepth = 0; }],
  ['wrong load', rows => { face(rows).resource.byteProvenance.loadId = 'wrong'; }],
  ['wrong occurrence', rows => { face(rows).resource.byteProvenance.cicnResourceIndex = 2; }],
  ['wrong key', rows => { face(rows).resource.manifestKey = 'decoy'; }],
  ['wrong payload', rows => { row(rows).owner.byteProvenance.resources.find(r => r.resourceIndex === 0).sha256 = '0'.repeat(64); }],
  ['wrong fork', rows => { row(rows).owner.byteProvenance.fork.sha256 = '0'.repeat(64); }],
  ['missing occurrence', rows => { row(rows).owner.byteProvenance.resources = []; }],
  ['wrong body decision', rows => { row(rows).trace.steps.find(s => s.role === 'body-fill').action = 'selected'; }],
  ['wrong body owner', rows => { row(rows).trace.steps.find(s => s.role === 'body-fill').owner.chainDepth = 0; }],
  ['wrong source sample', rows => { row(rows).background.rgb16 = [0, 0, 0]; }],
  ['wrong literal pixel', rows => { row(rows).pixels[1] = '.'.repeat(29); }],
];
