import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ValidationError } from "../errors.js";
import { ThemeManifestSchema, type ThemeManifest } from "./theme-manager.js";

export const THEME_MANIFEST_FILENAME = "theme.manifest.json";
export const THEME_CONFIG_FILENAME = "theme.json";

export interface FilesystemTheme {
  manifest: ThemeManifest;
  directory: string;
}

export function resolveThemesDirectory(cwd: string = process.cwd()): string {
  const candidates = [
    path.resolve(cwd, "content/themes"),
    path.resolve(cwd, "../../content/themes"),
  ];

  const existing = candidates.find((candidate) => existsSync(candidate));
  return existing ?? candidates[0]!;
}

export function readThemeManifestFromDirectory(themeDir: string): ThemeManifest {
  const manifestPath = path.join(themeDir, THEME_MANIFEST_FILENAME);
  const configPath = path.join(themeDir, THEME_CONFIG_FILENAME);

  if (!existsSync(manifestPath)) {
    throw new ValidationError(
      `Theme manifest not found at "${manifestPath}"`
    );
  }

  if (!existsSync(configPath)) {
    throw new ValidationError(
      `Theme config not found at "${configPath}"`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new ValidationError(
      `Invalid theme manifest JSON at "${manifestPath}": ${(error as Error).message}`
    );
  }

  return ThemeManifestSchema.parse(parsed);
}

export function discoverFilesystemThemes(themesDir: string): FilesystemTheme[] {
  if (!existsSync(themesDir)) {
    return [];
  }

  return readdirSync(themesDir)
    .map((entry) => path.join(themesDir, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((directory) => ({
      directory,
      manifest: readThemeManifestFromDirectory(directory),
    }));
}
