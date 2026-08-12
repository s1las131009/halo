/**
 * make-qr.mjs — regenerate assets/qr.svg
 *
 *   node tools/make-qr.mjs "https://your-team.github.io/halo/"
 *
 * Run it with no argument and it reuses the URL already stored in site.config.js.
 * Zero dependencies: no npm install, works offline.
 *
 * Byte mode, error-correction level M (~15% of the code can be damaged and it
 * still scans — the level printed posters normally use).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = join(ROOT, "site.config.js");
const OUT = join(ROOT, "assets", "qr.svg");

/* ── version tables, error-correction level M, versions 1–10 ─────────────── */
// [total codewords, ecc codewords per block, [ [blockCount, dataCodewords], ... ]]
const VERSIONS = {
  1:  [26,  10, [[1, 16]]],
  2:  [44,  16, [[1, 28]]],
  3:  [70,  26, [[1, 44]]],
  4:  [100, 18, [[2, 32]]],
  5:  [134, 24, [[2, 43]]],
  6:  [172, 16, [[4, 27]]],
  7:  [196, 18, [[4, 31]]],
  8:  [242, 22, [[2, 38], [2, 39]]],
  9:  [292, 22, [[3, 36], [2, 37]]],
  10: [346, 26, [[4, 43], [1, 44]]],
};

const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

/* ── GF(256) arithmetic for Reed–Solomon ────────────────────────────────── */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x; LOG[x] = i;
  x <<= 1; if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generatorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function ecc(data, count) {
  const gen = generatorPoly(count);
  const rem = new Array(count).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift(); rem.push(0);
    for (let i = 0; i < count; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
}

/* ── bit stream ─────────────────────────────────────────────────────────── */
function encodeData(bytes, version) {
  const [total, eccPerBlock, groups] = VERSIONS[version];
  const dataCodewords = total - eccPerBlock * groups.reduce((n, [c]) => n + c, 0);

  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4);                                  // byte mode
  push(bytes.length, version < 10 ? 8 : 16);        // character count
  for (const b of bytes) push(b, 8);

  const capacity = dataCodewords * 8;
  if (bits.length > capacity) return null;

  push(0, Math.min(4, capacity - bits.length));     // terminator
  while (bits.length % 8) bits.push(0);             // pad to byte boundary

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((n, b) => (n << 1) | b, 0));
  }
  // padding always starts at 0xEC and alternates from there, whatever the
  // length of the real data happened to be
  const PAD = [0xec, 0x11];
  for (let i = 0; codewords.length < dataCodewords; i++) codewords.push(PAD[i % 2]);

  /* split into blocks, compute ECC, interleave */
  const dataBlocks = [], eccBlocks = [];
  let offset = 0;
  for (const [blockCount, blockSize] of groups) {
    for (let i = 0; i < blockCount; i++) {
      const block = codewords.slice(offset, offset + blockSize);
      offset += blockSize;
      dataBlocks.push(block);
      eccBlocks.push(ecc(block, eccPerBlock));
    }
  }

  const out = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++)
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  for (let i = 0; i < eccPerBlock; i++)
    for (const block of eccBlocks) out.push(block[i]);

  return out;
}

