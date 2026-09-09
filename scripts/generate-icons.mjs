/**
 * Generate PWA icons with ZERO dependencies (pure Node: zlib + fs).
 * Minimal PNG encoder: RGBA, filter-0 scanlines, single IDAT.
 * Design: teal→violet diagonal gradient + white ring + center dot.
 *
 * Usage: npm run icons
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "icons");

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function encodePng(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x / (size - 1), y / (size - 1));
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const img = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", img), chunk("IEND", Buffer.alloc(0))]);
}

// teal #0e7c7b → violet #7c5cff
const C1 = [14, 124, 123];
const C2 = [124, 92, 255];

function paintPad(pad) {
  return (u, v) => {
    const t = (u + v) / 2;
    const dx = u - 0.5;
    const dy = v - 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const R = 0.5 - pad; // safe-area radius
    const rr = R * 0.62;
    let r = lerp(C1[0], C2[0], t);
    let g = lerp(C1[1], C2[1], t);
    let b = lerp(C1[2], C2[2], t);
    // white ring
    const dRing = Math.abs(dist - rr);
    const w = 0.028;
    if (dRing < w) {
      const k = 1 - dRing / w;
      r = lerp(r, 255, k);
      g = lerp(g, 255, k);
      b = lerp(b, 255, k);
    }
    // center dot
    if (dist < rr * 0.28) {
      r = 255;
      g = 255;
      b = 255;
    }
    return [r, g, b, 255];
  };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const jobs = [
    ["icon-192.png", 192, paintPad(0)],
    ["icon-512.png", 512, paintPad(0)],
    ["maskable-512.png", 512, paintPad(0.12)],
    ["apple-touch-icon.png", 180, paintPad(0)],
    ["favicon-32.png", 32, paintPad(0)],
  ];
  for (const [name, size, paint] of jobs) {
    await fs.writeFile(path.join(OUT, name), encodePng(size, paint));
    console.log("wrote", name);
  }
  // Chrome extension icons (extension/icons/)
  const extOut = path.join(__dirname, "..", "extension", "icons");
  await fs.mkdir(extOut, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    const name = `icon-${size}.png`;
    await fs.writeFile(path.join(extOut, name), encodePng(size, paintPad(0)));
    console.log("wrote extension/", name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
