import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.name.endsWith(".json")) yield full;
  }
}

describe("repo hygiene", () => {
  it("every JSON file parses (vercel.json has no comments!)", async () => {
    const bad: string[] = [];
    for await (const f of walk(ROOT)) {
      try {
        JSON.parse(await fs.readFile(f, "utf-8"));
      } catch {
        bad.push(path.relative(ROOT, f));
      }
    }
    expect(bad).toEqual([]);
  });
  it("no secrets staged: .env files are gitignored and keyless", async () => {
    const gi = await fs.readFile(path.join(ROOT, ".gitignore"), "utf-8");
    expect(gi).toMatch(/^\.env$/m);
    const ex = await fs.readFile(path.join(ROOT, ".env.example"), "utf-8");
    expect(ex).not.toMatch(/ghp_[A-Za-z0-9]{36}/);
    expect(ex).not.toMatch(/BRSAPI_KEY=\S+/);
  });
});
