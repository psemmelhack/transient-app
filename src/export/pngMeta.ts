const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + data.length));
  view.setUint32(8 + data.length, crc);
  return out;
}

function encodeLatin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/** PNG iTXt chunk (uncompressed UTF-8). */
export function itxtChunk(keyword: string, text: string): Uint8Array {
  const key = encodeLatin1(keyword.slice(0, 79));
  const body = new TextEncoder().encode(text);
  const data = new Uint8Array(key.length + 5 + body.length);
  data.set(key, 0);
  let o = key.length;
  data[o++] = 0;
  data[o++] = 0; // compression flag
  data[o++] = 0; // compression method
  data[o++] = 0; // language tag
  data[o++] = 0; // translated keyword
  data.set(body, o);
  return chunk('iTXt', data);
}

export function insertPngText(png: Uint8Array, fields: Record<string, string>): Uint8Array {
  const signature = png.subarray(0, 8);
  const pieces: Uint8Array[] = [signature];
  const extras = Object.entries(fields)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => itxtChunk(key, value));
  let offset = 8;
  while (offset + 8 <= png.length) {
    const view = new DataView(png.buffer, png.byteOffset + offset, 8);
    const length = view.getUint32(0);
    const type = String.fromCharCode(png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]);
    const size = 12 + length;
    if (type === 'IEND') {
      pieces.push(...extras);
    }
    pieces.push(png.subarray(offset, offset + size));
    offset += size;
    if (type === 'IEND') break;
  }
  const total = pieces.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of pieces) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

export function readPngText(png: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  let offset = 8;
  const decoder = new TextDecoder();
  while (offset + 8 <= png.length) {
    const view = new DataView(png.buffer, png.byteOffset + offset, png.length - offset);
    const length = view.getUint32(0);
    const type = String.fromCharCode(png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]);
    if (type === 'iTXt') {
      const data = png.subarray(offset + 8, offset + 8 + length);
      const nul = data.indexOf(0);
      const keyword = decoder.decode(data.subarray(0, nul));
      // keyword \0 flag method language \0 translated \0 text
      let cursor = nul + 1;
      cursor += 2; // flag + method
      const langEnd = data.indexOf(0, cursor);
      cursor = langEnd + 1;
      const transEnd = data.indexOf(0, cursor);
      const text = decoder.decode(data.subarray(transEnd + 1));
      out[keyword] = text;
    }
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return out;
}

export function metadataFor(input: {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  utc: string;
  timezone: string;
  message: string;
  place: string | null;
  temperatureC: number | null;
  sunAzimuth: number | null;
  sunAltitude: number | null;
  /** Every telemetry line, including ones the poster leaves out. */
  telemetry?: string[] | null;
}): Record<string, string> {
  const fields: Record<string, string> = {
    Software: 'Transient',
    'transient:latitude': input.latitude.toFixed(6),
    'transient:longitude': input.longitude.toFixed(6),
    'transient:utc': input.utc,
    'transient:timezone': input.timezone,
  };
  if (input.altitude != null) fields['transient:altitude'] = String(Math.round(input.altitude));
  if (input.accuracy != null) fields['transient:accuracy'] = String(Math.round(input.accuracy));
  if (input.place) fields['transient:place'] = input.place;
  if (input.message.trim()) fields['transient:message'] = input.message.trim();
  if (input.temperatureC != null) fields['transient:temperature-c'] = String(input.temperatureC);
  if (input.sunAzimuth != null) fields['transient:sun-azimuth'] = String(Math.round(input.sunAzimuth));
  if (input.sunAltitude != null) fields['transient:sun-altitude'] = input.sunAltitude.toFixed(2);
  const telemetry = input.telemetry?.map((line) => line.trim()).filter(Boolean) ?? [];
  if (telemetry.length) fields['transient:telemetry'] = telemetry.join('\n');
  return fields;
}
