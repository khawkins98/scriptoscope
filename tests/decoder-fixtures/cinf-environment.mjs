import { forkOf } from '../resource-provenance/fixtures.mjs';
import { solidBackgroundIcon, solidBackgroundInfo } from './solid-background.mjs';
export { forkOf };
export const faceBytes = () => solidBackgroundIcon();
export function providerFork(id = -10239, background = [3, 3], mode = 0) {
  return forkOf([{ type: 'cinf', id, data: solidBackgroundInfo({ background, mode }) }]);
}
export function themeFork({ id = -10239, local = false } = {}) {
  return forkOf([{ type: 'cicn', id, name: 'face', data: faceBytes() },
    ...(local ? [{ type: 'cinf', id, data: solidBackgroundInfo({ background: [0, 0] }) }] : [])]);
}
export const external = (id, bytes, complete = true) => ({ kind: 'raw-fork', id, bytes, complete });
export const marker = () => ({ kind: 'theme-fork', id: 'actual-theme', complete: true });
export const declaration = (providers, complete = true) => ({ version: 1, providers, complete });

/** Same signed ID, separate named occurrences, different hidden RGB16. */
export function twinFaceFork() {
  const other = faceBytes(), view = new DataView(other.buffer);
  for (const offset of [99, 101, 103]) view.setUint16(offset, 0x4242);
  return forkOf([{ type: 'cicn', id: -10239, name: 'face', data: faceBytes() },
    { type: 'cicn', id: -10239, name: 'other', data: other }]);
}
