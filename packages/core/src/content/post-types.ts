/**
 * Post Type Registry
 *
 * WordPress equivalent: wp-includes/class-wp-post-type.php + register_post_type()
 */

export interface PostTypeDefinition {
  name: string;
  label: string;
  labelPlural: string;
  description?: string;
  public: boolean;
  hierarchical: boolean;
  hasArchive: boolean;
  showInMenu: boolean;
  showInRest: boolean;
  menuPosition?: number;
  menuIcon?: string;
  supports: Set<string>;
}

const registry: Map<string, PostTypeDefinition> = new Map();

/** Register built-in post types */
function registerBuiltins() {
  registerPostType("post", {
    label: "Post",
    labelPlural: "Posts",
    description: "Blog posts",
    public: true,
    hierarchical: false,
    hasArchive: true,
    showInMenu: true,
    showInRest: true,
    menuPosition: 5,
    menuIcon: "dashicons-admin-post",
    supports: new Set([
      "title",
      "editor",
      "author",
      "thumbnail",
      "excerpt",
      "trackbacks",
      "custom-fields",
      "comments",
      "revisions",
      "post-formats",
    ]),
  });

  registerPostType("page", {
    label: "Page",
    labelPlural: "Pages",
    description: "Static pages",
    public: true,
    hierarchical: true,
    hasArchive: false,
    showInMenu: true,
    showInRest: true,
    menuPosition: 20,
    menuIcon: "dashicons-admin-page",
    supports: new Set([
      "title",
      "editor",
      "author",
      "thumbnail",
      "page-attributes",
      "custom-fields",
      "comments",
      "revisions",
    ]),
  });

  registerPostType("attachment", {
    label: "Media",
    labelPlural: "Media",
    description: "Uploaded media files",
    public: false,
    hierarchical: false,
    hasArchive: false,
    showInMenu: false,
    showInRest: true,
    supports: new Set(["title", "author", "comments"]),
  });
}

export function registerPostType(
  name: string,
  definition: Omit<PostTypeDefinition, "name">
): void {
  registry.set(name, { name, ...definition });
}

export function getPostType(name: string): PostTypeDefinition | undefined {
  return registry.get(name);
}

export function getAllPostTypes(): PostTypeDefinition[] {
  return Array.from(registry.values());
}

export function getPublicPostTypes(): PostTypeDefinition[] {
  return Array.from(registry.values()).filter((pt) => pt.public);
}

// Initialize built-in post types
registerBuiltins();
