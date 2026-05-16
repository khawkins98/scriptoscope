// Parse DeRez .r text output into structured resource records.
//
// DeRez emits resources as:
//
//     data 'TYPE' (ID, "optional name", attr1, attr2, ...) {
//         $"<hex bytes>"
//         $"<hex bytes>"                  /* optional MacRoman comment */
//         ...
//     };
//
// We extract: type (4 chars), id (signed int16), name (string or null),
// attrs (array of strings), bytes (Uint8Array of resource data).
//
// MacRoman high-bit bytes appear inside the /* ... */ comments. Callers
// should pass the .r file content as a 'latin1' / 'binary' string so all
// bytes survive 1:1 through string operations — UTF-8 decoding will
// corrupt high-bit bytes and confuse the parser.

/** @typedef {{type: string, id: number, name: string|null, attrs: string[], bytes: Uint8Array}} ResourceRecord */

/**
 * Parse DeRez .r text into resource records.
 * @param {string} text  DeRez output, read as 'latin1' / 'binary' to preserve high-bit bytes
 * @returns {ResourceRecord[]}
 */
export function parseDerezText(text) {
  const records = [];

  // Split into resource blocks. Each starts with "data '" at line start.
  // We use a non-anchored regex with lookahead since we want to keep the
  // "data '" prefix on each block for header parsing.
  const blocks = splitResourceBlocks(text);

  for (const block of blocks) {
    const record = parseResourceBlock(block);
    if (record) records.push(record);
  }

  return records;
}

function splitResourceBlocks(text) {
  // Find the byte offset of every "^data '" occurrence.
  const starts = [];
  const needle = "\ndata '";
  let idx = text.startsWith("data '") ? 0 : text.indexOf(needle);
  if (text.startsWith("data '")) starts.push(0);
  while (idx !== -1 && idx < text.length) {
    if (idx > 0) starts.push(idx + 1); // skip the leading \n
    idx = text.indexOf(needle, idx + 1);
  }

  const blocks = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    blocks.push(text.slice(start, end));
  }
  return blocks;
}

function parseResourceBlock(block) {
  // Header: data 'TYPE' (ID[, "name"][, attr...]) {
  // The type is always exactly 4 characters between single quotes.
  // ID is a signed integer.
  // Name is optionally present, in double quotes, immediately after ID.
  // Attrs are bareword identifiers (sysheap, purgeable, locked, etc.).
  //
  // We parse with a hand-rolled state machine since the regex would need
  // to be careful about escaped quotes inside the name string.

  const headerEnd = block.indexOf('{');
  if (headerEnd === -1) return null;
  const header = block.slice(0, headerEnd);

  // Pull out the type — first thing in single quotes.
  const typeMatch = header.match(/^data\s+'(.{4})'\s*\(/);
  if (!typeMatch) return null;
  const type = typeMatch[1];

  // Inside the parentheses we have ID, optional name, optional attrs.
  // Find the matching close-paren (no nesting in DeRez output).
  const openParen = header.indexOf('(', typeMatch[0].length - 1);
  const closeParen = findMatchingClose(header, openParen);
  if (closeParen === -1) return null;
  const inside = header.slice(openParen + 1, closeParen);

  const { id, name, attrs } = parseHeaderInside(inside);
  if (id === null) return null;

  // Body: everything between { and };
  const bodyStart = headerEnd + 1;
  const bodyEnd = block.lastIndexOf('};');
  if (bodyEnd === -1) return null;
  const body = block.slice(bodyStart, bodyEnd);

  const bytes = extractHexBytes(body);

  return { type, id, name, attrs, bytes };
}

function findMatchingClose(s, openIdx) {
  // DeRez doesn't nest parens inside resource headers, but a name string
  // might contain a ')'. So we step through and respect quoted strings.
  let inString = false;
  let escape = false;
  for (let i = openIdx + 1; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString && c === ')') return i;
  }
  return -1;
}

function parseHeaderInside(inside) {
  // Comma-split, respecting double-quoted strings.
  const parts = [];
  let buf = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < inside.length; i++) {
    const c = inside[i];
    if (escape) { buf += c; escape = false; continue; }
    if (c === '\\') { escape = true; buf += c; continue; }
    if (c === '"') { inString = !inString; buf += c; continue; }
    if (!inString && c === ',') { parts.push(buf.trim()); buf = ''; continue; }
    buf += c;
  }
  if (buf.trim()) parts.push(buf.trim());

  if (parts.length === 0) return { id: null, name: null, attrs: [] };

  const id = parseInt(parts[0], 10);
  if (Number.isNaN(id)) return { id: null, name: null, attrs: [] };

  let name = null;
  let attrStart = 1;
  if (parts.length > 1 && parts[1].startsWith('"') && parts[1].endsWith('"')) {
    name = parts[1].slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    attrStart = 2;
  }

  const attrs = parts.slice(attrStart).filter(Boolean);
  return { id, name, attrs };
}

function extractHexBytes(body) {
  // Each data line: $"hex hex hex hex"   /* optional comment */
  // We collect hex digits between the dollar-quote pairs.
  const bytes = [];
  // Match $"...content..." where content is hex digits and whitespace.
  // The DeRez comment uses /* ... */ which we skip since it lies OUTSIDE
  // the $"..." quotes.
  const re = /\$"([0-9A-Fa-f\s]+)"/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const hex = m[1].replace(/\s+/g, '');
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
  }
  return new Uint8Array(bytes);
}
