/**
 * Cache Service
 *
 * WordPress equivalent: wp-includes/cache.php + class-wp-object-cache.php
 * In-memory object cache with groups, TTL, max size, and periodic eviction.
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number | null; // null = no expiry
  lastAccessed: number;
}

const DEFAULT_MAX_SIZE = 10_000;
const EVICTION_INTERVAL_MS = 60_000; // 1 minute

export class CacheService {
  private store: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
  }

  private makeKey(key: string, group: string): string {
    return `${group}:${key}`;
  }

  get<T = unknown>(key: string, group: string = "default"): T | undefined {
    const compositeKey = this.makeKey(key, group);
    const entry = this.store.get(compositeKey);
    if (!entry) return undefined;

    // Check TTL expiry
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(compositeKey);
      return undefined;
    }

    entry.lastAccessed = Date.now();
    return entry.value as T;
  }

  set(key: string, value: unknown, group: string = "default", ttlSeconds: number = 0): void {
    // Enforce max size — evict least-recently-accessed entries
    if (this.store.size >= this.maxSize) {
      this.evictLRU();
    }

    this.store.set(this.makeKey(key, group), {
      value,
      expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
      lastAccessed: Date.now(),
    });
  }

  delete(key: string, group: string = "default"): boolean {
    return this.store.delete(this.makeKey(key, group));
  }

  has(key: string, group: string = "default"): boolean {
    return this.get(key, group) !== undefined;
  }

  flushGroup(group: string): void {
    const prefix = `${group}:`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  flush(): void {
    this.store.clear();
  }

  /**
   * Remove all expired entries.
   * Called periodically when the eviction timer is running, or manually.
   */
  evictExpired(): number {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
        evicted++;
      }
    }
    return evicted;
  }

  /**
   * Start periodic eviction of expired entries.
   */
  startEviction(): void {
    if (this.evictionTimer) return;
    this.evictionTimer = setInterval(() => {
      this.evictExpired();
    }, EVICTION_INTERVAL_MS);
    // Allow Node.js to exit even if this timer is running
    if (this.evictionTimer.unref) {
      this.evictionTimer.unref();
    }
  }

  /**
   * Stop periodic eviction.
   */
  stopEviction(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
  }

  stats(): { size: number; maxSize: number; groups: string[] } {
    const groups = new Set<string>();
    for (const key of this.store.keys()) {
      const colonIndex = key.indexOf(":");
      if (colonIndex > 0) {
        groups.add(key.substring(0, colonIndex));
      }
    }
    return { size: this.store.size, maxSize: this.maxSize, groups: Array.from(groups) };
  }

  /**
   * Evict the least-recently-accessed entry to make room.
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }
}

/** Global cache instance */
export const cache = new CacheService();
