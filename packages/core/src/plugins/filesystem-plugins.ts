/**
 * Filesystem plugin discovery + dynamic import.
 *
 * Mirrors the theme filesystem loader: each plugin lives in a directory under
 * `content/plugins/<id>/` with a `plugin.manifest.json` and an entry module
 * (the manifest `main`, defaulting to `index.js`/`index.mjs`). The entry module
 * exports `setup` (and optional `teardown`) — either as named exports or on a
 * default export — which are wired into the PluginManager.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ValidationError } from "../errors.js";
import {
  PluginManifestSchema,
  type PluginManifest,
  type PluginDefinition,
} from "./types.js";
import type { PluginManager } from "./plugin-manager.js";

export const PLUGIN_MANIFEST_FILENAME = "plugin.manifest.json";
const DEFAULT_ENTRIES = ["index.js", "index.mjs", "index.cjs"];

export interface FilesystemPlugin {
  manifest: PluginManifest;
  directory: string;
}

/** Resolve the conventional plugins directory, checking common roots. */
export function resolvePluginsDirectory(cwd: string = process.cwd()): string {
  const candidates = [
    path.resolve(cwd, "content/plugins"),
    path.resolve(cwd, "../../content/plugins"),
  ];
  const existing = candidates.find((candidate) => existsSync(candidate));
  return existing ?? candidates[0]!;
}

/** Read and validate a plugin manifest from a plugin directory. */
export function readPluginManifestFromDirectory(
  pluginDir: string
): PluginManifest {
  const manifestPath = path.join(pluginDir, PLUGIN_MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) {
    throw new ValidationError(`Plugin manifest not found at "${manifestPath}"`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new ValidationError(
      `Invalid plugin manifest JSON at "${manifestPath}": ${(error as Error).message}`
    );
  }

  return PluginManifestSchema.parse(parsed);
}

/** Discover plugin directories (manifest only — no module loading yet). */
export function discoverFilesystemPlugins(
  pluginsDir: string
): FilesystemPlugin[] {
  if (!existsSync(pluginsDir)) return [];

  return readdirSync(pluginsDir)
    .map((entry) => path.join(pluginsDir, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((directory) => ({
      directory,
      manifest: readPluginManifestFromDirectory(directory),
    }));
}

/** Resolve the entry module path for a filesystem plugin. */
function resolveEntryPath(fsPlugin: FilesystemPlugin): string {
  if (fsPlugin.manifest.main) {
    const explicit = path.resolve(fsPlugin.directory, fsPlugin.manifest.main);
    if (!existsSync(explicit)) {
      throw new ValidationError(
        `Plugin "${fsPlugin.manifest.id}" entry "${fsPlugin.manifest.main}" not found`
      );
    }
    return explicit;
  }
  for (const candidate of DEFAULT_ENTRIES) {
    const full = path.join(fsPlugin.directory, candidate);
    if (existsSync(full)) return full;
  }
  throw new ValidationError(
    `Plugin "${fsPlugin.manifest.id}" has no entry module (looked for ${DEFAULT_ENTRIES.join(", ")})`
  );
}

/**
 * Dynamically import a filesystem plugin's entry module and build a
 * PluginDefinition. The module may export `setup`/`teardown` as named exports
 * or via a default object. Throws if no `setup` function is found.
 */
export async function loadFilesystemPlugin(
  fsPlugin: FilesystemPlugin
): Promise<PluginDefinition> {
  const entryPath = resolveEntryPath(fsPlugin);
  const mod = (await import(pathToFileURL(entryPath).href)) as Record<
    string,
    unknown
  >;

  const source =
    typeof mod.setup === "function"
      ? mod
      : mod.default && typeof mod.default === "object"
        ? (mod.default as Record<string, unknown>)
        : null;

  if (!source || typeof source.setup !== "function") {
    throw new ValidationError(
      `Plugin "${fsPlugin.manifest.id}" entry module must export a "setup" function`
    );
  }

  return {
    manifest: fsPlugin.manifest,
    setup: source.setup as PluginDefinition["setup"],
    teardown:
      typeof source.teardown === "function"
        ? (source.teardown as PluginDefinition["teardown"])
        : undefined,
  };
}

/**
 * Discover, import, and register every filesystem plugin into the manager.
 * Bad plugins (missing manifest/entry, invalid module) are skipped with a
 * warning so one broken plugin can't take down the whole install. Returns the
 * ids that were successfully registered.
 */
export async function registerFilesystemPlugins(
  manager: PluginManager,
  pluginsDir: string = resolvePluginsDirectory()
): Promise<string[]> {
  let discovered: FilesystemPlugin[];
  try {
    discovered = discoverFilesystemPlugins(pluginsDir);
  } catch (error) {
    console.warn(`Failed to scan plugins directory "${pluginsDir}":`, error);
    return [];
  }

  const registered: string[] = [];
  for (const fsPlugin of discovered) {
    try {
      const definition = await loadFilesystemPlugin(fsPlugin);
      manager.register(definition);
      registered.push(definition.manifest.id);
    } catch (error) {
      console.warn(
        `Skipping filesystem plugin "${fsPlugin.directory}":`,
        error
      );
    }
  }
  return registered;
}
