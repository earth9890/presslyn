import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ValidationError } from "../errors.js";
import {
  discoverFilesystemThemes,
  readThemeManifestFromDirectory,
  resolveThemesDirectory,
} from "./filesystem-themes.js";

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "presslyn-themes-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("filesystem themes", () => {
  it("discovers valid themes from a directory", () => {
    const root = makeTempDir();
    const themeDir = path.join(root, "editorial");
    mkdirSync(themeDir, { recursive: true });
    writeFileSync(
      path.join(themeDir, "theme.manifest.json"),
      JSON.stringify({
        id: "editorial",
        name: "Editorial",
        version: "1.0.0",
      })
    );
    writeFileSync(
      path.join(themeDir, "theme.json"),
      JSON.stringify({
        version: 1,
        settings: {
          color: {
            background: "#ffffff",
            foreground: "#111111",
            muted: "#666666",
            accent: "#2255aa",
            border: "#dddddd",
            surface: "#f8f8f8",
          },
          typography: {
            bodyFont: "system-ui",
            headingFont: "Georgia",
          },
          layout: {
            contentWidth: "48rem",
            wideWidth: "64rem",
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
          "404": { frame: "none" },
        },
      })
    );

    const themes = discoverFilesystemThemes(root);
    expect(themes).toHaveLength(1);
    expect(themes[0]?.manifest.name).toBe("Editorial");
    expect(themes[0]?.directory).toBe(themeDir);
  });

  it("rejects themes with missing required files", () => {
    const root = makeTempDir();
    const themeDir = path.join(root, "broken");
    mkdirSync(themeDir, { recursive: true });
    writeFileSync(
      path.join(themeDir, "theme.manifest.json"),
      JSON.stringify({
        id: "broken",
        name: "Broken",
        version: "1.0.0",
      })
    );

    expect(() => readThemeManifestFromDirectory(themeDir)).toThrow(ValidationError);
  });

  it("resolves the nearest content/themes directory", () => {
    const root = makeTempDir();
    const nested = path.join(root, "apps", "web");
    mkdirSync(path.join(root, "content", "themes"), { recursive: true });
    mkdirSync(nested, { recursive: true });

    expect(resolveThemesDirectory(root)).toBe(path.join(root, "content", "themes"));
    expect(resolveThemesDirectory(nested)).toBe(
      path.join(root, "content", "themes")
    );
  });
});
