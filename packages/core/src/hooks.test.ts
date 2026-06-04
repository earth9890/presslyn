import { describe, it, expect, beforeEach } from "vitest";
import { HookSystem } from "./hooks.js";

describe("HookSystem", () => {
  let hooks: HookSystem;

  beforeEach(() => {
    hooks = new HookSystem();
  });

  describe("Actions", () => {
    it("should execute an action callback", async () => {
      const calls: string[] = [];
      hooks.addAction("init", () => calls.push("called"));
      await hooks.doAction("init");
      expect(calls).toEqual(["called"]);
    });

    it("should execute actions in priority order", async () => {
      const order: number[] = [];
      hooks.addAction("init", () => order.push(2), 20);
      hooks.addAction("init", () => order.push(1), 10);
      hooks.addAction("init", () => order.push(3), 30);
      await hooks.doAction("init");
      expect(order).toEqual([1, 2, 3]);
    });

    it("should pass arguments to action callbacks", async () => {
      let received: unknown[] = [];
      hooks.addAction("save_post", (...args) => {
        received = args;
      });
      await hooks.doAction("save_post", 1, "hello");
      expect(received).toEqual([1, "hello"]);
    });

    it("should handle async action callbacks", async () => {
      const calls: string[] = [];
      hooks.addAction("init", async () => {
        await new Promise((r) => setTimeout(r, 10));
        calls.push("async");
      });
      await hooks.doAction("init");
      expect(calls).toEqual(["async"]);
    });

    it("should do nothing for non-existent action", async () => {
      await hooks.doAction("nonexistent");
    });

    it("should remove an action by id", () => {
      hooks.addAction("init", () => {}, 10, "my-action");
      expect(hooks.hasAction("init")).toBe(true);
      hooks.removeAction("init", "my-action");
      expect(hooks.hasAction("init")).toBe(false);
    });
  });

  describe("Filters", () => {
    it("should apply a filter to a value", async () => {
      hooks.addFilter<string>("the_title", (title) => title.toUpperCase());
      const result = await hooks.applyFilters("the_title", "hello world");
      expect(result).toBe("HELLO WORLD");
    });

    it("should chain filters in priority order", async () => {
      hooks.addFilter<string>("the_content", (v) => v + " [filtered]", 20);
      hooks.addFilter<string>("the_content", (v) => `<p>${v}</p>`, 10);
      const result = await hooks.applyFilters("the_content", "Hello");
      expect(result).toBe("<p>Hello</p> [filtered]");
    });

    it("should return original value if no filters", async () => {
      const result = await hooks.applyFilters("no_filter", "original");
      expect(result).toBe("original");
    });

    it("should handle async filters", async () => {
      hooks.addFilter<number>("price", async (price) => {
        await new Promise((r) => setTimeout(r, 10));
        return price * 1.1;
      });
      const result = await hooks.applyFilters("price", 100);
      expect(result).toBeCloseTo(110);
    });

    it("should remove a filter by id", () => {
      hooks.addFilter("the_title", (v) => v, 10, "my-filter");
      expect(hooks.hasFilter("the_title")).toBe(true);
      hooks.removeFilter("the_title", "my-filter");
      expect(hooks.hasFilter("the_title")).toBe(false);
    });
  });

  describe("Utilities", () => {
    it("should remove all hooks for a specific name", () => {
      hooks.addAction("init", () => {});
      hooks.addFilter("init", (v) => v);
      hooks.removeAll("init");
      expect(hooks.hasAction("init")).toBe(false);
      expect(hooks.hasFilter("init")).toBe(false);
    });

    it("should remove all hooks globally", () => {
      hooks.addAction("a", () => {});
      hooks.addAction("b", () => {});
      hooks.removeAll();
      expect(hooks.hasAction("a")).toBe(false);
      expect(hooks.hasAction("b")).toBe(false);
    });

    it("should count registered hooks", () => {
      hooks.addAction("init", () => {});
      hooks.addAction("init", () => {});
      expect(hooks.getActionCount("init")).toBe(2);
      expect(hooks.getFilterCount("init")).toBe(0);
    });
  });
});
