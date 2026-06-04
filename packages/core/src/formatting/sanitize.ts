/**
 * Formatting & Sanitization
 *
 * WordPress equivalent: wp-includes/formatting.php (6,296 lines)
 * Output escaping, slug generation, HTML sanitization.
 */

/** Escape HTML entities for safe output. Equivalent to esc_html(). */
export function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Escape for use in HTML attributes. Equivalent to esc_attr(). */
export function escAttr(str: string): string {
  return escHtml(str);
}

/** Escape a URL. Equivalent to esc_url(). */
export function escUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ["http:", "https:", "mailto:", "tel:"];
    if (!allowedProtocols.includes(parsed.protocol)) {
      return "";
    }
    return parsed.href;
  } catch {
    return "";
  }
}

/** Generate a URL slug from a title. Equivalent to sanitize_title(). */
export function sanitizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 200);
}

/** Sanitize an email address. Equivalent to sanitize_email(). */
export function sanitizeEmail(email: string): string {
  const cleaned = email.trim().toLowerCase();
  const regex = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;
  return regex.test(cleaned) ? cleaned : "";
}

/** Sanitize a filename. Equivalent to sanitize_file_name(). */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Auto-paragraph text. Equivalent to wpautop().
 * Wraps double line breaks in <p> tags, single line breaks become <br>.
 */
export function autop(text: string): string {
  if (!text.trim()) return "";

  // Normalize line endings
  let output = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Split on double newlines
  const paragraphs = output.split(/\n\s*\n/).filter((p) => p.trim());

  return paragraphs
    .map((p) => {
      const trimmed = p.trim();
      // Convert single newlines to <br>
      const withBreaks = trimmed.replace(/\n/g, "<br>\n");
      return `<p>${withBreaks}</p>`;
    })
    .join("\n\n");
}

/**
 * Strip HTML tags from a string. Basic equivalent to wp_strip_all_tags().
 *
 * WARNING: This is NOT a security sanitizer. It uses a simple regex that
 * does not handle unclosed tags, HTML comments, or CDATA sections.
 * Use this only for display purposes (e.g., generating excerpts).
 * For security sanitization, use a proper HTML sanitizer library.
 */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Truncate text to a word boundary. Useful for excerpts.
 */
export function truncateWords(text: string, wordCount: number = 55, more: string = "..."): string {
  const words = text.split(/\s+/);
  if (words.length <= wordCount) return text;
  return words.slice(0, wordCount).join(" ") + more;
}
