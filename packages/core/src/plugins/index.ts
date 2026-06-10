export { PluginManager } from "./plugin-manager.js";
export {
  PluginManifestSchema,
  type PluginManifest,
  type PluginContext,
  type PluginDefinition,
  type PluginInfo,
  type PluginOptionStore,
} from "./types.js";
export {
  PLUGIN_MANIFEST_FILENAME,
  resolvePluginsDirectory,
  readPluginManifestFromDirectory,
  discoverFilesystemPlugins,
  loadFilesystemPlugin,
  registerFilesystemPlugins,
  type FilesystemPlugin,
} from "./filesystem-plugins.js";
