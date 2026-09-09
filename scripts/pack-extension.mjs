/**
 * Pack extension/ into a deterministic ZIP for in-app download.
 * Pure Node (zlib + fs, zero deps) — works on any platform.
 *
 *   node scripts/pack-extension.mjs [--out public/extension.zip]
 *
 * The ZIP uses deflate compression, fixed timestamps (reproducible builds),
 * and UTF-8 filenames. Excludes .DS_Store / Thumbs.db.
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "extension");
const SKIP = new Set([".DS_Store", "Thumbs.db", ".gitkeep"]);
// fixed DOS timestamp for reproducible output
const DOSTIME = ((12 << 11) | (0 << 5) | 0) >>> 0; // 12:00:00
const DOSDATE = (((2026 - 1980) << 9) | (1 << 5) | 1) >>> 0; // 2026-01-01

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

async function collect(dir, base, out) {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  for (const e of ents.sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      out.push({ name: rel + "/", dir: true });
      await collect(full, rel, out);
    } else if (e.isFile()) {
      out.push({ name: rel, dir: false, full });
    }
  }
  return out;
}

function u16(v) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(v);
  return b;
}
function u32(v) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v >>> 0);
  return b;
}

async function main() {
  const outIdx = process.argv.indexOf("--out");
  const out = outIdx >= 0 ? process.argv[outIdx + 1] : path.join(ROOT, "public", "extension.zip");
  const entries = await collect(SRC, "", []);
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(enc.encode(e.name));
    let data = Buffer.alloc(0);
    let method = 0;
    let crc = 0;
    let usize = 0;
    if (!e.dir) {
      const raw = await fs.readFile(e.full);
      data = zlib.deflateRawSync(raw, { level: 9 });
      method = 8;
      crc = crc32(raw);
      usize = raw.length;
    }
    chunks.push(
      Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(method), u16(DOSTIME), u16(DOSDATE), u32(crc), u32(data.length), u32(usize), u16(nameBuf.length), u16(0), nameBuf, data]),
    );
    central.push({ e, nameBuf, method, crc, compLen: data.length, usize, offset });
    offset += chunks[chunks.length - 1].length;
  }
  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) {
    const rec = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(c.method), u16(DOSTIME), u16(DOSDATE),
      u32(c.crc), u32(c.compLen), u32(c.usize), u16(c.nameBuf.length), u16(0), u16(0), u16(0), u16(0),
      u32(c.e.dir ? 0x10 : 0x20), u32(c.offset), c.nameBuf,
    ]);
    chunks.push(rec);
    cdSize += rec.length;
  }
  chunks.push(Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(cdSize), u32(cdStart), u16(0)]));
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, Buffer.concat(chunks));
  console.log(`packed ${central.length} entries → ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
