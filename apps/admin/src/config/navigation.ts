import {
  Home01Icon,
  News01Icon,
  Folder01Icon,
  Tag01Icon,
  Image01Icon,
  File01Icon,
  Comment01Icon,
  PaintBoardIcon,
  PuzzleIcon,
  UserGroupIcon,
  Wrench01Icon,
  Settings01Icon,
} from "hugeicons-react";
import type { ComponentType } from "react";

export type AdminColorSchemeId =
  | "default"
  | "blue"
  | "coffee"
  | "ectoplasm"
  | "light"
  | "midnight"
  | "modern"
  | "ocean"
  | "sunrise";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  position: number;
}

export interface NavSection {
  items: NavItem[];
}

export interface AdminColorScheme {
  id: AdminColorSchemeId;
  label: string;
}

export interface AdminHelpSection {
  title: string;
  body: string;
}

export interface AdminPrimaryAction {
  label: string;
  href: string;
}

export interface AdminColumnOption {
  key: string;
  label: string;
}

export interface AdminScreenConfig {
  title: string;
  description: string;
  helpSections: AdminHelpSection[];
  primaryAction?: AdminPrimaryAction;
  columnOptions?: AdminColumnOption[];
  supportsItemsPerPage?: boolean;
  notice?: {
    id: string;
    tone: "info" | "success" | "warning";
    title: string;
    description: string;
  };
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home01Icon, position: 2 },
  { label: "Posts", href: "/posts", icon: News01Icon, position: 5 },
  { label: "Categories", href: "/categories", icon: Folder01Icon, position: 6 },
  { label: "Tags", href: "/tags", icon: Tag01Icon, position: 7 },
  { label: "Media", href: "/media", icon: Image01Icon, position: 10 },
  { label: "Pages", href: "/pages", icon: File01Icon, position: 20 },
  { label: "Comments", href: "/comments", icon: Comment01Icon, position: 25 },
  { label: "Appearance", href: "/appearance", icon: PaintBoardIcon, position: 60 },
  { label: "Plugins", href: "/plugins", icon: PuzzleIcon, position: 65 },
  { label: "Users", href: "/users", icon: UserGroupIcon, position: 70 },
  { label: "Tools", href: "/tools", icon: Wrench01Icon, position: 75 },
  { label: "Settings", href: "/settings", icon: Settings01Icon, position: 80 },
];

export const NAV_SECTIONS: NavSection[] = [
  {
    items: NAV_ITEMS.filter((item) => item.position < 10),
  },
  {
    items: NAV_ITEMS.filter(
      (item) => item.position >= 10 && item.position < 60
    ),
  },
  {
    items: NAV_ITEMS.filter((item) => item.position >= 60),
  },
];

export const ADMIN_COLOR_SCHEMES: AdminColorScheme[] = [
  { id: "default", label: "Default" },
  { id: "blue", label: "Blue" },
  { id: "coffee", label: "Coffee" },
  { id: "ectoplasm", label: "Ectoplasm" },
  { id: "light", label: "Light" },
  { id: "midnight", label: "Midnight" },
  { id: "modern", label: "Modern" },
  { id: "ocean", label: "Ocean" },
  { id: "sunrise", label: "Sunrise" },
];

export const PAGE_TITLES: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [
    item.href,
    item.label === "Media" ? "Media Library" : item.label,
  ])
);

export const SIDEBAR_WIDTH_EXPANDED = 212;
export const SIDEBAR_WIDTH_COLLAPSED = 84;
export const DEFAULT_ITEMS_PER_PAGE = 20;

