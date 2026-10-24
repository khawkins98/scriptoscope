import { readCicnIndexed } from "../theme-loader/decoders/cicn.js";

export type IndexedArtwork = {
  pmap: { width: number; height: number };
  mask: { width: number; height: number };
  indices: Uint8Array;
  maskAlpha: Uint8Array;
  colorTable: { flags: number; entries: Array<{ value: number }> };
};

export function indexedArtwork(data: Uint8Array): IndexedArtwork | null {
  return readCicnIndexed(data) as unknown as IndexedArtwork | null;
}

/** Select an exact source record, never infer it from rendered RGB. */
export function recordAtPixel(
  image: IndexedArtwork,
  x: number,
  y: number,
): { record: number; index: number } | { reason: string } {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= image.pmap.width ||
    y >= image.pmap.height
  )
    return { reason: "Choose a pixel inside the source image." };
  if (
    x < image.mask.width &&
    y < image.mask.height &&
    image.maskAlpha[y * image.mask.width + x] === 0
  )
    return {
      reason: "Transparent pixel. Choose a visible pixel or a palette record.",
    };
  const index = image.indices[y * image.pmap.width + x]!;
  const matches = image.colorTable.entries.flatMap((entry, record) =>
    (image.colorTable.flags & 0x8000 ? record : entry.value) === index
      ? [record]
      : [],
  );
  if (matches.length !== 1)
    return {
      reason: matches.length
        ? "This index has duplicate records. Choose a record in the palette."
        : "This pixel has no matching palette record.",
    };
  return { record: matches[0]!, index };
}
