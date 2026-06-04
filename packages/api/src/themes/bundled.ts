/**
 * Bundled themes shipped with Presslyn. Registered with the ThemeManager at
 * startup; the active theme is tracked in the `active_theme` option (seeded to
 * "presslyn-default").
 */

import { ThemeManager } from "@presslyn/core";

export function registerBundledThemes(manager: ThemeManager): void {
  manager.register({
    id: "presslyn-default",
    name: "Presslyn Default",
    version: "1.0.0",
    description:
      "The default Presslyn theme — a clean, fast, editorial layout with light and dark support.",
    author: "Presslyn",
  });
}
