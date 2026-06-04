import { describe, it, expect, beforeEach } from "vitest";
import { ThemeManager, type ThemeOptionStore } from "./theme-manager.js";
import { HookSystem } from "../hooks.js";

function fakeStore(initial?: Record<string, unknown>): ThemeOptionStore & {
  data: Map<string, unknown>;
} {
  const data = new Map<string, unknown>(Object.entries(initial ?? {}));
  return {
    data,
    async getOption<T>(key: string, def?: T): Promise<T> {
      return (data.has(key) ? (data.get(key) as T) : (def as T)) ?? (def as T);
    },
    async updateOption(key: string, value: unknown): Promise<void> {
      data.set(key, value);
    },
  };
}

const defaultTheme = {
  id: "presslyn-default",
  name: "Presslyn Default",
  version: "1.0.0",
};

describe("ThemeManager", () => {
  let hooks: HookSystem;

  beforeEach(() => {
    hooks = new HookSystem();
  });

  it("registers and lists themes with active state", async () => {
    const store = fakeStore({ active_theme: "presslyn-default" });
    const mgr = new ThemeManager(store, hooks);
    mgr.register(defaultTheme);
    mgr.register({ id: "twenty", name: "Twenty", version: "1.0.0" });

    const list = await mgr.list();
    expect(list).toHaveLength(2);
    expect(list.find((t) => t.manifest.id === "presslyn-default")?.active).toBe(true);
    expect(list.find((t) => t.manifest.id === "twenty")?.active).toBe(false);
  });

  it("rejects invalid ids and duplicates", () => {
    const mgr = new ThemeManager(fakeStore(), hooks);
    expect(() => mgr.register({ id: "Bad Id", name: "x", version: "1" })).toThrow();
    mgr.register(defaultTheme);
    expect(() => mgr.register(defaultTheme)).toThrow();
  });

  it("activate persists and fires switch_theme with (old, new)", async () => {
    const store = fakeStore({ active_theme: "presslyn-default" });
    const mgr = new ThemeManager(store, hooks);
    mgr.register(defaultTheme);
    mgr.register({ id: "twenty", name: "Twenty", version: "1.0.0" });

    const transitions: Array<[unknown, unknown]> = [];
    hooks.addAction(
      "switch_theme",
      (oldId: unknown, newId: unknown) => {
        transitions.push([oldId, newId]);
      },
      10,
      "t"
    );

    await mgr.activate("twenty");
    expect(store.data.get("active_theme")).toBe("twenty");
    expect(transitions).toEqual([["presslyn-default", "twenty"]]);
    expect((await mgr.getActive())?.id).toBe("twenty");
  });

  it("throws activating an unregistered theme; no-ops when already active", async () => {
    const store = fakeStore({ active_theme: "presslyn-default" });
    const mgr = new ThemeManager(store, hooks);
    mgr.register(defaultTheme);
    await expect(mgr.activate("ghost")).rejects.toThrow();
    await mgr.activate("presslyn-default"); // already active → no throw, no change
    expect(store.data.get("active_theme")).toBe("presslyn-default");
  });
});
