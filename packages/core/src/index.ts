// Schemas
export {
  CreateUserSchema,
  UpdateUserSchema,
  UserListSchema,
  LoginSchema,
  CreatePostSchema,
  UpdatePostSchema,
  PostQuerySchema,
  CreateTaxonomySchema,
  CreateTermSchema,
  UpdateTermSchema,
  TermQuerySchema,
  CreateCommentSchema,
  CommentQuerySchema,
} from "./schemas.js";

// Hook System
export { HookSystem, hooks } from "./hooks.js";

// Errors
export {
  PresslynError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "./errors.js";

// Options
export { OptionsService } from "./options/index.js";

// Users
export {
  UsersService,
  type CreateUserInput,
  type UpdateUserInput,
  type UserListOptions,
  type AuthResult,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  getSessionExpiry,
  DEFAULT_ROLES,
  getRole,
  getAllRoles,
  registerRole,
  userCan,
  type Role,
} from "./users/index.js";

// Content
export {
  ContentService,
  type CreatePostInput,
  type UpdatePostInput,
  type PostQueryOptions,
  registerPostType,
  getPostType,
  getAllPostTypes,
  getPublicPostTypes,
  type PostTypeDefinition,
} from "./content/index.js";

// Taxonomy
export {
  TaxonomyService,
  type CreateTaxonomyInput,
  type CreateTermInput,
  type UpdateTermInput,
  type TermQueryOptions,
  type TermTreeNode,
} from "./taxonomy/index.js";

// Comments
export {
  CommentsService,
  type CreateCommentInput,
  type CommentQueryOptions,
} from "./comments/index.js";

// Formatting
export {
  escHtml,
  escAttr,
  escUrl,
  sanitizeTitle,
  sanitizeEmail,
  sanitizeFileName,
  autop,
  stripTags,
  truncateWords,
} from "./formatting/index.js";

// Cache
export {
  CacheService,
  cache,
  type CacheStore,
  MemoryStore,
  RedisStore,
  Transients,
  cacheStoreFromEnv,
} from "./cache/index.js";

// Cron
export { CronService, SCHEDULES } from "./cron/index.js";

// Email
export {
  EmailService,
  type EmailServiceConfig,
  LogTransport,
  CapturingTransport,
  SmtpTransport,
  transportFromEnv,
  type SmtpConfig,
  welcomeEmail,
  passwordResetEmail,
  commentNotificationEmail,
  type WelcomeContext,
  type PasswordResetContext,
  type CommentNotificationContext,
  type EmailMessage,
  type EmailTransport,
  type RenderedEmail,
} from "./email/index.js";

// Media
export {
  MediaService,
  LocalStorageAdapter,
  type UploadMediaInput,
  type UpdateMediaInput,
  type MediaQueryOptions,
  type StorageAdapter,
  registerImageSize,
  getImageSize,
  getAllImageSizes,
  type ImageSizeDefinition,
} from "./media/index.js";

// Export (WXR)
export {
  buildWxr,
  escapeXml,
  cdata,
  WXR_VERSION,
  type WxrData,
  type WxrItem,
  type WxrAuthor,
  type WxrCategory,
  type WxrTermRef,
  type WxrComment,
} from "./export/wxr.js";
export { collectWxrData, type CollectDeps } from "./export/collect.js";

// Plugins
export {
  PluginManager,
  PluginManifestSchema,
  type PluginManifest,
  type PluginContext,
  type PluginDefinition,
  type PluginInfo,
  type PluginOptionStore,
} from "./plugins/index.js";

// Blocks
export {
  BlockRegistry,
  BlockCategorySchema,
  BlockManifestSchema,
  BlockPatternSchema,
  BlockStyleSchema,
  type BlockCategory,
  type BlockManifest,
  type BlockPattern,
  type BlockStyle,
  type BlockAttributes,
  type BlockRenderContext,
  type BlockDefinition,
  parseBlockTemplate,
  type ParsedTemplateBlock,
} from "./blocks/index.js";

// Themes
export {
  ThemeManager,
  ThemeManifestSchema,
  ThemeJsonSchema,
  parseThemeJson,
  type ThemeManifest,
  type ThemeInfo,
  type ThemeOptionStore,
  type ThemeJson,
  type ThemeTokens,
  type TemplateKind,
  type TemplateConfig,
  type TemplatePart,
  type CardStyle,
  type StyleVariation,
  type ThemeVariant,
} from "./themes/index.js";

// Import (WXR)
export {
  parseWxr,
  importWxr,
  type ParsedWxr,
  type ParsedWxrItem,
  type ParsedWxrAuthor,
  type ParsedWxrTerm,
  type ParsedWxrComment,
  type ImportSummary,
  type ImportDeps,
  type ImportOptions,
} from "./import/wxr-import.js";

// Utilities
export { escapeLike, generateSlug } from "./utils.js";
