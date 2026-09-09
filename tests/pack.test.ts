import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { inflateRawSync } from "zlib";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseZip(buf: Buffer) {
  // minimal central-directory parser (validates our packer output)
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error("bad local signature");
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("no end-of-central-directory");
  const count = buf.readUInt16LE(eocd + 10);
  const cdOff = buf.readUInt32LE(eocd + 16);
  const names: string[] = [];
  let p = cdOff;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`bad central signature at ${p}`);
    const method = buf.readUInt16LE(p + 10);
    const compLen = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf-8");
    names.push(name);
    // cross-check local header + decompress one file
    if (method === 8 && name === "manifest.json") {
      const lp = localOff;
      if (buf.readUInt32LE(lp) !== 0x04034b50) throw new Error("bad local header");
      const ln = buf.readUInt16LE(lp + 26);
      const le = buf.readUInt16LE(lp + 28);
      const data = buf.subarray(lp + 30 + ln + le, lp + 30 + ln + le + compLen);
      const json = JSON.parse(inflateRawSync(data).toString("utf-8"));
      if (!json.name) throw new Error("manifest has no name");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

describe("pack-extension", () => {
  it("produces a valid deterministic ZIP containing the extension", async () => {
    const out = path.join(ROOT, "public", "extension.zip");
    execFileSync("node", [path.join(ROOT, "scripts", "pack-extension.mjs"), "--out", out], { timeout: 60000 });
    const buf = await fs.readFile(out);
    const names = parseZip(buf);
    expect(names).toContain("manifest.json");
    expect(names).toContain("popup.html");
    expect(names).toContain("background.js");
    expect(names.some((n) => n.startsWith("icons/"))).toBe(true);
    expect(names.some((n) => n.startsWith("_locales/"))).toBe(true);
    // deterministic: same input → same bytes
    const out2 = out + ".2";
    execFileSync("node", [path.join(ROOT, "scripts", "pack-extension.mjs"), "--out", out2], { timeout: 60000 });
    const b2 = await fs.readFile(out2);
    expect(b2.equals(buf)).toBe(true);
    await fs.unlink(out2);
  }, 120000);
});
