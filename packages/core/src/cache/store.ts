/**
 * Async persistent cache store abstraction. Unlike the per-request in-memory
 * {@link CacheService}, a `CacheStore` can be backed by Redis so the object
 * cache is shared across processes and survives restarts. Values are stored
 * as JSON; `ttlSeconds <= 0` means no expiry.
 */

export interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  /** Remove all keys under a prefix (namespace flush). */
  flushPrefix(prefix: string): Promise<void>;
}

interface MemoryEntry {
  value: unknown;
  expiresAt: number; // epoch ms; 0 = never
}

/**
 * In-memory {@link CacheStore} — the default when Redis is not configured and
 * the backing store for tests. Accepts an injectable clock for deterministic
 * expiry testing.
 */
export class MemoryStore implements CacheStore {
  private readonly map = new Map<string, MemoryEntry>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== 0 && entry.expiresAt <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Clone via JSON to mirror serialize/deserialize semantics of Redis.
    return JSON.parse(JSON.stringify(entry.value)) as T;
  }

  async set(key: string, value: unknown, ttlSeconds = 0): Promise<void> {
    this.map.set(key, {
      value,
      expiresAt: ttlSeconds > 0 ? this.now() + ttlSeconds * 1000 : 0,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.map.delete(key);
  }

  async flushPrefix(prefix: string): Promise<void> {
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) this.map.delete(key);
    }
  }
}
