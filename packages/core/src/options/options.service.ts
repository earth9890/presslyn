/**
 * Options Service
 *
 * WordPress equivalent: wp-includes/option.php
 * Manages the key-value settings store (site title, permalink structure, etc.)
 */

import { eq } from "drizzle-orm";
import { type Database } from "@presslyn/database";
import { options } from "@presslyn/database";
import { hooks } from "../hooks.js";

export class OptionsService {
  /** In-memory cache for autoloaded options (instance-scoped) */
  private optionsCache: Map<string, unknown> | null = null;

  constructor(private db: Database) {}

  /**
   * Load all autoloaded options into cache.
   * Called once on boot — equivalent to WordPress loading autoload=yes options.
   */
  async loadAutoloadOptions(): Promise<void> {
    const rows = await this.db
      .select()
      .from(options)
      .where(eq(options.autoload, true));

    this.optionsCache = new Map();
    for (const row of rows) {
      try {
        // jsonb columns are already parsed by Drizzle — no JSON.parse needed
        this.optionsCache.set(row.key, row.value ?? null);
      } catch {
        // Corrupt row value — skip rather than crashing the boot sequence
        this.optionsCache.set(row.key, null);
      }
    }
  }

  /**
   * Get an option value.
   * Equivalent to WordPress get_option().
   */
  async getOption<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    // Check cache first
    if (this.optionsCache?.has(key)) {
      const value = this.optionsCache.get(key) as T;
      return hooks.applyFilters(`option_${key}`, value);
    }

    // Fallback to DB query
    const [row] = await this.db
      .select()
      .from(options)
      .where(eq(options.key, key))
      .limit(1);

    if (!row) {
      return (defaultValue ?? null) as T;
    }

    let value: T;
    try {
      // jsonb columns are already parsed by Drizzle — use directly
      value = (row.value != null ? row.value : defaultValue) as T;
    } catch {
      value = (defaultValue ?? null) as T;
    }

    return hooks.applyFilters(`option_${key}`, value);
  }

  /**
   * Update or create an option.
   * Equivalent to WordPress update_option().
   */
  async updateOption(key: string, value: unknown, autoload: boolean = true): Promise<void> {
    // jsonb column — pass value directly, Drizzle handles serialization
    const [existing] = await this.db
      .select({ id: options.id })
      .from(options)
      .where(eq(options.key, key))
      .limit(1);

    if (existing) {
      await this.db
        .update(options)
        .set({ value, autoload })
        .where(eq(options.key, key));
    } else {
      await this.db.insert(options).values({
        key,
        value,
        autoload,
      });
    }

    // Update cache
    if (this.optionsCache) {
      if (autoload) {
        this.optionsCache.set(key, value);
      } else {
        this.optionsCache.delete(key);
      }
    }

    await hooks.doAction("update_option", key, value);
  }

  /**
   * Delete an option.
   * Equivalent to WordPress delete_option().
   */
  async deleteOption(key: string): Promise<boolean> {
    const result = await this.db
      .delete(options)
      .where(eq(options.key, key))
      .returning();

    if (result.length > 0) {
      this.optionsCache?.delete(key);
      await hooks.doAction("delete_option", key);
      return true;
    }
    return false;
  }

  /**
   * Get all options (for settings pages).
   */
  async getAllOptions(): Promise<Record<string, unknown>> {
    const rows = await this.db.select().from(options);
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        // jsonb columns are already parsed by Drizzle — use directly
        result[row.key] = row.value ?? null;
      } catch {
        result[row.key] = null;
      }
    }
    return result;
  }
}
