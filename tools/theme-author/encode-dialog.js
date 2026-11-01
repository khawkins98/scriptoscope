// Encode the dialog template resources 'DLOG' and 'DITL'.
//
// Kaleidoscope's control panel enables "About This Scheme" when the scheme
// ships an about box: `DLOG -14320` whose item list is `DITL -14320` (the
// control panel's own help, TEXT 1005 "Using the Control Panel": "This
// button is disabled if the scheme does not include an about box"). All 18
// corpus schemes ship the pair: 15 show a PICT, Windows 3.1 and Windows 95
// show static text only (docs/maintainer-reference-environment.md).
//
// 'DLOG' layout (Inside Macintosh: Macintosh Toolbox Essentials, "Dialog
// Manager", 'DLOG' resource):
//
//   0   rect          8   top, left, bottom, right (global; ignored when auto-positioned)
//   8   procID        2   window definition variant: 1 = dBoxProc (modal box)
//   10  visible       1   0/1, then 1 filler byte
//   12  goAwayFlag    1   0/1, then 1 filler byte
//   14  refCon        4
//   18  itemListID    2   the DITL id
//   20  title         Pascal string
//   ..  (pad to even), position 2   auto-position (System 7): 0xA80A = centre on the parent window
//
// 'DITL' layout (same chapter, 'DITL' resource): count − 1 (2 bytes), then per
// item: 4 reserved bytes (0), display rect (8), type (1; +0x80 = disabled),
// data length (1), data, then a pad byte if the data length is odd. Text items
// carry their text; icon, picture and control items a 2-byte resource id;
// user items no data.

import { ByteWriter } from './bytes.js';
import { pascalString, toMacRoman } from './encode-strings.js';

export const DIALOG_POSITION = {
  none: 0x0000,
  centerMainScreen: 0x280a,
  alertPositionMainScreen: 0x300a,
  centerParentWindow: 0xa80a,
  alertPositionParentWindow: 0xb00a,
};

/**
 * @param {{ rect: {top:number,left:number,bottom:number,right:number}, procID?: number,
 *   visible?: boolean, goAway?: boolean, refCon?: number, itemListId: number, title?: string,
 *   position?: number|null, padByte?: number }} dlog  position null omits the field (pre-System 7 templates);
 *   title may also be raw Mac Roman bytes; padByte is the alignment byte's value (0; one corpus file has 0x20)
 * @returns {Uint8Array}
 */
export function encodeDlog({ rect, procID = 1, visible = true, goAway = false, refCon = 0, itemListId, title = '', position = DIALOG_POSITION.centerParentWindow, padByte = 0 }) {
  if (!Number.isInteger(itemListId)) throw new Error('encodeDlog: itemListId (the DITL id) is required');
  const w = new ByteWriter().rect(rect).i16(procID)
    .u8(visible ? 1 : 0).u8(0).u8(goAway ? 1 : 0).u8(0)
    .u32(refCon >>> 0).i16(itemListId);
  const t = pascalString(title);
  w.raw(t);
  // The pad and position word are the System 7 extension; older templates end at the title.
  if (position != null) { if (t.length & 1) w.u8(padByte); w.u16(position); }
  return w.toUint8Array();
}

export const DITL_TYPE = { user: 0, button: 4, checkbox: 5, radio: 6, control: 7, staticText: 8, editText: 16, icon: 32, picture: 64 };

/**
 * @param {Array<{ type: keyof typeof DITL_TYPE, rect: {top:number,left:number,bottom:number,right:number},
 *   enabled?: boolean, text?: string, resourceId?: number, bytes?: ArrayLike<number> }>} items
 *   bytes: the raw item data, written as is (any item type)
 * @returns {Uint8Array}
 */
export function encodeDitl(items) {
  if (!items.length) throw new Error('encodeDitl: an item list needs at least one item');
  const w = new ByteWriter().i16(items.length - 1);
  for (const item of items) {
    const code = DITL_TYPE[item.type];
    if (code == null) throw new Error(`encodeDitl: unknown item type ${item.type}`);
    let data;
    if (item.bytes) {
      data = Array.from(item.bytes);
    } else if (code === DITL_TYPE.icon || code === DITL_TYPE.picture || code === DITL_TYPE.control) {
      if (!Number.isInteger(item.resourceId)) throw new Error(`encodeDitl: a ${item.type} item needs resourceId`);
      data = [(item.resourceId >> 8) & 0xff, item.resourceId & 0xff];
    } else if (code === DITL_TYPE.user) {
      data = [];
    } else {
      data = toMacRoman(item.text ?? '');
    }
    if (data.length > 255) throw new Error(`encodeDitl: item data is ${data.length} bytes; the limit is 255`);
    w.u32(0).rect(item.rect).u8(code | (item.enabled === false ? 0x80 : 0)).u8(data.length).raw(data);
    if (data.length & 1) w.u8(0);
  }
  return w.toUint8Array();
}
