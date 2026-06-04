/**
 * Roles & Capabilities
 *
 * WordPress equivalent: wp-includes/capabilities.php + class-wp-roles.php
 * Defines the default roles and their capabilities, matching WordPress exactly.
 */

export interface Role {
  name: string;
  displayName: string;
  capabilities: Set<string>;
}

/**
 * All WordPress capabilities.
 * Reference: https://wordpress.org/documentation/article/roles-and-capabilities/
 */
const ADMINISTRATOR_CAPS = [
  // Posts
  "edit_posts",
  "edit_others_posts",
  "edit_published_posts",
  "edit_private_posts",
  "publish_posts",
  "delete_posts",
  "delete_others_posts",
  "delete_published_posts",
  "delete_private_posts",
  "read_private_posts",
  // Pages
  "edit_pages",
  "edit_others_pages",
  "edit_published_pages",
  "edit_private_pages",
  "publish_pages",
  "delete_pages",
  "delete_others_pages",
  "delete_published_pages",
  "delete_private_pages",
  "read_private_pages",
  // Uploads
  "upload_files",
  // Comments
  "moderate_comments",
  // Taxonomies
  "manage_categories",
  // Links
  "manage_links",
  // Users
  "list_users",
  "create_users",
  "edit_users",
  "delete_users",
  "promote_users",
  // Themes
  "switch_themes",
  "edit_themes",
  "install_themes",
  "delete_themes",
  "edit_theme_options",
  // Plugins
  "activate_plugins",
  "edit_plugins",
  "install_plugins",
  "delete_plugins",
  // Settings
  "manage_options",
  // Tools
  "import",
  "export",
  // Core
  "update_core",
  "update_plugins",
  "update_themes",
  "edit_files",
  "unfiltered_html",
  "unfiltered_upload",
  // General
  "read",
] as const;

const EDITOR_CAPS = [
  "edit_posts",
  "edit_others_posts",
  "edit_published_posts",
  "edit_private_posts",
  "publish_posts",
  "delete_posts",
  "delete_others_posts",
  "delete_published_posts",
  "delete_private_posts",
  "read_private_posts",
  "edit_pages",
  "edit_others_pages",
  "edit_published_pages",
  "edit_private_pages",
  "publish_pages",
  "delete_pages",
  "delete_others_pages",
  "delete_published_pages",
  "delete_private_pages",
  "read_private_pages",
  "upload_files",
  "moderate_comments",
  "manage_categories",
  "manage_links",
  "unfiltered_html",
  "read",
] as const;

const AUTHOR_CAPS = [
  "edit_posts",
  "edit_published_posts",
  "publish_posts",
  "delete_posts",
  "delete_published_posts",
  "upload_files",
  "read",
] as const;

const CONTRIBUTOR_CAPS = [
  "edit_posts",
  "delete_posts",
  "read",
] as const;

const SUBSCRIBER_CAPS = ["read"] as const;

/** Default roles matching WordPress exactly */
export const DEFAULT_ROLES: Record<string, Role> = {
  administrator: {
    name: "administrator",
    displayName: "Administrator",
    capabilities: new Set(ADMINISTRATOR_CAPS),
  },
  editor: {
    name: "editor",
    displayName: "Editor",
    capabilities: new Set(EDITOR_CAPS),
  },
  author: {
    name: "author",
    displayName: "Author",
    capabilities: new Set(AUTHOR_CAPS),
  },
  contributor: {
    name: "contributor",
    displayName: "Contributor",
    capabilities: new Set(CONTRIBUTOR_CAPS),
  },
  subscriber: {
    name: "subscriber",
    displayName: "Subscriber",
    capabilities: new Set(SUBSCRIBER_CAPS),
  },
};

/** Custom roles added at runtime */
const customRoles: Map<string, Role> = new Map();

export function getRole(name: string): Role | undefined {
  return customRoles.get(name) ?? DEFAULT_ROLES[name];
}

export function getAllRoles(): Role[] {
  const all = new Map<string, Role>();
  for (const [key, role] of Object.entries(DEFAULT_ROLES)) {
    all.set(key, role);
  }
  for (const [key, role] of customRoles) {
    all.set(key, role);
  }
  return Array.from(all.values());
}

export function registerRole(
  name: string,
  displayName: string,
  capabilities: string[]
): void {
  customRoles.set(name, {
    name,
    displayName,
    capabilities: new Set(capabilities),
  });
}

export function userCan(userRole: string, capability: string): boolean {
  const role = getRole(userRole);
  if (!role) return false;
  return role.capabilities.has(capability);
}
