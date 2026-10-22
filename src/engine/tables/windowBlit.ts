// docs/spec/engine/qd-primitives.md §4 "Window caller: which blit".
import type { TileDirection } from '../qd/types.js';

export interface WindowBlitRow {
  readonly id: 'W1' | 'W2' | 'W3';
  /** Part codes this row covers; `'*'` = every other drawn code. */
  readonly codes: readonly number[] | '*';
  readonly blit: 'scale' | 'tile';
  readonly direction?: TileDirection;
  readonly source: string;
}

export const WINDOW_BLIT: readonly WindowBlitRow[] = [
  { id: 'W1', codes: [18], blit: 'scale', source: '0x59ba' },
  { id: 'W2', codes: [11, 14], blit: 'tile', direction: 0, source: '0x59c8..0x59da, 0x59e8' },
  { id: 'W3', codes: '*', blit: 'tile', direction: 1, source: '0x59c8..0x59da, 0x59e8' },
];

/** The W row for a drawn cell's part code (first matching row). */
export function windowBlitRow(code: number): WindowBlitRow {
  return WINDOW_BLIT.find(r => r.codes === '*' || r.codes.includes(code))!;
}
