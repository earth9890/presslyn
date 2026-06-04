import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CacheService } from "./cache.service.js";

describe("CacheService", () => {
  let cache: CacheService;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new CacheService();
  });

  afterEach(() => {
    cache.stopEviction();
    vi.useRealTimers();
  });

  // ─── get / set ───────────────────────────────────────────

  describe("get / set", () => {
    it("stores and retrieves a value", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("overwrites an existing value", () => {
      cache.set("key1", "first");
      cache.set("key1", "second");
      expect(cache.get("key1")).toBe("second");
    });

    it("returns undefined for a missing key", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("stores various types (number, object, array, null)", () => {
      cache.set("num", 42);
      cache.set("obj", { a: 1 });
      cache.set("arr", [1, 2, 3]);
      cache.set("nil", null);

      expect(cache.get("num")).toBe(42);
      expect(cache.get("obj")).toEqual({ a: 1 });
      expect(cache.get("arr")).toEqual([1, 2, 3]);
      expect(cache.get("nil")).toBeNull();
    });
  });

  // ─── groups ──────────────────────────────────────────────

  describe("groups", () => {
    it("isolates same key in different groups", () => {
      cache.set("id", "user-1", "users");
      cache.set("id", "post-1", "posts");

      expect(cache.get("id", "users")).toBe("user-1");
      expect(cache.get("id", "posts")).toBe("post-1");
    });

    it("defaults to 'default' group", () => {
      cache.set("key", "val");
      expect(cache.get("key", "default")).toBe("val");
    });
  });

  // ─── TTL ─────────────────────────────────────────────────

  describe("TTL", () => {
    it("returns the value before expiry", () => {
      cache.set("key", "val", "default", 10); // 10 seconds TTL
      vi.advanceTimersByTime(5_000); // 5 seconds
      expect(cache.get("key")).toBe("val");
    });

    it("returns undefined after expiry", () => {
      cache.set("key", "val", "default", 10); // 10 seconds TTL
      vi.advanceTimersByTime(11_000); // 11 seconds
      expect(cache.get("key")).toBeUndefined();
    });

    it("does not expire entries with no TTL", () => {
      cache.set("key", "val"); // no TTL
      vi.advanceTimersByTime(999_999_999);
      expect(cache.get("key")).toBe("val");
    });
  });

  // ─── delete ──────────────────────────────────────────────

  describe("delete", () => {
    it("returns true when deleting an existing key", () => {
      cache.set("key", "val");
      expect(cache.delete("key")).toBe(true);
      expect(cache.get("key")).toBeUndefined();
    });

    it("returns false when deleting a non-existent key", () => {
      expect(cache.delete("nope")).toBe(false);
    });

    it("deletes from the correct group", () => {
      cache.set("key", "a", "g1");
      cache.set("key", "b", "g2");
      cache.delete("key", "g1");
      expect(cache.get("key", "g1")).toBeUndefined();
      expect(cache.get("key", "g2")).toBe("b");
    });
  });

  // ─── has ─────────────────────────────────────────────────

  describe("has", () => {
    it("returns true for an existing key", () => {
      cache.set("key", "val");
      expect(cache.has("key")).toBe(true);
    });

    it("returns false for a missing key", () => {
      expect(cache.has("missing")).toBe(false);
    });

    it("returns false for an expired key", () => {
      cache.set("key", "val", "default", 1);
      vi.advanceTimersByTime(2_000);
      expect(cache.has("key")).toBe(false);
    });
  });

  // ─── flushGroup ──────────────────────────────────────────

  describe("flushGroup", () => {
    it("clears only the specified group", () => {
      cache.set("a", 1, "users");
      cache.set("b", 2, "users");
      cache.set("c", 3, "posts");

      cache.flushGroup("users");

      expect(cache.get("a", "users")).toBeUndefined();
      expect(cache.get("b", "users")).toBeUndefined();
      expect(cache.get("c", "posts")).toBe(3);
    });
  });

  // ─── flush ───────────────────────────────────────────────

  describe("flush", () => {
    it("clears everything", () => {
      cache.set("a", 1, "g1");
      cache.set("b", 2, "g2");
      cache.set("c", 3);

      cache.flush();

      expect(cache.get("a", "g1")).toBeUndefined();
      expect(cache.get("b", "g2")).toBeUndefined();
      expect(cache.get("c")).toBeUndefined();
      expect(cache.stats().size).toBe(0);
    });
  });

  // ─── maxSize + LRU eviction ──────────────────────────────

  describe("maxSize + LRU eviction", () => {
    it("evicts the oldest entry when max size is reached", () => {
      const small = new CacheService(3);

      small.set("first", 1);
      vi.advanceTimersByTime(1);
      small.set("second", 2);
      vi.advanceTimersByTime(1);
      small.set("third", 3);
      vi.advanceTimersByTime(1);

      // Cache is full (3 items). Adding a 4th should evict "first" (oldest).
      small.set("fourth", 4);

      expect(small.get("first")).toBeUndefined();
      expect(small.get("second")).toBe(2);
      expect(small.get("third")).toBe(3);
      expect(small.get("fourth")).toBe(4);
    });

    it("evicts the least-recently-accessed entry (not just oldest inserted)", () => {
      const small = new CacheService(3);

      small.set("a", 1);
      vi.advanceTimersByTime(1);
      small.set("b", 2);
      vi.advanceTimersByTime(1);
      small.set("c", 3);
      vi.advanceTimersByTime(1);

      // Access "a" to make it recently used
      small.get("a");
      vi.advanceTimersByTime(1);

      // Now "b" is the least recently accessed, so it should be evicted
      small.set("d", 4);

      expect(small.get("a")).toBe(1);
      expect(small.get("b")).toBeUndefined();
      expect(small.get("c")).toBe(3);
      expect(small.get("d")).toBe(4);
    });
  });

  // ─── evictExpired ────────────────────────────────────────

  describe("evictExpired", () => {
    it("removes all expired entries", () => {
      cache.set("short", "val", "default", 1); // 1s TTL
      cache.set("long", "val", "default", 60); // 60s TTL
      cache.set("forever", "val"); // no TTL

      vi.advanceTimersByTime(2_000); // 2 seconds — "short" is expired

      const evicted = cache.evictExpired();
      expect(evicted).toBe(1);
      expect(cache.get("short")).toBeUndefined();
      expect(cache.get("long")).toBe("val");
      expect(cache.get("forever")).toBe("val");
    });

    it("returns 0 when nothing is expired", () => {
      cache.set("a", 1);
      cache.set("b", 2, "default", 60);
      expect(cache.evictExpired()).toBe(0);
    });
  });

  // ─── stats ───────────────────────────────────────────────

  describe("stats", () => {
    it("returns correct size", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      expect(cache.stats().size).toBe(2);
    });

    it("returns correct maxSize", () => {
      const small = new CacheService(50);
      expect(small.stats().maxSize).toBe(50);
    });

    it("returns correct groups", () => {
      cache.set("a", 1, "users");
      cache.set("b", 2, "posts");
      cache.set("c", 3, "users");

      const groups = cache.stats().groups.sort();
      expect(groups).toEqual(["posts", "users"]);
    });

    it("returns default maxSize of 10000", () => {
      expect(cache.stats().maxSize).toBe(10_000);
    });
  });

  // ─── startEviction / stopEviction ────────────────────────

  describe("startEviction / stopEviction", () => {
    it("starts a periodic eviction timer", () => {
      cache.set("short", "val", "default", 30); // 30s TTL

      cache.startEviction();

      // Advance past the TTL but not past the eviction interval
      vi.advanceTimersByTime(31_000);
      // The entry is expired but eviction interval hasn't fired yet
      // (get will lazily detect it, but let's check the timer fires)

      // Reset the entry
      cache.set("short2", "val", "default", 30);
      vi.advanceTimersByTime(31_000); // now 62s total, eviction interval is 60s

      // The eviction timer should have fired at 60s mark, clearing expired entries
      expect(cache.stats().size).toBeLessThanOrEqual(1);

      cache.stopEviction();
    });

    it("stopEviction clears the timer", () => {
      cache.startEviction();
      cache.stopEviction();

      // Set an entry with short TTL
      cache.set("key", "val", "default", 1);
      vi.advanceTimersByTime(120_000); // well past eviction interval

      // The entry should still be in the store (not evicted by timer)
      // but get() will lazily detect expiry
      expect(cache.stats().size).toBe(1); // still in store, no timer cleaned it
    });

    it("calling startEviction twice is a no-op", () => {
      cache.startEviction();
      cache.startEviction(); // should not create a second timer
      cache.stopEviction();
      // No error thrown
    });
  });
});
