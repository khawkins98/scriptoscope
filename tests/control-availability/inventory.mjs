import { sha256 } from './source.mjs';
const outcomes = new Set(['themed', 'unavailable', 'native-procedural']);
/** Validate declaration/review consistency before any observed execution. */
export function validateInventory(inventory) {
  const seen = new Set(), errors = [];
  if (!inventory.inventoryVersion || inventory.inventorySha256 !== sha256(JSON.stringify(inventory.cases))) errors.push('Missing version or case inventory hash drift');
  if (!['draft-requires-independent-review', 'reviewed'].includes(inventory.reviewStatus)) errors.push('Invalid inventory review status');
  if (inventory.reviewStatus === 'reviewed' && (inventory.review?.inventoryVersion !== inventory.inventoryVersion || inventory.review?.inventorySha256 !== inventory.inventorySha256 || !inventory.review?.reviewers?.length)) errors.push('Reviewed inventory lacks matching review version/digest/reviewers');
  for (const c of inventory.cases) {
    if (typeof c.id !== 'string' || !c.id || seen.has(c.id)) errors.push(`Duplicate or missing case ID: ${c.id}`);
    seen.add(c.id);
    if (!['draft-requires-independent-review', 'reviewed'].includes(c.reviewStatus)) errors.push(`${c.id}: invalid review status`);
    if (c.proposed !== null && !outcomes.has(c.proposed?.outcome)) errors.push(`${c.id}: invalid proposed outcome`);
    if (c.reviewStatus !== 'reviewed') {
      if (c.effectiveAvailability !== 'unknown') errors.push(`${c.id}: unreviewed outcome cannot be active`);
    } else {
      if (inventory.reviewStatus !== 'reviewed') errors.push(`${c.id}: reviewed case in inactive inventory`);
      if (c.effectiveAvailability !== (c.proposed?.outcome ?? 'unknown')) errors.push(`${c.id}: reviewed effective availability disagrees with declared outcome`);
    }
    if (c.mode === 'interactive' && c.proposed && c.proposed.outcome !== 'native-procedural') errors.push(`${c.id}: unsupported interactive expectation`);
    if (c.mode === 'direct' && c.proposed?.outcome === 'native-procedural') errors.push(`${c.id}: direct null is not a native realization`);
    if (!['direct', 'interactive'].includes(c.mode)) errors.push(`${c.id}: invalid API mode`);
    if (!['push-button', 'bevel-button'].includes(c.family)) errors.push(`${c.id}: unsupported family`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
}
