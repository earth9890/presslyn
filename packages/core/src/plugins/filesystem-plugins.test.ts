import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  discoverFilesystemPlugins,
  loadFilesystemPlugin,
  registerFilesystemPlugins,
} from "./filesystem-plugins.js";
import { PluginManager } from "./plugin-manager.js";

// In-memory option store for the manager.
function makeOptionStore() {
  const store = new Map<string, unknown>();
  return {
    getOption: async <T>(key: string, def?: T) =>
      (store.has(key) ? store.get(key) : def) as T,
    updateOption: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  };
}

const root = mkdtempSync(path.join(tmpdir(), "presslyn-plugins-"));

function writePlugin(
  id: string,
  manifest: Record<string, unknown>,
  entrySource: string,
  entryName = "index.mjs"
) {
  const dir = path.join(root, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "plugin.manifest.json"),
    JSON.stringify({ id, name: id, version: "1.0.0", main: entryName, ...manifest })
  );
  writeFileSync(path.join(dir, entryName), entrySource);
  return dir;
}

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("filesystem plugin discovery", () => {
  it("discovers plugin directories with a valid manifest", () => {
    writePlugin("alpha", {}, "export function setup() {}");
    const found = discoverFilesystemPlugins(root);
    expect(found.some((p) => p.manifest.id === "alpha")).toBe(true);
  });

  it("dynamically imports a plugin's setup/teardown exports", async () => {
    writePlugin(
      "beta",
      {},
      "export function setup() {} export function teardown() {}"
    );
    const found = discoverFilesystemPlugins(root).find(
      (p) => p.manifest.id === "beta"
    )!;
    const def = await loadFilesystemPlugin(found);
    expect(def.manifest.id).toBe("beta");
    expect(typeof def.setup).toBe("function");
    expect(typeof def.teardown).toBe("function");
  });

  it("supports a default-export plugin object", async () => {
    writePlugin("gamma", {}, "export default { setup() {} }");
    const found = discoverFilesystemPlugins(root).find(
      (p) => p.manifest.id === "gamma"
    )!;
    const def = await loadFilesystemPlugin(found);
    expect(typeof def.setup).toBe("function");
  });

  it("registers all valid plugins and skips broken ones", async () => {
    // A plugin whose entry module has no setup export — must be skipped.
    writePlugin("broken", {}, "export const nope = 1;");
    const manager = new PluginManager(makeOptionStore());
    const ids = await registerFilesystemPlugins(manager, root);
    expect(ids).toContain("alpha");
    expect(ids).not.toContain("broken");
    const list = await manager.list();
    expect(list.some((p) => p.manifest.id === "alpha")).toBe(true);
  });

  it("returns empty for a non-existent directory", () => {
    expect(discoverFilesystemPlugins(path.join(root, "missing"))).toEqual([]);
  });
});
