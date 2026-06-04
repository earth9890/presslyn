import type { CacheStore } from "./store.js";
import { MemoryStore } from "./store.js";
import { RedisStore } from "./redis-store.js";

/**
 * Transients API — WordPress's `get_transient`/`set_transient` equivalent: a
 * namespaced, TTL'd object cache over a {@link CacheStore}. Use it for
 * expensive computed values (query results, remote fetches) that can safely
 * go stale. `remember` collapses the get-or-compute pattern.
 */
export class Transients {
  constructor(
    private readonly store: CacheStore,
    private readonly namespace = "transient:"
  ) {}

  private key(name: string): string {
    return `${this.namespace}${name}`;
  }

  get<T>(name: string): Promise<T | undefined> {
    return this.store.get<T>(this.key(name));
  }

  set(name: string, value: unknown, ttlSeconds = 0): Promise<void> {
    return this.store.set(this.key(name), value, ttlSeconds);
  }

  delete(name: string): Promise<boolean> {
    return this.store.delete(this.key(name));
  }

  /** Flush every transient in this namespace. */
  flush(): Promise<void> {
    return this.store.flushPrefix(this.namespace);
  }

  /**
   * Return the cached value for `name`, or compute it with `factory`, store it
   * under `ttlSeconds`, and return it. A single in-flight computation is not
   * deduplicated — callers needing that should wrap accordingly.
   */
  async remember<T>(
    name: string,
    ttlSeconds: number,
    factory: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(name);
    if (cached !== undefined) return cached;
    const value = await factory();
    await this.set(name, value, ttlSeconds);
    return value;
  }
}

/**
 * Build a {@link CacheStore} from the environment: a {@link RedisStore} when
 * `REDIS_URL` is set, otherwise an in-memory {@link MemoryStore}.
 */
export function cacheStoreFromEnv(
  env: Record<string, string | undefined> = process.env
): CacheStore {
  if (env.REDIS_URL) {
    return new RedisStore(env.REDIS_URL);
  }
  return new MemoryStore();
}
