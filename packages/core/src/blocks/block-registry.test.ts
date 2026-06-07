import { describe, expect, it } from "vitest";
import { ValidationError } from "../errors.js";
import { BlockRegistry } from "./block-registry.js";

describe("BlockRegistry", () => {
  it("ships default categories and registers blocks", () => {
    const registry = new BlockRegistry();

    expect(registry.listCategories().map((category) => category.slug)).toContain(
      "text"
    );

    registry.register({
      manifest: {
        name: "presslyn/hero",
        title: "Hero",
        category: "design",
        attributes: {
          heading: { type: "string", default: "Hello" },
        },
      },
    });

    expect(registry.isRegistered("presslyn/hero")).toBe(true);
    expect(registry.list()).toHaveLength(1);
  });

  it("rejects duplicate blocks and unknown categories", () => {
    const registry = new BlockRegistry();

    expect(() =>
      registry.register({
        manifest: {
          name: "presslyn/bad",
          title: "Bad",
          category: "missing",
        },
      })
    ).toThrow(ValidationError);

    registry.register({
      manifest: {
        name: "presslyn/quote",
        title: "Quote",
        category: "text",
      },
    });

    expect(() =>
      registry.register({
        manifest: {
          name: "presslyn/quote",
          title: "Quote Duplicate",
          category: "text",
        },
      })
    ).toThrow(ValidationError);
  });

  it("registers patterns and styles against blocks", () => {
    const registry = new BlockRegistry();

    registry.register({
      manifest: {
        name: "presslyn/callout",
        title: "Callout",
        category: "design",
      },
    });

    registry.registerPattern({
      name: "presslyn/feature-stack",
      title: "Feature Stack",
      blockTypes: ["presslyn/callout"],
      categories: ["design"],
      content: "<!-- wp:presslyn/callout /-->",
    });

    registry.registerStyle({
      blockName: "presslyn/callout",
      name: "soft-outline",
      label: "Soft Outline",
    });

    expect(registry.listPatterns("presslyn/callout")).toHaveLength(1);
    expect(registry.listStyles("presslyn/callout")).toEqual([
      {
        blockName: "presslyn/callout",
        name: "soft-outline",
        label: "Soft Outline",
      },
    ]);
  });

  it("renders registered blocks and returns null without a renderer", async () => {
    const registry = new BlockRegistry();

    registry.register({
      manifest: {
        name: "presslyn/banner",
        title: "Banner",
        category: "design",
      },
      render: ({ attributes, innerHtml }) =>
        `<section>${attributes["headline"] ?? ""}${innerHtml ?? ""}</section>`,
    });

    registry.register({
      manifest: {
        name: "presslyn/plain",
        title: "Plain",
        category: "text",
      },
    });

    await expect(
      registry.render("presslyn/banner", { headline: "Hi" }, "<p>There</p>")
    ).resolves.toBe("<section>Hi<p>There</p></section>");
    await expect(registry.render("presslyn/plain")).resolves.toBeNull();
  });
});
