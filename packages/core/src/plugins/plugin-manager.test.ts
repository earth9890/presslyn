import { describe, it, expect, beforeEach } from "vitest";
import { PluginManager } from "./plugin-manager.js";
import type { PluginOptionStore, PluginDefinition } from "./types.js";
import { HookSystem } from "../hooks.js";

/** In-memory option store satisfying the manager's narrow interface. */
function fakeStore(): PluginOptionStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
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

function makePlugin(id: string, log: string[]): PluginDefinition {
  return {
    manifest: { id, name: `Plugin ${id}`, version: "1.0.0" },
    setup: () => {
      log.push(`setup:${id}`);
    },
    teardown: () => {
      log.push(`teardown:${id}`);
    },
  };
}

describe("PluginManager", () => {
  let store: ReturnType<typeof fakeStore>;
  let hooks: HookSystem;
  let manager: PluginManager;
  let log: string[];

  beforeEach(() => {
    store = fakeStore();
    hooks = new HookSystem();
    manager = new PluginManager(store, hooks);
    log = [];
  });

  it("registers and lists plugins as inactive by default", async () => {
    manager.register(makePlugin("hello", log));
    const list = await manager.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      manifest: { id: "hello", name: "Plugin hello" },
      active: false,
    });
  });

  it("rejects an invalid manifest id", () => {
    expect(() =>
      manager.register({
        manifest: { id: "Bad ID", name: "x", version: "1" },
        setup: () => {},
      })
    ).toThrow();
  });

  it("rejects duplicate registration", () => {
    manager.register(makePlugin("dup", log));
    expect(() => manager.register(makePlugin("dup", log))).toThrow();
  });

  it("activates: runs setup, persists, and fires activate_plugin", async () => {
    let fired: string | null = null;
    hooks.addAction("activate_plugin", (id: string) => {
      fired = id;
    }, 10, "t");
    manager.register(makePlugin("hello", log));

    await manager.activate("hello");

    expect(log).toContain("setup:hello");
    expect(await manager.isActive("hello")).toBe(true);
    expect(store.data.get("active_plugins")).toEqual(["hello"]);
    expect(fired).toBe("hello");
  });

  it("activation is idempotent (no double setup)", async () => {
    manager.register(makePlugin("hello", log));
    await manager.activate("hello");
    await manager.activate("hello");
    expect(log.filter((l) => l === "setup:hello")).toHaveLength(1);
  });

  it("throws when activating an unregistered plugin", async () => {
    await expect(manager.activate("ghost")).rejects.toThrow();
  });

  it("deactivates: runs teardown and drops the id", async () => {
    manager.register(makePlugin("hello", log));
    await manager.activate("hello");
    await manager.deactivate("hello");
    expect(log).toContain("teardown:hello");
    expect(await manager.isActive("hello")).toBe(false);
    expect(store.data.get("active_plugins")).toEqual([]);
  });

  it("bootActivePlugins runs setup for active registered plugins once", async () => {
    // Simulate a fresh process where active_plugins is already persisted.
    store.data.set("active_plugins", ["hello"]);
    manager.register(makePlugin("hello", log));

    await manager.bootActivePlugins();
    await manager.bootActivePlugins();

    expect(log.filter((l) => l === "setup:hello")).toHaveLength(1);
  });

  it("a plugin's setup can register a working hook", async () => {
    manager.register({
      manifest: { id: "filterer", name: "Filterer", version: "1.0.0" },
      setup: (ctx) => {
        ctx.hooks.addFilter(
          "the_title",
          (title: string) => `★ ${title}`,
          10,
          "filterer:title"
        );
      },
      teardown: (ctx) => {
        ctx.hooks.removeFilter("the_title", "filterer:title");
      },
    });

    await manager.activate("filterer");
    expect(await hooks.applyFilters("the_title", "Hello")).toBe("★ Hello");

    await manager.deactivate("filterer");
    expect(await hooks.applyFilters("the_title", "Hello")).toBe("Hello");
  });
});
