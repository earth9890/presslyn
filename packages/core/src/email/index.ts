export { EmailService, type EmailServiceConfig } from "./email.service.js";
export {
  LogTransport,
  CapturingTransport,
  SmtpTransport,
  transportFromEnv,
  type SmtpConfig,
} from "./transports.js";
export {
  welcomeEmail,
  passwordResetEmail,
  commentNotificationEmail,
  type WelcomeContext,
  type PasswordResetContext,
  type CommentNotificationContext,
} from "./templates.js";
export type { EmailMessage, EmailTransport, RenderedEmail } from "./types.js";
