/**
 * Email transport abstraction. Templates produce {@link RenderedEmail}; the
 * {@link EmailService} adds envelope info and hands a {@link EmailMessage} to
 * a {@link EmailTransport}. This keeps the service decoupled from any specific
 * delivery mechanism (SMTP, log, in-memory capture for tests).
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailMessage extends RenderedEmail {
  to: string;
  from: string;
}

export interface EmailTransport {
  /** Deliver a message. Implementations should throw on hard failures. */
  send(message: EmailMessage): Promise<void>;
}
