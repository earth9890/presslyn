import { cache } from "react";
import { services } from "@/lib/services";

export type PublicThemeVariant = "editorial" | "ink";

export interface PublicThemeDefinition {
  id: string;
  name: string;
  variant: PublicThemeVariant;
  bodyClassName: string;
  shellClassName: string;
  mainClassName: string;
  contentClassName: string;
}

const PUBLIC_THEMES: Record<string, PublicThemeDefinition> = {
  "presslyn-default": {
    id: "presslyn-default",
    name: "Presslyn Default",
    variant: "editorial",
    bodyClassName: "bg-background text-foreground",
    shellClassName: "",
    mainClassName: "mx-auto w-full max-w-3xl flex-1 px-6 py-10",
    contentClassName: "",
  },
  "presslyn-ink": {
    id: "presslyn-ink",
    name: "Presslyn Ink",
    variant: "ink",
    bodyClassName: "bg-background text-foreground",
    shellClassName: "presslyn-theme-shell",
    mainClassName:
      "mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-6 lg:px-8 lg:py-10",
    contentClassName: "presslyn-theme-frame",
  },
};

export function getPublicThemeById(id: string | null | undefined): PublicThemeDefinition {
  if (!id) {
    return PUBLIC_THEMES["presslyn-default"];
  }

  return PUBLIC_THEMES[id] ?? PUBLIC_THEMES["presslyn-default"];
}

export const getActivePublicTheme = cache(async (): Promise<PublicThemeDefinition> => {
  const activeThemeId = await services.themes.getActiveId().catch(() => null);
  return getPublicThemeById(activeThemeId);
});