/* ── matrix construction ────────────────────────────────────────────────── */
function buildMatrix(version, codewords) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const set = (r, c, v) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    m[r][c] = v; reserved[r][c] = true;
  };

  // finder patterns + separators
  for (const [br, bc] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const on = inner && ((r === 0 || r === 6 || c === 0 || c === 6) ||
                             (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(br + r, bc + c, on ? 1 : 0);
      }
    }
  }

  // timing patterns
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0 ? 1 : 0);
    set(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // alignment patterns
  const centers = ALIGN[version];
  for (const r of centers) {
    for (const c of centers) {
      if ((r === 6 && c === 6) || (r === 6 && c === centers.at(-1)) ||
          (r === centers.at(-1) && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          set(r + dr, c + dc, on ? 1 : 0);
        }
      }
    }
  }

  set(size - 8, 8, 1); // dark module

  // reserve format areas
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) set(8, i, 0);
    if (!reserved[i][8]) set(i, 8, 0);
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 1 - i]) set(8, size - 1 - i, 0);
    if (!reserved[size - 1 - i][8]) set(size - 1 - i, 8, 0);
  }

  // version information (version 7 and up)
  if (version >= 7) {
    let bits = version << 12;
    for (let i = 0; i < 12; i++) {
      const shift = 17 - i;
      if ((bits >> shift) & 1) bits ^= 0x1f25 << (shift - 12);
    }
    const info = (version << 12) | (bits & 0xfff);
    for (let i = 0; i < 18; i++) {
      const bit = (info >> i) & 1;
      set(Math.floor(i / 3), size - 11 + (i % 3), bit);
      set(size - 11 + (i % 3), Math.floor(i / 3), bit);
    }
  }

  // data, zig-zag from bottom right
  let bitIndex = 0;
  const nextBit = () => {
    const byte = codewords[bitIndex >> 3];
    const bit = byte === undefined ? 0 : (byte >> (7 - (bitIndex & 7))) & 1;
    bitIndex++;
    return bit;
  };

  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;                      // skip the vertical timing column
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (!reserved[row][c]) m[row][c] = nextBit();
      }
    }
    upward = !upward;
  }

  return { m, reserved, size };
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyFormat(m, size, mask) {
  const data = (0b00 << 3) | mask;             // 00 = error-correction level M
  let bits = data << 10;
  for (let i = 0; i < 5; i++) {
    const shift = 14 - i;
    if ((bits >> shift) & 1) bits ^= 0x537 << (shift - 10);
  }
  const format = ((data << 10) | (bits & 0x3ff)) ^ 0x5412;

  for (let i = 0; i < 15; i++) {
    const bit = (format >> i) & 1;
    // vertical strip beside the top-left finder, then wrapping to the top-right
    if (i < 6) m[i][8] = bit;
    else if (i === 6) m[7][8] = bit;
    else if (i === 7) m[8][8] = bit;
    else if (i === 8) m[8][7] = bit;
    else m[8][14 - i] = bit;
    // horizontal strip
    if (i < 8) m[8][size - 1 - i] = bit;
    else m[size - 15 + i][8] = bit;
  }
}

function penalty(m, size) {
  let score = 0;

  // rule 1 — runs of five or more identical modules
  for (let i = 0; i < size; i++) {
    for (const line of [m[i], m.map((row) => row[i])]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (line[j] === line[j - 1]) { run++; }
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
  }

  // rule 2 — 2x2 blocks of one colour
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++)
      if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1])
        score += 3;

  // rule 3 — finder-like patterns
  const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matches = (line, i, pat) => pat.every((v, k) => line[i + k] === v);
  for (let i = 0; i < size; i++) {
    const row = m[i], col = m.map((r) => r[i]);
    for (let j = 0; j + 11 <= size; j++) {
      if (matches(row, j, A) || matches(row, j, B)) score += 40;
      if (matches(col, j, A) || matches(col, j, B)) score += 40;
    }
  }

  // rule 4 — deviation from a 50/50 light/dark balance
  const dark = m.flat().filter((v) => v === 1).length;
  score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;

  return score;
}

export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];

  let version = null, codewords = null;
  for (let v = 1; v <= 10; v++) {
    const encoded = encodeData(bytes, v);
    if (encoded) { version = v; codewords = encoded; break; }
  }
  if (!version) throw new Error(`URL too long for this generator (${bytes.length} bytes, max ~213)`);

  const { m, reserved, size } = buildMatrix(version, codewords);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = m.map((row) => [...row]);
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (!reserved[r][c] && MASKS[mask](r, c)) candidate[r][c] ^= 1;
    applyFormat(candidate, size, mask);
    const score = penalty(candidate, size);
    if (!best || score < best.score) best = { score, matrix: candidate };
  }

  return { matrix: best.matrix, size, version };
}

/* ── SVG output ─────────────────────────────────────────────────────────── */
function toSvg(text, { quiet = 4, scale = 8 } = {}) {
  const { matrix, size } = qrMatrix(text);
  const dim = size + quiet * 2;

  let path = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim * scale}" height="${dim * scale}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${text}">
<rect width="${dim}" height="${dim}" fill="#ffffff"/>
<path d="${path}" fill="#0B0F1A"/>
</svg>
`;
}

/* ── run ────────────────────────────────────────────────────────────────── */
function urlFromConfig() {
  const match = readFileSync(CONFIG, "utf8").match(/SITE_URL\s*=\s*["'`]([^"'`]+)["'`]/);
  if (!match) throw new Error("Could not find SITE_URL in site.config.js");
  return match[1];
}

// only when run directly, so the encoder can also be imported by a test
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv[2];
  const url = arg || urlFromConfig();

  if (arg) {
    // keep the page caption and the QR code pointing at the same place
    const config = readFileSync(CONFIG, "utf8")
      .replace(/(SITE_URL\s*=\s*)["'`][^"'`]+["'`]/, `$1"${arg}"`);
    writeFileSync(CONFIG, config);
  }

  writeFileSync(OUT, toSvg(url));
  console.log(`✓ assets/qr.svg now points to  ${url}`);
}
