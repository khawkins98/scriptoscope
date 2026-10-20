// Browser-safe binding/preparation shared by recorded execution and owned-fixture checks.
const check = (ok, message) => { if (!ok) throw Error(`recorded transfer: ${message}`); };
export function validateTransferBinding(binding) {
  check(binding && typeof binding === 'object' && !Array.isArray(binding) &&
    Object.keys(binding).sort().join(',') === 'contractId,id,maskPolicy,path,sha256', 'invalid closed binding');
  check(typeof binding.path === 'string' && binding.path.length > 0 &&
    typeof binding.sha256 === 'string' && /^[a-f0-9]{64}$/.test(binding.sha256) &&
    typeof binding.id === 'string' && /^cicn-transfer-results:[a-f0-9]{64}$/.test(binding.id) &&
    typeof binding.contractId === 'string' && /^cicn-transfer-context:[a-f0-9]{64}$/.test(binding.contractId) &&
    binding.maskPolicy === 'source-mask-alpha', 'invalid results/context/mask binding');
  return binding;
}
export function transferFor(slug, registry) {
  const entry = registry[slug];
  return entry && Object.hasOwn(entry, 'cicnTransfer') ? validateTransferBinding(entry.cicnTransfer) : undefined;
}
export const recordedLoadKey = (profile, transfer) => JSON.stringify([
  profile.path, profile.id, profile.sha256,
  transfer ? [transfer.path, transfer.sha256, transfer.id, transfer.contractId, transfer.maskPolicy] : null,
]);
export async function prepareRecordedTransfer(binding, api, readBytes = async path => {
  const response = await fetch('/' + path);
  check(response.ok, 'missing results file');
  return new Uint8Array(await response.arrayBuffer());
}) {
  if (binding === undefined) return undefined;
  // Copy before awaits; neither authorization nor the resulting loader option is mutable.
  const b = {...validateTransferBinding(binding)};
  const bytes = new Uint8Array(await readBytes(b.path));
  const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
  check(sha === b.sha256, 'results DATA bytes changed');
  const results = await api.prepareCicnTransferResults(JSON.parse(new TextDecoder().decode(bytes)));
  check(results.id === b.id && results.contractId === b.contractId, 'wrong prepared results/context');
  return Object.freeze({results, contractId:b.contractId, maskPolicy:b.maskPolicy});
}
/** Preparation evidence belongs to the whole load, not necessarily the selected push face. */
export function retainRecordedTransfers(theme, binding) {
  if (binding === undefined) return {};
  return {cicnTransfer:{binding, load:theme.byteProvenance, catalog:theme.inspector?.cicns, elements:Object.entries(theme.manifest.chromeElements)
    .filter(([,element]) => element.cicnTransfer)
    .map(([manifestKey,element]) => ({manifestKey, asset:element.asset,
      byteProvenance:element.byteProvenance, transfer:element.cicnTransfer}))}};
}
