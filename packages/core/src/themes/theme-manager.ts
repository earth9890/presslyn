/**
 * Theme registry + activation. Themes are registered in-process (bundled
 * themes call `register()` with a manifest); the active theme id is persisted
 * in the `active_theme` option. The actual block-template rendering engine
 * (theme.json, template hierarchy) is layered on top of this registry.
 */

import { z } from "zod";
import { hooks as globalHooks, type HookSystem } from "../hooks.js";
import { NotFoundError, ValidationError } from "../errors.js";

const ACTIVE_THEME_OPTION = "active_theme";

export const ThemeManifestSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "id must be kebab-case"),
    name: z.string().min(1).max(200),
    version: z.string().min(1).max(50),
    description: z.string().max(2000).optional(),
    author: z.string().max(200).optional(),
    screenshot: z.string().max(2000).optional(),
  })
  .strict();

export type ThemeManifest = z.infer<typeof ThemeManifestSchema>;

export interface ThemeInfo {
  manifest: ThemeManifest;
  active: boolean;
}

/** Minimal option-store shape (OptionsService satisfies it). */
export interface ThemeOptionStore {
  getOption<T = unknown>(key: string, defaultValue?: T): Promise<T>;
  updateOption(key: string, value: unknown): Promise<void>;
}

export class ThemeManager {
  private readonly registry = new Map<string, ThemeManifest>();

  constructor(
    private readonly options: ThemeOptionStore,
    private readonly hooks: HookSystem = globalHooks
  ) {}

  /** Register a theme. Validates the manifest; rejects duplicate ids. */
  register(manifest: ThemeManifest): void {
    const parsed = ThemeManifestSchema.parse(manifest);
    if (this.registry.has(parsed.id)) {
      throw new ValidationError(`Theme "${parsed.id}" is already registered`);
    }
    this.registry.set(parsed.id, parsed);
  }

  isRegistered(id: string): boolean {
    return this.registry.has(id);
  }

  /** The active theme id (from the option), or null if unset. */
  async getActiveId(): Promise<string | null> {
    const id = await this.options.getOption<string | null>(
      ACTIVE_THEME_OPTION,
      null
    );
    return typeof id === "string" && id.length > 0 ? id : null;
  }

  /** The active theme's manifest, or undefined if unset/unregistered. */
  async getActive(): Promise<ThemeManifest | undefined> {
    const id = await this.getActiveId();
    return id ? this.registry.get(id) : undefined;
  }

  /** List every registered theme with its active state. */
  async list(): Promise<ThemeInfo[]> {
    const activeId = await this.getActiveId();
    return [...this.registry.values()].map((manifest) => ({
      manifest,
      active: manifest.id === activeId,
    }));
  }

  /**
   * Activate a theme: persist the id and fire `switch_theme` (old, new).
   * Throws if the theme is not registered. No-op if already active.
   */
  async activate(id: string): Promise<void> {
    if (!this.registry.has(id)) throw new NotFoundError("Theme", id);
    const previous = await this.getActiveId();
    if (previous === id) return;
    await this.options.updateOption(ACTIVE_THEME_OPTION, id);
    await this.hooks.doAction("switch_theme", previous, id);
  }
}
