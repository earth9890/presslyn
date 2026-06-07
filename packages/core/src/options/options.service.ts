/**
 * Options Service
 *
 * WordPress equivalent: wp-includes/option.php
 * Manages the key-value settings store (site title, permalink structure, etc.)
 */

import { and, eq } from "drizzle-orm";
import { type Database } from "@presslyn/database";
import { options, sites } from "@presslyn/database";
import { hooks } from "../hooks.js";

export interface OptionScope {
  siteId?: number;
}

export class OptionsService {
  /** In-memory cache for autoloaded options (instance-scoped) */
  private optionsCache = new Map<number, Map<string, unknown>>();
  private primarySiteId: number | null = null;
  private legacySingleSiteMode = false;

  constructor(private db: Database) {}

  private isMissingMultisiteSchemaError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const causeMessage =
      error instanceof Error && error.cause
        ? error.cause instanceof Error
          ? error.cause.message
          : String(error.cause)
        : "";
    const text = `${message}\n${causeMessage}`;
    return (
      text.includes('relation "sites" does not exist') ||
      text.includes('column "site_id" does not exist')
    );
  }

  private async getPrimarySiteId(): Promise<number> {
    if (this.legacySingleSiteMode) {
      return 1;
    }

    if (this.primarySiteId !== null) {
      return this.primarySiteId;
    }

    let primary;
    try {
      [primary] = await this.db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.isPrimary, true))
        .limit(1);
    } catch (error) {
      if (this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        return 1;
      }
      throw error;
    }

    if (!primary) {
      throw new Error("Primary site is not configured");
    }

    this.primarySiteId = primary.id;
    return primary.id;
  }

  private async resolveSiteId(scope?: OptionScope): Promise<number> {
    if (scope?.siteId !== undefined) {
      return scope.siteId;
    }

    return this.getPrimarySiteId();
  }

  private selectLegacyOptions() {
    return this.db.select({
      id: options.id,
      key: options.key,
      value: options.value,
      autoload: options.autoload,
    });
  }

  /**
   * Load all autoloaded options into cache.
   * Called once on boot — equivalent to WordPress loading autoload=yes options.
   */
  async loadAutoloadOptions(scope?: OptionScope): Promise<void> {
    const siteId = await this.resolveSiteId(scope);
    let rows;
    try {
      rows = this.legacySingleSiteMode
        ? await this.selectLegacyOptions().from(options).where(eq(options.autoload, true))
        : await this.db
            .select()
            .from(options)
            .where(and(eq(options.autoload, true), eq(options.siteId, siteId)));
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        rows = await this.selectLegacyOptions().from(options).where(eq(options.autoload, true));
      } else {
        throw error;
      }
    }

    const scopedCache = new Map<string, unknown>();
    for (const row of rows) {
      try {
        // jsonb columns are already parsed by Drizzle — no JSON.parse needed
        scopedCache.set(row.key, row.value ?? null);
      } catch {
        // Corrupt row value — skip rather than crashing the boot sequence
        scopedCache.set(row.key, null);
      }
    }

    this.optionsCache.set(siteId, scopedCache);
  }

  /**
   * Get an option value.
   * Equivalent to WordPress get_option().
   */
  async getOption<T = unknown>(
    key: string,
    defaultValue?: T,
    scope?: OptionScope
  ): Promise<T> {
    const siteId = await this.resolveSiteId(scope);

    // Check cache first
    const scopedCache = this.optionsCache.get(siteId);
    if (scopedCache?.has(key)) {
      const value = scopedCache.get(key) as T;
      return hooks.applyFilters(`option_${key}`, value);
    }

    // Fallback to DB query
    let row;
    try {
      [row] = this.legacySingleSiteMode
        ? await this.selectLegacyOptions().from(options).where(eq(options.key, key)).limit(1)
        : await this.db
            .select()
            .from(options)
            .where(and(eq(options.key, key), eq(options.siteId, siteId)))
            .limit(1);
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        [row] = await this.selectLegacyOptions().from(options).where(eq(options.key, key)).limit(1);
      } else {
        throw error;
      }
    }

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
  async updateOption(
    key: string,
    value: unknown,
    autoload: boolean = true,
    scope?: OptionScope
  ): Promise<void> {
    const siteId = await this.resolveSiteId(scope);
    // jsonb column — pass value directly, Drizzle handles serialization
    let existing;
    try {
      [existing] = this.legacySingleSiteMode
        ? await this.db
            .select({ id: options.id })
            .from(options)
            .where(eq(options.key, key))
            .limit(1)
        : await this.db
            .select({ id: options.id })
            .from(options)
            .where(and(eq(options.key, key), eq(options.siteId, siteId)))
            .limit(1);
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        [existing] = await this.db
          .select({ id: options.id })
          .from(options)
          .where(eq(options.key, key))
          .limit(1);
      } else {
        throw error;
      }
    }

    if (existing) {
      await this.db
        .update(options)
        .set({ value, autoload })
        .where(
          this.legacySingleSiteMode
            ? eq(options.key, key)
            : and(eq(options.key, key), eq(options.siteId, siteId))
        );
    } else {
      await this.db.insert(options).values(
        this.legacySingleSiteMode
          ? ({ key, value, autoload } as never)
          : ({ siteId, key, value, autoload } as never)
      );
    }

    // Update cache
    const scopedCache = this.optionsCache.get(siteId);
    if (scopedCache) {
      if (autoload) {
        scopedCache.set(key, value);
      } else {
        scopedCache.delete(key);
      }
    }

    await hooks.doAction("update_option", key, value);
  }

  /**
   * Delete an option.
   * Equivalent to WordPress delete_option().
   */
  async deleteOption(key: string, scope?: OptionScope): Promise<boolean> {
    const siteId = await this.resolveSiteId(scope);
    const result = await this.db
      .delete(options)
      .where(
        this.legacySingleSiteMode
          ? eq(options.key, key)
          : and(eq(options.key, key), eq(options.siteId, siteId))
      )
      .returning();

    if (result.length > 0) {
      this.optionsCache.get(siteId)?.delete(key);
      await hooks.doAction("delete_option", key);
      return true;
    }
    return false;
  }

  /**
   * Get all options (for settings pages).
   */
  async getAllOptions(scope?: OptionScope): Promise<Record<string, unknown>> {
    const siteId = await this.resolveSiteId(scope);
    let rows;
    try {
      rows = this.legacySingleSiteMode
        ? await this.selectLegacyOptions().from(options)
        : await this.db.select().from(options).where(eq(options.siteId, siteId));
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        rows = await this.selectLegacyOptions().from(options);
      } else {
        throw error;
      }
    }
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
