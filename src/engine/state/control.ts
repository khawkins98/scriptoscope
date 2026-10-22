// Control state normalisation: public `{state, pressedPart}` → native hilite
// (DECISIONS #4; scrollbar §2). The rows live in tables/controlState.ts; this
// module only selects them.
//
// `pressedPart` is read only for `state: 'pressed'`; for any other state it is
// ignored (DECISIONS #4 defines it as a qualifier of `pressed`). An unknown
// state or part is an input error, not a fallback.
import { CONTROL_STATE, type ControlStateName, type PressedPartTable } from '../tables/controlState.js';

export interface ControlStateInput {
  state?: ControlStateName;
  pressedPart?: string;
}

export interface NormalizedControlState {
  state: ControlStateName;
  /** The pressed part after defaulting; null unless `state` is `pressed`. */
  pressedPart: string | null;
  hilite: number;
  /** Table rows taken. */
  rows: string[];
}

export function normalizeControlState(input: ControlStateInput, parts: PressedPartTable): NormalizedControlState {
  const state = input.state ?? 'normal';
  const row = CONTROL_STATE.find(r => r.state === state);
  if (!row) throw new TypeError(`normalizeControlState: unknown state ${String(state)}`);
  if (row.hilite !== 'part') return { state, pressedPart: null, hilite: row.hilite, rows: [row.id] };
  const part = input.pressedPart ?? parts.defaultPart;
  const hilite = parts.parts[part];
  if (hilite === undefined) throw new TypeError(`normalizeControlState: unknown ${parts.family} part ${part}`);
  return { state, pressedPart: part, hilite, rows: [row.id, `${parts.family}-part-${part}`] };
}
