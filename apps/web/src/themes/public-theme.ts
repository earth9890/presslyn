import { cache } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  parseThemeJson,
  readThemeManifestFromDirectory,
  resolveThemesDirectory,
  type StyleVariation,
  type CardStyle,
  type TemplateConfig,
  type TemplateKind,
  type ThemeJson,
  type ThemeVariant,
} from "@presslyn/core";
import { services } from "@/lib/services";
import defaultThemeJson from "./bundled/presslyn-default/theme.json";
import inkThemeJson from "./bundled/presslyn-ink/theme.json";

export interface PublicThemeDefinition {
  id: string;
  name: string;
  config: ThemeJson;
  bodyClassName: string;
  rootDir: string;
  activeStyleVariationId: string | null;
}

export type { CardStyle, ThemeVariant };

const PUBLIC_THEMES: Record<string, PublicThemeDefinition> = {
  "presslyn-default": {
    id: "presslyn-default",
    name: "Presslyn Default",
    config: parseThemeJson(defaultThemeJson),
    bodyClassName: "bg-background text-foreground",
    rootDir: path.join(process.cwd(), "src/themes/bundled/presslyn-default"),
    activeStyleVariationId: null,
  },
  "presslyn-ink": {
    id: "presslyn-ink",
    name: "Presslyn Ink",
    config: parseThemeJson(inkThemeJson),
    bodyClassName: "bg-background text-foreground",
    rootDir: path.join(process.cwd(), "src/themes/bundled/presslyn-ink"),
    activeStyleVariationId: null,
  },
};

const loadFilesystemTheme = cache(
  async (id: string): Promise<PublicThemeDefinition | null> => {
    const rootDir = path.join(resolveThemesDirectory(), id);

    try {
      const manifest = readThemeManifestFromDirectory(rootDir);
      const rawConfig = JSON.parse(
        readFileSync(path.join(rootDir, "theme.json"), "utf8")
      );

      return {
        id: manifest.id,
        name: manifest.name,
        config: parseThemeJson(rawConfig),
        bodyClassName: "bg-background text-foreground",
        rootDir,
        activeStyleVariationId: null,
      };
    } catch {
      return null;
    }
  }
);

export async function getPublicThemeById(
  id: string | null | undefined
): Promise<PublicThemeDefinition> {
  const themeId = id ?? "presslyn-default";
  const bundled = PUBLIC_THEMES[themeId];
  if (bundled) {
    return bundled;
  }

  const filesystemTheme = await loadFilesystemTheme(themeId);
  return filesystemTheme ?? PUBLIC_THEMES["presslyn-default"];
}

export function getThemeVariant(theme: PublicThemeDefinition): ThemeVariant {
  return theme.config.settings.presentation.variant;
}

export function getThemeTemplate(
  theme: PublicThemeDefinition,
  kind: TemplateKind
): TemplateConfig {
  const templates = theme.config.templates;
  const fallbacks: TemplateKind[] =
    kind === "category" || kind === "tag" || kind === "author"
      ? [kind, "archive", "index"]
      : kind === "search"
        ? ["search", "archive", "index"]
        : [kind, "index"];

  for (const key of fallbacks) {
    const template = templates[key];
    if (template) {
      return template;
    }
  }

  throw new Error(`Theme "${theme.id}" is missing a template for "${kind}"`);
}

export function getThemeShellClassName(theme: PublicThemeDefinition): string {
  return theme.config.settings.layout.shellStyle === "tinted"
    ? "presslyn-theme-shell"
    : "";
}

export function getThemeMainClassName(theme: PublicThemeDefinition): string {
  return getThemeVariant(theme) === "ink"
    ? "mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-6 lg:px-8 lg:py-10"
    : "mx-auto w-full max-w-3xl flex-1 px-6 py-10";
}

export function getThemeCssVariables(theme: PublicThemeDefinition): Record<string, string> {
  const { color, typography, layout } = theme.config.settings;
  const styleVariation = getSelectedThemeStyleVariation(theme);
  const accent = styleVariation?.accent ?? color.accent;
  const darkAccent = styleVariation?.accent ?? color.darkAccent ?? color.accent;

  return {
    "--background": color.background,
    "--foreground": color.foreground,
    "--muted": color.muted,
    "--accent": accent,
    "--border": color.border,
    "--surface": color.surface,
    "--background-dark": color.darkBackground ?? color.background,
    "--foreground-dark": color.darkForeground ?? color.foreground,
    "--muted-dark": color.darkMuted ?? color.muted,
    "--accent-dark": darkAccent,
    "--border-dark": color.darkBorder ?? color.border,
    "--surface-dark": color.darkSurface ?? color.surface,
    "--font-body": typography.bodyFont,
    "--font-heading": typography.headingFont,
    "--site-content-width": layout.contentWidth,
    "--site-wide-width": layout.wideWidth,
  };
}

export function getSelectedThemeStyleVariation(
  theme: PublicThemeDefinition
): StyleVariation | null {
  if (!theme.activeStyleVariationId) {
    return null;
  }

  return (
    theme.config.styleVariations?.find(
      (variation) => variation.id === theme.activeStyleVariationId
    ) ?? null
  );
}

export const getActivePublicTheme = cache(async (): Promise<PublicThemeDefinition> => {
  const activeThemeId = await services.themes.getActiveId().catch(() => null);
  const theme = await getPublicThemeById(activeThemeId);
  const styleVariationId = await services.themes
    .getStyleVariationId(theme.id)
    .catch(() => null);

  if (
    styleVariationId &&
    theme.config.styleVariations?.some((variation) => variation.id === styleVariationId)
  ) {
    return {
      ...theme,
      activeStyleVariationId: styleVariationId,
    };
  }

  return theme;
});
