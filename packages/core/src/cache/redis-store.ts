import type { CacheStore } from "./store.js";

/**
 * Redis-backed {@link CacheStore}. ioredis is imported lazily so the
 * dependency is only loaded when Redis is actually configured (the in-memory
 * default and tests never touch it). Values are JSON-serialized; TTL uses
 * Redis key expiry.
 */
export class RedisStore implements CacheStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clientPromise: Promise<any> | null = null;

  constructor(
    private readonly url: string,
    private readonly keyPrefix = "presslyn:"
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async client(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = import("ioredis").then(
        (mod) => new mod.default(this.url, { keyPrefix: this.keyPrefix })
      );
    }
    return this.clientPromise;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const redis = await this.client();
    const raw = await redis.get(key);
    if (raw === null || raw === undefined) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 0): Promise<void> {
    const redis = await this.client();
    const payload = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await redis.set(key, payload, "EX", ttlSeconds);
    } else {
      await redis.set(key, payload);
    }
  }

  async delete(key: string): Promise<boolean> {
    const redis = await this.client();
    const removed = await redis.del(key);
    return removed > 0;
  }

  async flushPrefix(prefix: string): Promise<void> {
    const redis = await this.client();
    // SCAN avoids blocking Redis on large keyspaces. The configured keyPrefix
    // is applied by ioredis transparently except for SCAN, so match against
    // the full prefixed pattern and strip it before deleting.
    const pattern = `${this.keyPrefix}${prefix}*`;
    let cursor = "0";
    do {
      const [next, keys] = (await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      )) as [string, string[]];
      cursor = next;
      if (keys.length > 0) {
        // Strip the keyPrefix that ioredis re-adds on del().
        const unprefixed = keys.map((k) => k.slice(this.keyPrefix.length));
        await redis.del(...unprefixed);
      }
    } while (cursor !== "0");
  }
}
