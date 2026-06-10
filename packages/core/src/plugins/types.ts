import { z } from "zod";
import type { HookSystem } from "../hooks.js";

/**
 * Plugin manifest — the package.json-style metadata that identifies a plugin.
 * `id` is the stable activation key (stored in the `active_plugins` option).
 */
export const PluginManifestSchema = z
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
    /** Entry module (relative to the plugin dir) for filesystem plugins. */
    main: z.string().max(200).optional(),
  })
  .strict();

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/**
 * Context handed to a plugin's setup/teardown. Plugins register their
 * actions/filters on `hooks` — and should use explicit hook ids so teardown
 * can remove them cleanly on deactivation.
 */
export interface PluginContext {
  hooks: HookSystem;
}

export interface PluginDefinition {
  manifest: PluginManifest;
  /** Run on activation (and on boot for already-active plugins). */
  setup: (ctx: PluginContext) => void | Promise<void>;
  /** Run on deactivation. Should remove anything `setup` registered. */
  teardown?: (ctx: PluginContext) => void | Promise<void>;
}

export interface PluginInfo {
  manifest: PluginManifest;
  active: boolean;
}

/** Minimal option-store shape the manager needs (OptionsService satisfies it). */
export interface PluginOptionStore {
  getOption<T = unknown>(key: string, defaultValue?: T): Promise<T>;
  updateOption(key: string, value: unknown): Promise<void>;
}
