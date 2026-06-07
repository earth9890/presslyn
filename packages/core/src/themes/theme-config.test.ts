import { describe, expect, it } from "vitest";
import { parseThemeJson } from "./theme-config.js";

describe("parseThemeJson", () => {
  it("parses a valid theme config", () => {
    const parsed = parseThemeJson({
      version: 1,
      settings: {
        color: {
          background: "#ffffff",
          foreground: "#111111",
          muted: "#666666",
          accent: "#336699",
          border: "#dddddd",
          surface: "#fafafa",
        },
        typography: {
          bodyFont: "system-ui, sans-serif",
          headingFont: "Georgia, serif",
        },
        layout: {
          contentWidth: "48rem",
          wideWidth: "72rem",
          shellStyle: "plain",
        },
        presentation: {
          variant: "editorial",
        },
      },
      templateParts: {
        header: {
          layout: "stacked",
          showDescription: true,
          showSearch: true,
        },
        footer: {
          layout: "simple",
          tagline: "Powered by Presslyn",
        },
        sidebar: {
          layout: "sticky",
        },
      },
      templates: {
        index: { frame: "none", cardStyle: "minimal", hero: "site-intro" },
        single: { frame: "none" },
        page: { frame: "none" },
        archive: { frame: "none", cardStyle: "minimal" },
        category: { frame: "none", cardStyle: "minimal" },
        tag: { frame: "none", cardStyle: "minimal" },
        author: { frame: "none", cardStyle: "minimal" },
        search: { frame: "none", cardStyle: "minimal" },
        "404": { frame: "none" },
      },
      styleVariations: [{ id: "default", label: "Default", accent: "#336699" }],
    });

    expect(parsed.settings.layout.contentWidth).toBe("48rem");
    expect(parsed.templates.index.hero).toBe("site-intro");
  });

  it("rejects invalid template names and colors", () => {
    expect(() =>
      parseThemeJson({
        version: 1,
        settings: {
          color: {
            background: "white",
            foreground: "#111111",
            muted: "#666666",
            accent: "#336699",
            border: "#dddddd",
            surface: "#fafafa",
          },
          typography: {
            bodyFont: "system-ui, sans-serif",
            headingFont: "Georgia, serif",
          },
          layout: {
            contentWidth: "48rem",
            wideWidth: "72rem",
            shellStyle: "plain",
          },
          presentation: {
            variant: "editorial",
          },
        },
        templateParts: {
          header: {
            layout: "stacked",
          },
          footer: {
            layout: "simple",
          },
          sidebar: {
            layout: "stacked",
          },
        },
        templates: {
          index: { frame: "none" },
          single: { frame: "none" },
          page: { frame: "none" },
          archive: { frame: "none" },
          category: { frame: "none" },
          tag: { frame: "none" },
          author: { frame: "none" },
          search: { frame: "none" },
          frontPage: { frame: "none" },
        },
      })
    ).toThrow();
  });
});
