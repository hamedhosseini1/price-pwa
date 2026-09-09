import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { flagUrl, FLAGS, CATALOG } from "../lib/catalog";
import MANIFEST from "../lib/coin-icons.json";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("vendored artwork", () => {
  it("flagUrl points to local files", () => {
    expect(flagUrl("USD")).toBe("/flags/us.png");
    expect(flagUrl("XXX")).toBeNull();
    for (const [id, iso] of Object.entries(FLAGS)) {
      expect(existsSync(path.join(ROOT, "public", "flags", `${iso}.png`)), `flag ${id}`).toBe(true);
    }
  });
  it("coin manifest covers every coingecko catalog item with real files", () => {
    const m = MANIFEST as Record<string, string>;
    const want = CATALOG.filter((c) => c.src.coingecko).map((c) => c.id);
    expect(want.length).toBeGreaterThan(10);
    for (const id of want) {
      expect(m[id], `manifest ${id}`).toMatch(/^\/coins\/.+\.png$/);
      expect(existsSync(path.join(ROOT, "public", m[id])), `file ${id}`).toBe(true);
    }
  });
});
