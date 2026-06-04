import { hooks } from "../hooks.js";
import {
  welcomeEmail,
  passwordResetEmail,
  commentNotificationEmail,
  type WelcomeContext,
  type PasswordResetContext,
  type CommentNotificationContext,
} from "./templates.js";
import type { EmailMessage, EmailTransport, RenderedEmail } from "./types.js";

export interface EmailServiceConfig {
  /** Envelope From address, e.g. "Presslyn <no-reply@example.com>". */
  fromAddress: string;
  /** Site name used in templates. */
  siteName: string;
}

/**
 * High-level email service. Renders templates, fills the envelope, applies the
 * `email_message` filter, dispatches through the configured transport, and
 * fires the `email_sent` action. Transport failures propagate to the caller.
 */
export class EmailService {
  constructor(
    private readonly transport: EmailTransport,
    private readonly config: EmailServiceConfig
  ) {}

  /** Send a pre-rendered email to a recipient. */
  async send(to: string, rendered: RenderedEmail): Promise<void> {
    const base: EmailMessage = {
      to,
      from: this.config.fromAddress,
      ...rendered,
    };
    const message = (await hooks.applyFilters(
      "email_message",
      base
    )) as EmailMessage;
    await this.transport.send(message);
    await hooks.doAction("email_sent", message);
  }

  async sendWelcome(
    to: string,
    ctx: Omit<WelcomeContext, "siteName">
  ): Promise<void> {
    await this.send(to, welcomeEmail({ ...ctx, siteName: this.config.siteName }));
  }

  async sendPasswordReset(
    to: string,
    ctx: Omit<PasswordResetContext, "siteName">
  ): Promise<void> {
    await this.send(
      to,
      passwordResetEmail({ ...ctx, siteName: this.config.siteName })
    );
  }

  async sendCommentNotification(
    to: string,
    ctx: Omit<CommentNotificationContext, "siteName">
  ): Promise<void> {
    await this.send(
      to,
      commentNotificationEmail({ ...ctx, siteName: this.config.siteName })
    );
  }
}
