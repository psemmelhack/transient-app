/** A filled outline in font units. Clockwise contours read as ink. */
export interface TtfContour {
  x: number;
  y: number;
}

export interface TtfGlyph {
  advance: number;
  lsb: number;
  contours: TtfContour[][];
}

const encoder = new TextEncoder();

function u8(bytes: number[]): Uint8Array {
  return Uint8Array.from(bytes);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function pad4(bytes: Uint8Array): Uint8Array {
  const extra = (4 - (bytes.length % 4)) % 4;
  if (!extra) return bytes;
  const out = new Uint8Array(bytes.length + extra);
  out.set(bytes);
  return out;
}

function i16(value: number): number[] {
  const n = Math.max(-32768, Math.min(32767, Math.round(value)));
  return [(n >> 8) & 255, n & 255];
}

function u16(value: number): number[] {
  const n = Math.max(0, Math.min(65535, Math.round(value)));
  return [(n >> 8) & 255, n & 255];
}

function u32(value: number): number[] {
  const n = value >>> 0;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function fixed(value: number): number[] {
  return u32(Math.round(value * 65536));
}

function checksum(data: Uint8Array): number {
  let sum = 0;
  for (let index = 0; index < data.length; index += 4) {
    const word =
      ((data[index] ?? 0) << 24) |
      ((data[index + 1] ?? 0) << 16) |
      ((data[index + 2] ?? 0) << 8) |
      (data[index + 3] ?? 0);
    sum = (sum + word) >>> 0;
  }
  return sum;
}

function encodeSimpleGlyph(contours: TtfContour[][]): Uint8Array {
  const usable = contours
    .map((contour) => contour.filter((point, index) => index === 0 || point.x !== contour[index - 1].x || point.y !== contour[index - 1].y))
    .filter((contour) => contour.length >= 3);
  if (!usable.length) return new Uint8Array(0);
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const contour of usable) {
    for (const point of contour) {
      xMin = Math.min(xMin, point.x);
      yMin = Math.min(yMin, point.y);
      xMax = Math.max(xMax, point.x);
      yMax = Math.max(yMax, point.y);
    }
  }
  const flags: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  const ends: number[] = [];
  let cursor = 0;
  let px = 0;
  let py = 0;
  for (const contour of usable) {
    for (const point of contour) {
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      let dx = x - px;
      let dy = y - py;
      let flag = 0x01;
      if (dx === 0) flag |= 0x10;
      else if (Math.abs(dx) <= 255) {
        flag |= 0x02;
        if (dx > 0) flag |= 0x10;
        else dx = -dx;
        xs.push(dx);
      } else xs.push(...i16(dx));
      if (dy === 0) flag |= 0x20;
      else if (Math.abs(dy) <= 255) {
        flag |= 0x04;
        if (dy > 0) flag |= 0x20;
        else dy = -dy;
        ys.push(dy);
      } else ys.push(...i16(dy));
      flags.push(flag);
      px = x;
      py = y;
      cursor += 1;
    }
    ends.push(cursor - 1);
  }
  const packedFlags: number[] = [];
  for (let index = 0; index < flags.length; ) {
    let repeat = 1;
    while (index + repeat < flags.length && flags[index + repeat] === flags[index] && repeat < 256) repeat += 1;
    if (repeat > 1) {
      packedFlags.push(flags[index] | 0x08, repeat - 1);
      index += repeat;
    } else {
      packedFlags.push(flags[index]);
      index += 1;
    }
  }
  return u8([...i16(usable.length), ...i16(xMin), ...i16(yMin), ...i16(xMax), ...i16(yMax), ...ends.flatMap((end) => u16(end)), ...u16(0), ...packedFlags, ...xs, ...ys]);
}

function nameTable(family: string): Uint8Array {
  const records: { id: number; text: string }[] = [
    { id: 1, text: family },
    { id: 2, text: 'Regular' },
    { id: 4, text: family },
    { id: 6, text: family.replace(/[^A-Za-z0-9]/g, '') || 'Made' },
  ];
  const strings = records.map((record) => {
    const bytes: number[] = [];
    for (const code of encoder.encode(record.text)) {
      bytes.push(0, code);
    }
    return bytes;
  });
  const count = records.length;
  const storage = strings.reduce((sum, bytes) => sum + bytes.length, 0);
  const stringOffset = 6 + count * 12;
  const body: number[] = [...u16(0), ...u16(count), ...u16(stringOffset)];
  let offset = 0;
  strings.forEach((bytes, index) => {
    body.push(...u16(3), ...u16(1), ...u16(0x0409), ...u16(records[index].id), ...u16(bytes.length), ...u16(offset));
    offset += bytes.length;
  });
  for (const bytes of strings) body.push(...bytes);
  void storage;
  return u8(body);
}

function cmapTable(): Uint8Array {
  const segCount = 2;
  const searchRange = 4;
  const entrySelector = 1;
  const rangeShift = 0;
  const formatLength = 32;
  const subtable = [
    ...u16(4),
    ...u16(formatLength),
    ...u16(0),
    ...u16(segCount * 2),
    ...u16(searchRange),
    ...u16(entrySelector),
    ...u16(rangeShift),
    ...u16(126),
    ...u16(0xffff),
    ...u16(0),
    ...u16(32),
    ...u16(0xffff),
    ...i16(-31),
    ...i16(1),
    ...u16(0),
    ...u16(0),
  ];
  return u8([...u16(0), ...u16(1), ...u16(3), ...u16(1), ...u32(12), ...subtable]);
}

/**
 * A TrueType file whose glyphs are straight on-curve outlines.
 * Enough for `FontFace` and for the capture stylesheet to draw the same ink.
 */
export function buildTrueType(glyphs: TtfGlyph[], family: string): Uint8Array {
  const encoded = glyphs.map((glyph) => encodeSimpleGlyph(glyph.contours));
  const glyfParts: Uint8Array[] = [];
  const loca: number[] = [0];
  let cursor = 0;
  let xMin = 0;
  let yMin = 0;
  let xMax = 0;
  let yMax = 0;
  let advanceMax = 0;
  let minLsb = 0;
  let minRsb = 0;
  let maxExtent = 0;
  let maxPoints = 0;
  let maxContours = 0;
  encoded.forEach((bytes, index) => {
    glyfParts.push(bytes);
    cursor += bytes.length;
    loca.push(cursor);
    const glyph = glyphs[index];
    advanceMax = Math.max(advanceMax, glyph.advance);
    let gx0 = Infinity;
    let gy0 = Infinity;
    let gx1 = -Infinity;
    let gy1 = -Infinity;
    let points = 0;
    for (const contour of glyph.contours) {
      points += contour.length;
      for (const point of contour) {
        gx0 = Math.min(gx0, point.x);
        gy0 = Math.min(gy0, point.y);
        gx1 = Math.max(gx1, point.x);
        gy1 = Math.max(gy1, point.y);
      }
    }
    maxPoints = Math.max(maxPoints, points);
    maxContours = Math.max(maxContours, glyph.contours.length);
    if (gx0 !== Infinity) {
      xMin = Math.min(xMin, gx0);
      yMin = Math.min(yMin, gy0);
      xMax = Math.max(xMax, gx1);
      yMax = Math.max(yMax, gy1);
      minLsb = Math.min(minLsb, glyph.lsb);
      minRsb = Math.min(minRsb, glyph.advance - gx1);
      maxExtent = Math.max(maxExtent, gx1);
    }
  });
  const glyf = concat(glyfParts);
  const locaBytes = u8(loca.flatMap((offset) => u32(offset)));
  const hmtx = u8(glyphs.flatMap((glyph) => [...u16(glyph.advance), ...i16(glyph.lsb)]));
  const head = u8([
    ...fixed(1),
    ...fixed(1),
    ...u32(0),
    ...u32(0x5f0f3cf5),
    ...u16(0x000b),
    ...u16(1000),
    ...u32(0),
    ...u32(0),
    ...u32(0),
    ...u32(0),
    ...i16(xMin),
    ...i16(yMin),
    ...i16(xMax),
    ...i16(yMax),
    ...u16(0),
    ...u16(8),
    ...i16(2),
    ...i16(1),
    ...i16(0),
  ]);
  const hhea = u8([
    ...fixed(1),
    ...i16(860),
    ...i16(-220),
    ...i16(0),
    ...u16(advanceMax),
    ...i16(minLsb),
    ...i16(minRsb),
    ...i16(maxExtent),
    ...i16(1),
    ...i16(0),
    ...i16(0),
    ...i16(0),
    ...i16(0),
    ...i16(0),
    ...i16(0),
    ...i16(0),
    ...u16(glyphs.length),
  ]);
  const maxp = u8([
    ...fixed(1),
    ...u16(glyphs.length),
    ...u16(maxPoints),
    ...u16(maxContours),
    ...u16(0),
    ...u16(0),
    ...u16(2),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
  ]);
  const os2 = u8([
    ...u16(0),
    ...i16(560),
    ...u16(400),
    ...u16(5),
    ...u16(0),
    ...i16(500),
    ...i16(500),
    ...i16(0),
    ...i16(0),
    ...i16(500),
    ...i16(500),
    ...i16(0),
    ...i16(0),
    ...i16(50),
    ...i16(300),
    ...i16(0),
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ...u32(1),
    ...u32(0),
    ...u32(0),
    ...u32(0),
    0x54, 0x52, 0x4e, 0x53,
    ...u16(0x40),
    ...u16(32),
    ...u16(126),
    ...i16(860),
    ...i16(-220),
    ...i16(0),
    ...u16(980),
    ...u16(280),
  ]);
  const post = u8([...u32(0x00030000), ...fixed(0), ...i16(-120), ...i16(50), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0)]);
  const tables = [
    { tag: 'OS/2', data: pad4(os2) },
    { tag: 'cmap', data: pad4(cmapTable()) },
    { tag: 'glyf', data: pad4(glyf) },
    { tag: 'head', data: pad4(head) },
    { tag: 'hhea', data: pad4(hhea) },
    { tag: 'hmtx', data: pad4(hmtx) },
    { tag: 'loca', data: pad4(locaBytes) },
    { tag: 'maxp', data: pad4(maxp) },
    { tag: 'name', data: pad4(nameTable(family)) },
    { tag: 'post', data: pad4(post) },
  ].sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const count = tables.length;
  const searchRange = 128;
  const entrySelector = 3;
  const rangeShift = count * 16 - searchRange;
  const directory = 12 + count * 16;
  let offset = directory;
  const records: Uint8Array[] = [];
  for (const table of tables) {
    const rawLength = table.tag === 'head' ? 54 : table.data.length;
    const length = table.tag === 'glyf' ? glyf.length : table.tag === 'loca' ? locaBytes.length : table.tag === 'hmtx' ? glyphs.length * 4 : table.data.length;
    void rawLength;
    const storedLength =
      table.tag === 'glyf'
        ? glyf.length
        : table.tag === 'loca'
          ? locaBytes.length
          : table.tag === 'hmtx'
            ? glyphs.length * 4
            : table.tag === 'head'
              ? 54
              : table.tag === 'hhea'
                ? 36
                : table.tag === 'maxp'
                  ? 32
                  : table.tag === 'post'
                    ? 32
                    : table.tag === 'OS/2'
                      ? os2.length
                      : table.tag === 'cmap'
                        ? cmapTable().length
                        : nameTable(family).length;
    records.push(u8([...encoder.encode(table.tag), ...u32(checksum(table.data)), ...u32(offset), ...u32(storedLength)]));
    offset += table.data.length;
    void length;
  }
  const header = u8([...u32(0x00010000), ...u16(count), ...u16(searchRange), ...u16(entrySelector), ...u16(rangeShift)]);
  const file = concat([header, ...records, ...tables.map((table) => table.data)]);
  const adjustment = (0xb1b0afba - checksum(file)) >>> 0;
  const headRecord = records.findIndex((_, index) => tables[index].tag === 'head');
  const headOffset = directory + tables.slice(0, headRecord).reduce((sum, table) => sum + table.data.length, 0);
  file[headOffset + 8] = (adjustment >>> 24) & 255;
  file[headOffset + 9] = (adjustment >>> 16) & 255;
  file[headOffset + 10] = (adjustment >>> 8) & 255;
  file[headOffset + 11] = adjustment & 255;
  return file;
}
