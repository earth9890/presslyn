import { describe, expect, it } from "vitest";
import { ValidationError } from "../errors.js";
import { parseBlockTemplate } from "./template-parser.js";

describe("parseBlockTemplate", () => {
  it("parses self-closing and nested blocks", () => {
    const parsed = parseBlockTemplate(`
<!-- wp:group {"tagName":"header","className":"shell"} -->
  <!-- wp:site-title /-->
  <!-- wp:group {"tagName":"nav"} -->
    <!-- wp:navigation /-->
  <!-- /wp:group -->
<!-- /wp:group -->
    `.trim());

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.blockName).toBe("group");
    expect(parsed[0]?.attrs).toEqual({ tagName: "header", className: "shell" });
    expect(parsed[0]?.innerBlocks.map((block) => block.blockName)).toEqual([
      "site-title",
      "group",
    ]);
    expect(parsed[0]?.innerBlocks[1]?.innerBlocks[0]?.blockName).toBe("navigation");
  });

  it("preserves block inner html", () => {
    const parsed = parseBlockTemplate(
      "<!-- wp:paragraph --><p>Hello <strong>world</strong></p><!-- /wp:paragraph -->"
    );

    expect(parsed[0]?.innerHtml).toContain("<p>Hello <strong>world</strong></p>");
  });

  it("rejects malformed templates", () => {
    expect(() =>
      parseBlockTemplate("<!-- /wp:group -->")
    ).toThrow(ValidationError);

    expect(() =>
      parseBlockTemplate("<!-- wp:group --><!-- /wp:paragraph -->")
    ).toThrow(ValidationError);

    expect(() =>
      parseBlockTemplate('<!-- wp:group {"tagName": } --><!-- /wp:group -->')
    ).toThrow(ValidationError);
  });
});
