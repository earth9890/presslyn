import { z } from "zod";
import { ValidationError } from "../errors.js";

const BlockAttributeSchema = z
  .object({
    type: z.enum(["string", "number", "boolean", "array", "object"]),
    default: z.unknown().optional(),
    enum: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .strict();

export const BlockCategorySchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "slug must be kebab-case"),
    title: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
  })
  .strict();

export const BlockManifestSchema = z
  .object({
    name: z
      .string()
      .min(3)
      .max(150)
      .regex(
        /^[a-z0-9-]+\/[a-z0-9-]+$/,
        "name must be namespace/block-name"
      ),
    title: z.string().min(1).max(120),
    description: z.string().max(1000).optional(),
    category: z.string().min(1).max(100),
    icon: z.string().max(100).optional(),
    keywords: z.array(z.string().min(1).max(50)).max(20).optional(),
    attributes: z.record(z.string(), BlockAttributeSchema).optional(),
    supports: z
      .object({
        align: z.boolean().optional(),
        anchor: z.boolean().optional(),
        className: z.boolean().optional(),
        customClassName: z.boolean().optional(),
        html: z.boolean().optional(),
        reusable: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const BlockPatternSchema = z
  .object({
    name: z
      .string()
      .min(3)
      .max(150)
      .regex(
        /^[a-z0-9-]+\/[a-z0-9-]+$/,
        "name must be namespace/pattern-name"
      ),
    title: z.string().min(1).max(120),
    description: z.string().max(1000).optional(),
    blockTypes: z.array(z.string().min(1).max(150)).max(50).optional(),
    categories: z.array(z.string().min(1).max(100)).max(20).optional(),
    content: z.string().min(1),
  })
  .strict();

export const BlockStyleSchema = z
  .object({
    blockName: z
      .string()
      .min(3)
      .max(150)
      .regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, "blockName must be namespace/name"),
    name: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "name must be kebab-case"),
    label: z.string().min(1).max(100),
    isDefault: z.boolean().optional(),
  })
  .strict();

export type BlockCategory = z.infer<typeof BlockCategorySchema>;
export type BlockManifest = z.infer<typeof BlockManifestSchema>;
export type BlockPattern = z.infer<typeof BlockPatternSchema>;
export type BlockStyle = z.infer<typeof BlockStyleSchema>;
export type BlockAttributes = Record<string, unknown>;

export interface BlockRenderContext {
  attributes: BlockAttributes;
  innerHtml?: string;
}

export interface BlockDefinition {
  manifest: BlockManifest;
  render?: (context: BlockRenderContext) => string | Promise<string>;
}

const DEFAULT_CATEGORIES: readonly BlockCategory[] = [
  { slug: "text", title: "Text" },
  { slug: "media", title: "Media" },
  { slug: "design", title: "Design" },
  { slug: "widgets", title: "Widgets" },
  { slug: "theme", title: "Theme" },
  { slug: "embed", title: "Embed" },
];

export class BlockRegistry {
  private readonly categories = new Map<string, BlockCategory>();
  private readonly blocks = new Map<string, BlockDefinition>();
  private readonly patterns = new Map<string, BlockPattern>();
  private readonly styles = new Map<string, BlockStyle[]>();

  constructor() {
    for (const category of DEFAULT_CATEGORIES) {
      this.categories.set(category.slug, category);
    }
  }

  registerCategory(category: BlockCategory): void {
    const parsed = BlockCategorySchema.parse(category);
    if (this.categories.has(parsed.slug)) {
      throw new ValidationError(`Block category "${parsed.slug}" already exists`);
    }
    this.categories.set(parsed.slug, parsed);
  }

  listCategories(): BlockCategory[] {
    return [...this.categories.values()];
  }

  register(definition: BlockDefinition): void {
    const manifest = BlockManifestSchema.parse(definition.manifest);
    if (!this.categories.has(manifest.category)) {
      throw new ValidationError(
        `Block category "${manifest.category}" is not registered`
      );
    }
    if (this.blocks.has(manifest.name)) {
      throw new ValidationError(`Block "${manifest.name}" is already registered`);
    }
    this.blocks.set(manifest.name, { ...definition, manifest });
  }

  isRegistered(name: string): boolean {
    return this.blocks.has(name);
  }

  get(name: string): BlockDefinition | undefined {
    return this.blocks.get(name);
  }

  list(): BlockDefinition[] {
    return [...this.blocks.values()];
  }

  registerPattern(pattern: BlockPattern): void {
    const parsed = BlockPatternSchema.parse(pattern);
    if (this.patterns.has(parsed.name)) {
      throw new ValidationError(`Pattern "${parsed.name}" is already registered`);
    }
    this.patterns.set(parsed.name, parsed);
  }

  listPatterns(blockName?: string): BlockPattern[] {
    const patterns = [...this.patterns.values()];
    if (!blockName) {
      return patterns;
    }

    return patterns.filter((pattern) => pattern.blockTypes?.includes(blockName));
  }

  registerStyle(style: BlockStyle): void {
    const parsed = BlockStyleSchema.parse(style);
    if (!this.blocks.has(parsed.blockName)) {
      throw new ValidationError(
        `Cannot register style for unknown block "${parsed.blockName}"`
      );
    }

    const current = this.styles.get(parsed.blockName) ?? [];
    if (current.some((entry) => entry.name === parsed.name)) {
      throw new ValidationError(
        `Style "${parsed.blockName}:${parsed.name}" is already registered`
      );
    }

    this.styles.set(parsed.blockName, [...current, parsed]);
  }

  listStyles(blockName?: string): BlockStyle[] {
    if (blockName) {
      return [...(this.styles.get(blockName) ?? [])];
    }

    return [...this.styles.values()].flat();
  }

  async render(
    name: string,
    attributes: BlockAttributes = {},
    innerHtml?: string
  ): Promise<string | null> {
    const definition = this.blocks.get(name);
    if (!definition?.render) {
      return null;
    }

    return definition.render({ attributes, innerHtml });
  }
}
