import { readFileSync } from "node:fs";
import path from "node:path";
import {
  discoverFilesystemThemes,
  parseThemeJson,
  resolveThemesDirectory,
  type StyleVariation,
} from "@presslyn/core";
import defaultThemeJson from "../../../web/src/themes/bundled/presslyn-default/theme.json";
import inkThemeJson from "../../../web/src/themes/bundled/presslyn-ink/theme.json";

export interface AdminThemeCatalogEntry {
  styleVariations: StyleVariation[];
}

export function loadAdminThemeCatalog(): Map<string, AdminThemeCatalogEntry> {
  const catalog = new Map<string, AdminThemeCatalogEntry>();

  catalog.set("presslyn-default", {
    styleVariations: parseThemeJson(defaultThemeJson).styleVariations ?? [],
  });
  catalog.set("presslyn-ink", {
    styleVariations: parseThemeJson(inkThemeJson).styleVariations ?? [],
  });

  for (const theme of discoverFilesystemThemes(resolveThemesDirectory(process.cwd()))) {
    const config = parseThemeJson(
      JSON.parse(readFileSync(path.join(theme.directory, "theme.json"), "utf8"))
    );
    catalog.set(theme.manifest.id, {
      styleVariations: config.styleVariations ?? [],
    });
  }

  return catalog;
}
