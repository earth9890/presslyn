import { escHtml } from "../formatting/index.js";
import type { RenderedEmail } from "./types.js";

/** Wrap body HTML in a minimal, email-client-safe layout. */
function layout(siteName: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,sans-serif;color:#1a1a18;line-height:1.6;max-width:560px;margin:0 auto;padding:24px">
${bodyHtml}
<hr style="border:none;border-top:1px solid #e7e6e1;margin:32px 0 16px">
<p style="font-size:12px;color:#6b6b66">Sent by ${escHtml(siteName)} · Powered by Presslyn</p>
</body></html>`;
}

export interface WelcomeContext {
  siteName: string;
  displayName: string;
  loginUrl: string;
}

export function welcomeEmail(ctx: WelcomeContext): RenderedEmail {
  const subject = `Welcome to ${ctx.siteName}`;
  const text = `Hi ${ctx.displayName},

Your account on ${ctx.siteName} is ready. Sign in here: ${ctx.loginUrl}`;
  const html = layout(
    ctx.siteName,
    `<h1 style="font-size:20px">Welcome, ${escHtml(ctx.displayName)}</h1>
<p>Your account on <strong>${escHtml(ctx.siteName)}</strong> is ready.</p>
<p><a href="${escHtml(ctx.loginUrl)}" style="color:#2f5d50">Sign in to get started →</a></p>`
  );
  return { subject, html, text };
}

export interface PasswordResetContext {
  siteName: string;
  displayName: string;
  resetUrl: string;
}

export function passwordResetEmail(ctx: PasswordResetContext): RenderedEmail {
  const subject = `Reset your ${ctx.siteName} password`;
  const text = `Hi ${ctx.displayName},

We received a request to reset your password. Use this link (it expires soon):
${ctx.resetUrl}

If you didn't request this, you can ignore this email.`;
  const html = layout(
    ctx.siteName,
    `<h1 style="font-size:20px">Password reset</h1>
<p>Hi ${escHtml(ctx.displayName)}, we received a request to reset your password.</p>
<p><a href="${escHtml(ctx.resetUrl)}" style="color:#2f5d50">Choose a new password →</a></p>
<p style="font-size:13px;color:#6b6b66">If you didn't request this, you can safely ignore this email.</p>`
  );
  return { subject, html, text };
}

export interface CommentNotificationContext {
  siteName: string;
  postTitle: string;
  commentAuthor: string;
  commentExcerpt: string;
  moderationUrl: string;
}

export function commentNotificationEmail(
  ctx: CommentNotificationContext
): RenderedEmail {
  const subject = `New comment on “${ctx.postTitle}”`;
  const text = `${ctx.commentAuthor} commented on "${ctx.postTitle}":

${ctx.commentExcerpt}

Moderate: ${ctx.moderationUrl}`;
  const html = layout(
    ctx.siteName,
    `<h1 style="font-size:20px">New comment</h1>
<p><strong>${escHtml(ctx.commentAuthor)}</strong> commented on “${escHtml(ctx.postTitle)}”:</p>
<blockquote style="border-left:3px solid #2f5d50;padding-left:12px;color:#444">${escHtml(ctx.commentExcerpt)}</blockquote>
<p><a href="${escHtml(ctx.moderationUrl)}" style="color:#2f5d50">Moderate comments →</a></p>`
  );
  return { subject, html, text };
}
