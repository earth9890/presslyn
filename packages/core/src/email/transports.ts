import type { EmailMessage, EmailTransport } from "./types.js";

/**
 * Default development transport — logs the message instead of sending. Lets
 * the rest of the system run without SMTP configured.
 */
export class LogTransport implements EmailTransport {
  constructor(private readonly logger: (msg: string) => void = console.log) {}

  async send(message: EmailMessage): Promise<void> {
    this.logger(
      `[email] to=${message.to} subject="${message.subject}" (not sent — LogTransport)`
    );
  }
}

/**
 * In-memory transport for tests — records every message sent.
 */
export class CapturingTransport implements EmailTransport {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }

  get last(): EmailMessage | undefined {
    return this.sent[this.sent.length - 1];
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth?: { user: string; pass: string };
}

/**
 * SMTP transport backed by nodemailer. Nodemailer is imported lazily so the
 * dependency is only loaded when SMTP is actually used (tests and the
 * LogTransport path never touch it).
 */
export class SmtpTransport implements EmailTransport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transporter: any;

  constructor(private readonly config: SmtpConfig) {}

  async send(message: EmailMessage): Promise<void> {
    if (!this.transporter) {
      const nodemailer = await import("nodemailer");
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure ?? this.config.port === 465,
        auth: this.config.auth,
      });
    }
    await this.transporter.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}

/**
 * Build a transport from environment configuration. Returns an
 * {@link SmtpTransport} when SMTP_HOST is set, otherwise a {@link LogTransport}.
 */
export function transportFromEnv(
  env: Record<string, string | undefined> = process.env
): EmailTransport {
  if (env.SMTP_HOST) {
    return new SmtpTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
      secure: env.SMTP_SECURE === "true",
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });
  }
  return new LogTransport();
}
