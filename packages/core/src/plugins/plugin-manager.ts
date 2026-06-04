import { hooks as globalHooks, type HookSystem } from "../hooks.js";
import { NotFoundError, ValidationError } from "../errors.js";
import {
  PluginManifestSchema,
  type PluginDefinition,
  type PluginInfo,
  type PluginOptionStore,
} from "./types.js";

const ACTIVE_PLUGINS_OPTION = "active_plugins";

/**
 * Manages the plugin lifecycle. Plugins are registered in-process (bundled
 * plugins call `register()` with a manifest + setup/teardown), and activation
 * state is persisted in the `active_plugins` option. Activating a plugin runs
 * its `setup` (which wires hooks); deactivating runs its `teardown`.
 *
 * Filesystem discovery + dynamic import of external plugin packages is a
 * loader/deploy concern layered on top of this registry.
 */
export class PluginManager {
  private readonly registry = new Map<string, PluginDefinition>();
  private readonly booted = new Set<string>();

  constructor(
    private readonly options: PluginOptionStore,
    private readonly hooks: HookSystem = globalHooks
  ) {}

  /** Register a plugin definition. Validates the manifest; rejects duplicate ids. */
  register(definition: PluginDefinition): void {
    const manifest = PluginManifestSchema.parse(definition.manifest);
    if (this.registry.has(manifest.id)) {
      throw new ValidationError(`Plugin "${manifest.id}" is already registered`);
    }
    this.registry.set(manifest.id, { ...definition, manifest });
  }

  /** Whether a plugin id is known to the registry. */
  isRegistered(id: string): boolean {
    return this.registry.has(id);
  }

  private async getActiveIds(): Promise<string[]> {
    const ids = await this.options.getOption<string[]>(ACTIVE_PLUGINS_OPTION, []);
    return Array.isArray(ids) ? ids : [];
  }

  private async setActiveIds(ids: string[]): Promise<void> {
    await this.options.updateOption(ACTIVE_PLUGINS_OPTION, ids);
  }

  async isActive(id: string): Promise<boolean> {
    return (await this.getActiveIds()).includes(id);
  }

  /** List every registered plugin with its current active state. */
  async list(): Promise<PluginInfo[]> {
    const active = new Set(await this.getActiveIds());
    return [...this.registry.values()].map((def) => ({
      manifest: def.manifest,
      active: active.has(def.manifest.id),
    }));
  }

  /**
   * Activate a plugin: run its setup, persist the id, and fire
   * `activate_plugin`. No-op if already active. Throws if not registered.
   */
  async activate(id: string): Promise<void> {
    const def = this.registry.get(id);
    if (!def) throw new NotFoundError("Plugin", id);

    const ids = await this.getActiveIds();
    if (ids.includes(id)) return;

    await def.setup({ hooks: this.hooks });
    this.booted.add(id);
    await this.setActiveIds([...ids, id]);
    await this.hooks.doAction("activate_plugin", id);
  }

  /**
   * Deactivate a plugin: run its teardown, drop the id, and fire
   * `deactivate_plugin`. No-op if not active.
   */
  async deactivate(id: string): Promise<void> {
    const ids = await this.getActiveIds();
    if (!ids.includes(id)) return;

    const def = this.registry.get(id);
    if (def?.teardown) {
      await def.teardown({ hooks: this.hooks });
    }
    this.booted.delete(id);
    await this.setActiveIds(ids.filter((x) => x !== id));
    await this.hooks.doAction("deactivate_plugin", id);
  }

  /**
   * Run setup for every active, registered plugin that hasn't booted yet.
   * Call once during application startup. Idempotent.
   */
  async bootActivePlugins(): Promise<void> {
    const ids = await this.getActiveIds();
    for (const id of ids) {
      const def = this.registry.get(id);
      if (def && !this.booted.has(id)) {
        await def.setup({ hooks: this.hooks });
        this.booted.add(id);
      }
    }
  }
}
