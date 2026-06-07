import { z } from "zod";

const TemplateKindSchema = z.enum([
  "index",
  "single",
  "page",
  "archive",
  "category",
  "tag",
  "author",
  "search",
  "404",
]);

const FrameStyleSchema = z.enum(["none", "card"]);
const CardStyleSchema = z.enum(["minimal", "feature"]);
const HeaderLayoutSchema = z.enum(["stacked", "split"]);
const FooterLayoutSchema = z.enum(["simple", "columns"]);
const SidebarLayoutSchema = z.enum(["stacked", "sticky"]);
const ShellStyleSchema = z.enum(["plain", "tinted"]);
const ThemeVariantSchema = z.enum(["editorial", "ink"]);

const HexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex color");

const ThemeTokensSchema = z
  .object({
    color: z
      .object({
        background: HexColorSchema,
        foreground: HexColorSchema,
        muted: HexColorSchema,
        accent: HexColorSchema,
        border: HexColorSchema,
        surface: HexColorSchema,
        darkBackground: HexColorSchema.optional(),
        darkForeground: HexColorSchema.optional(),
        darkMuted: HexColorSchema.optional(),
        darkAccent: HexColorSchema.optional(),
        darkBorder: HexColorSchema.optional(),
        darkSurface: HexColorSchema.optional(),
      })
      .strict(),
    typography: z
      .object({
        bodyFont: z.string().min(1).max(300),
        headingFont: z.string().min(1).max(300),
      })
      .strict(),
    layout: z
      .object({
        contentWidth: z.string().min(1).max(40),
        wideWidth: z.string().min(1).max(40),
        shellStyle: ShellStyleSchema,
      })
      .strict(),
    presentation: z
      .object({
        variant: ThemeVariantSchema,
      })
      .strict(),
  })
  .strict();

const TemplatePartSchema = z
  .object({
    layout: z.union([HeaderLayoutSchema, FooterLayoutSchema, SidebarLayoutSchema]),
    showDescription: z.boolean().optional(),
    showSearch: z.boolean().optional(),
    tagline: z.string().max(300).optional(),
  })
  .strict();

const TemplateConfigSchema = z
  .object({
    titleFormat: z.string().max(120).optional(),
    hero: z.enum(["none", "site-intro"]).optional(),
    frame: FrameStyleSchema,
    cardStyle: CardStyleSchema.optional(),
    showSidebar: z.boolean().optional(),
  })
  .strict();

const StyleVariationSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "id must be kebab-case"),
    label: z.string().min(1).max(100),
    accent: HexColorSchema.optional(),
  })
  .strict();

export const ThemeJsonSchema = z
  .object({
    $schema: z.string().max(500).optional(),
    version: z.literal(1),
    settings: ThemeTokensSchema,
    templateParts: z
      .object({
        header: TemplatePartSchema,
        footer: TemplatePartSchema,
        sidebar: TemplatePartSchema.optional(),
      })
      .strict(),
    templates: z.record(TemplateKindSchema, TemplateConfigSchema),
    styleVariations: z.array(StyleVariationSchema).max(20).optional(),
  })
  .strict();

export type TemplateKind = z.infer<typeof TemplateKindSchema>;
export type FrameStyle = z.infer<typeof FrameStyleSchema>;
export type CardStyle = z.infer<typeof CardStyleSchema>;
export type HeaderLayout = z.infer<typeof HeaderLayoutSchema>;
export type FooterLayout = z.infer<typeof FooterLayoutSchema>;
export type SidebarLayout = z.infer<typeof SidebarLayoutSchema>;
export type ShellStyle = z.infer<typeof ShellStyleSchema>;
export type ThemeVariant = z.infer<typeof ThemeVariantSchema>;
export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;
export type TemplatePart = z.infer<typeof TemplatePartSchema>;
export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;
export type StyleVariation = z.infer<typeof StyleVariationSchema>;
export type ThemeJson = z.infer<typeof ThemeJsonSchema>;

export function parseThemeJson(input: unknown): ThemeJson {
  return ThemeJsonSchema.parse(input);
}
