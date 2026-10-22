// Public control state → native hilite (DECISIONS #4; docs/spec/engine/scrollbar.md
// §2 "Scriptoscope mapping (DECISIONS #4) and declared defaults").

export type ControlStateName = 'normal' | 'pressed' | 'inactive' | 'disabled';

export interface ControlStateRow {
  readonly id: string;
  readonly state: ControlStateName;
  /** Native hilite; for `pressed`, taken from the family's part table. */
  readonly hilite: number | 'part';
  readonly source: string;
}

export const CONTROL_STATE: readonly ControlStateRow[] = [
  { id: 'state-normal', state: 'normal', hilite: 0, source: 'DECISIONS #4; scrollbar §2 mapping' },
  { id: 'state-pressed', state: 'pressed', hilite: 'part', source: 'DECISIONS #4; scrollbar §2 mapping' },
  { id: 'state-inactive', state: 'inactive', hilite: 254, source: 'DECISIONS #4; scrollbar §2 mapping' },
  { id: 'state-disabled', state: 'disabled', hilite: 255, source: 'DECISIONS #4; scrollbar §2 mapping (no inactive parent)' },
];

export interface PressedPartTable {
  readonly family: string;
  /** Public part name → native part code (= hilite while pressed). */
  readonly parts: Readonly<Record<string, number>>;
  /** Part used for `pressed` without a part. */
  readonly defaultPart: string;
  readonly source: string;
}

export const SCROLLBAR_PRESSED_PARTS: PressedPartTable = {
  family: 'scrollbar',
  parts: { up: 20, down: 21, pageUp: 22, pageDown: 23, thumb: 129 },
  defaultPart: 'thumb',
  source: 'DECISIONS #4; scrollbar §2 mapping, §4.8 HT2–HT8',
};