const ADMIN_SCREEN_CONFIGS: Record<string, AdminScreenConfig> = {
  "/": {
    title: "Dashboard",
    description:
      "The main administration home screen. Review activity, quick-create content, and keep an eye on the installation state.",
    helpSections: [
      {
        title: "Overview",
        body: "Dashboard brings recent activity, quick entry points, and site summary widgets into one screen.",
      },
      {
        title: "Customization",
        body: "Use Screen Options to dial the shell density up or down while the dashboard grows into the fuller Presslyn control surface.",
      },
    ],
    notice: {
      id: "dashboard-shell-ready",
      tone: "success",
      title: "Presslyn shell is live.",
      description:
        "The shared shell now carries Presslyn color systems, adaptive navigation, contextual panels, and list controls without leaning on WordPress chrome.",
    },
  },
  "/posts": {
    title: "Posts",
    description:
      "Manage blog posts, change visibility, and work through draft and trash queues from the main list table.",
    primaryAction: {
      label: "Add New",
      href: "/posts/new",
    },
    columnOptions: [
      { key: "author", label: "Author" },
      { key: "categories", label: "Categories" },
      { key: "tags", label: "Tags" },
      { key: "comments", label: "Comments" },
      { key: "date", label: "Date" },
    ],
    supportsItemsPerPage: true,
    helpSections: [
      {
        title: "Managing posts",
        body: "Filter by publication state, search by title, and use the row actions to jump into edit or preview flows.",
      },
      {
        title: "Screen Options",
        body: "Hide non-essential columns or raise the per-page limit when working through large editorial queues.",
      },
    ],
  },
  "/pages": {
    title: "Pages",
    description:
      "Work with static content such as landing pages, legal documents, and evergreen site sections.",
    primaryAction: {
      label: "Add New",
      href: "/pages/new",
    },
    columnOptions: [
      { key: "author", label: "Author" },
      { key: "categories", label: "Categories" },
      { key: "tags", label: "Tags" },
      { key: "comments", label: "Comments" },
      { key: "date", label: "Date" },
    ],
    supportsItemsPerPage: true,
    helpSections: [
      {
        title: "Managing pages",
        body: "Pages share the content engine with posts but are intended for timeless sections outside the blog chronology.",
      },
      {
        title: "List controls",
        body: "Screen Options persists hidden columns for this screen so each editor can tailor the table density.",
      },
    ],
  },
  "/categories": {
    title: "Categories",
    description:
      "Organize posts into a hierarchical taxonomy. Categories can nest under a parent to build topic trees.",
    helpSections: [
      {
        title: "Hierarchy",
        body: "Assign a parent category to nest related topics. Posts inherit nothing automatically — assignments are explicit.",
      },
      {
        title: "Slugs",
        body: "Leave the slug blank to auto-generate one from the name. Slugs drive category archive URLs.",
      },
    ],
  },
  "/tags": {
    title: "Tags",
    description:
      "Manage the flat keyword taxonomy used to cross-link posts by subject. Tags have no hierarchy.",
    helpSections: [
      {
        title: "Tags vs. categories",
        body: "Tags are non-hierarchical descriptors. Use them for granular keywords and categories for broad sections.",
      },
    ],
  },
  "/media": {
    title: "Media Library",
    description:
      "Browse uploaded assets, filter by type, and move quickly between thumbnails and individual media detail views.",
    primaryAction: {
      label: "Add New",
      href: "/media/upload",
    },
    helpSections: [
      {
        title: "Browsing media",
        body: "Use the filter tabs to jump between file families and the search box to narrow by title or filename.",
      },
      {
        title: "Uploads",
        body: "New uploads will later connect directly to the image-processing pipeline already implemented in the core media service.",
      },
    ],
  },
  "/comments": {
    title: "Comments",
    description:
      "Moderate discussion, approve or reject submissions, and keep an eye on pending responses that need attention.",
    columnOptions: [
      { key: "status", label: "Status" },
      { key: "submitted", label: "Submitted" },
    ],
    supportsItemsPerPage: true,
    helpSections: [
      {
        title: "Moderation",
        body: "Pending comments are highlighted so moderators can triage queues without leaving the main list screen.",
      },
      {
        title: "Column visibility",
        body: "Hide status or submission date when you want a tighter review loop focused on the author and the comment body.",
      },
    ],
  },
  "/appearance": {
    title: "Appearance",
    description:
      "Control the active theme surface and the admin-facing hooks that will later expand into menus, widgets, and editor tooling.",
    helpSections: [
      {
        title: "Themes",
        body: "Appearance is the entry point for theme management and later for menus, widgets, and file editing tools.",
      },
      {
        title: "Roadmap",
        body: "This screen currently focuses on the active-theme overview while the theme API is still ahead in the roadmap.",
      },
    ],
  },
  "/plugins": {
    title: "Plugins",
    description:
      "Activate, deactivate, and inspect the extensions that will eventually power Presslyn’s plugin ecosystem.",
    helpSections: [
      {
        title: "Plugins",
        body: "This area is reserved for the extensibility layer that follows after the core admin surfaces are complete.",
      },
    ],
  },
  "/users": {
    title: "Users",
    description:
      "Manage accounts, roles, and capability-bearing team members who can access the admin installation.",
    primaryAction: {
      label: "Add New",
      href: "/users/new",
    },
    columnOptions: [
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "joined", label: "Joined" },
    ],
    supportsItemsPerPage: true,
    helpSections: [
      {
        title: "Roles",
        body: "Roles already map to the capability model in the backend, and this table is the first Presslyn admin surface over that system.",
      },
      {
        title: "Screen Options",
        body: "Hide supporting columns when auditing accounts on smaller screens or increase the per-page count for bulk reviews.",
      },
    ],
  },
  "/tools": {
    title: "Tools",
    description:
      "Collect maintenance utilities, import/export workflows, and operational health checks in one predictable location.",
    helpSections: [
      {
        title: "Utilities",
        body: "Tools is where one-off operations such as importers, exports, and health reports will live.",
      },
    ],
  },
  "/settings": {
    title: "Settings",
    description:
      "Manage site-wide defaults such as title, URL, timezone, and reading preferences through the options service.",
    helpSections: [
      {
        title: "General settings",
        body: "Changes on this screen persist to the validated options service and represent installation-wide defaults.",
      },
      {
        title: "Options service",
        body: "The admin UI is writing into the same typed option store used by the API layer, so this screen remains a thin surface over shared business logic.",
      },
    ],
  },
};

export function getAdminPageKey(pathname: string): string {
  if (PAGE_TITLES[pathname]) {
    return pathname;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "/";
  }

  const parentPath = `/${segments[0]}`;
  return PAGE_TITLES[parentPath] ? parentPath : "/";
}

export function getAdminScreenConfig(pathname: string): AdminScreenConfig {
  const key = getAdminPageKey(pathname);
  return ADMIN_SCREEN_CONFIGS[key] ?? ADMIN_SCREEN_CONFIGS["/"];
}
