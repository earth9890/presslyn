/**
 * Shared utilities used across Presslyn core services.
 */

/**
 * Escape SQL LIKE metacharacters (%, _, \) in user input.
 * Prevents users from injecting LIKE wildcards into search patterns.
 */
export function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

/**
 * Generate a URL slug from a title.
 * Handles diacritics via NFD normalization.
 * Falls back to a random slug if the title produces an empty string (e.g., all non-Latin).
 */
export function generateSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 200);

  // Fallback for non-Latin titles that produce empty slugs
  if (!slug) {
    return `post-${Date.now().toString(36)}`;
  }

  return slug;
}
