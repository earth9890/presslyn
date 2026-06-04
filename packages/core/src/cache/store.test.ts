import { describe, it, expect } from "vitest";
import { MemoryStore } from "./store.js";
import { Transients, cacheStoreFromEnv } from "./transients.js";
import { RedisStore } from "./redis-store.js";

describe("MemoryStore", () => {
  it("stores and retrieves values (JSON-cloned)", async () => {
    const store = new MemoryStore();
    const obj = { a: 1, b: [2, 3] };
    await store.set("k", obj);
    const got = await store.get<typeof obj>("k");
    expect(got).toEqual(obj);
    expect(got).not.toBe(obj); // cloned, not the same reference
  });

  it("returns undefined for missing keys", async () => {
    const store = new MemoryStore();
    expect(await store.get("nope")).toBeUndefined();
  });

  it("expires values past their TTL using the injected clock", async () => {
    let now = 1000;
    const store = new MemoryStore(() => now);
    await store.set("k", "v", 10); // expires at 1000 + 10_000
    expect(await store.get("k")).toBe("v");
    now = 1000 + 9_000;
    expect(await store.get("k")).toBe("v");
    now = 1000 + 10_001;
    expect(await store.get("k")).toBeUndefined();
  });

  it("never expires when ttl is 0", async () => {
    let now = 0;
    const store = new MemoryStore(() => now);
    await store.set("k", "v", 0);
    now = 10_000_000;
    expect(await store.get("k")).toBe("v");
  });

  it("deletes and flushes by prefix", async () => {
    const store = new MemoryStore();
    await store.set("a:1", 1);
    await store.set("a:2", 2);
    await store.set("b:1", 3);
    expect(await store.delete("a:1")).toBe(true);
    expect(await store.delete("a:1")).toBe(false);
    await store.flushPrefix("a:");
    expect(await store.get("a:2")).toBeUndefined();
    expect(await store.get("b:1")).toBe(3);
  });
});

describe("Transients", () => {
  it("namespaces keys and round-trips", async () => {
    const store = new MemoryStore();
    const t = new Transients(store);
    await t.set("posts", [1, 2, 3], 60);
    expect(await t.get<number[]>("posts")).toEqual([1, 2, 3]);
    // Stored under the namespaced key.
    expect(await store.get("transient:posts")).toEqual([1, 2, 3]);
  });

  it("remember computes once then caches", async () => {
    const store = new MemoryStore();
    const t = new Transients(store);
    let calls = 0;
    const factory = async () => {
      calls++;
      return "computed";
    };
    expect(await t.remember("x", 60, factory)).toBe("computed");
    expect(await t.remember("x", 60, factory)).toBe("computed");
    expect(calls).toBe(1);
  });

  it("flush clears only this namespace", async () => {
    const store = new MemoryStore();
    const t = new Transients(store);
    await t.set("one", 1);
    await store.set("other", 2);
    await t.flush();
    expect(await t.get("one")).toBeUndefined();
    expect(await store.get("other")).toBe(2);
  });
});

describe("cacheStoreFromEnv", () => {
  it("returns a MemoryStore without REDIS_URL", () => {
    expect(cacheStoreFromEnv({})).toBeInstanceOf(MemoryStore);
  });

  it("returns a RedisStore when REDIS_URL is set", () => {
    expect(cacheStoreFromEnv({ REDIS_URL: "redis://localhost:6379" })).toBeInstanceOf(
      RedisStore
    );
  });
});
