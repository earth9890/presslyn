import { describe, it, expect, beforeEach } from "vitest";
import { EmailService } from "./email.service.js";
import { CapturingTransport } from "./transports.js";
import { welcomeEmail, passwordResetEmail } from "./templates.js";
import { hooks } from "../hooks.js";

describe("EmailService", () => {
  let transport: CapturingTransport;
  let service: EmailService;

  beforeEach(() => {
    transport = new CapturingTransport();
    service = new EmailService(transport, {
      fromAddress: "Presslyn <no-reply@example.com>",
      siteName: "Test Site",
    });
  });

  it("sends a welcome email with envelope and rendered content", async () => {
    await service.sendWelcome("user@example.com", {
      displayName: "Ada",
      loginUrl: "https://example.com/login",
    });
    const msg = transport.last!;
    expect(msg.to).toBe("user@example.com");
    expect(msg.from).toBe("Presslyn <no-reply@example.com>");
    expect(msg.subject).toBe("Welcome to Test Site");
    expect(msg.html).toContain("Ada");
    expect(msg.html).toContain("https://example.com/login");
    expect(msg.text).toContain("Ada");
  });

  it("sends a password reset email", async () => {
    await service.sendPasswordReset("user@example.com", {
      displayName: "Ada",
      resetUrl: "https://example.com/reset?t=abc",
    });
    expect(transport.last!.subject).toBe("Reset your Test Site password");
    expect(transport.last!.html).toContain("reset?t=abc");
  });

  it("applies the email_message filter before sending", async () => {
    hooks.addFilter(
      "email_message",
      (msg: any) => ({ ...msg, subject: `[tagged] ${msg.subject}` }),
      10,
      "test-tag-filter"
    );
    try {
      await service.sendWelcome("u@example.com", {
        displayName: "X",
        loginUrl: "https://e.com",
      });
      expect(transport.last!.subject).toBe("[tagged] Welcome to Test Site");
    } finally {
      hooks.removeFilter("email_message", "test-tag-filter");
    }
  });

  it("fires the email_sent action", async () => {
    let fired: string | null = null;
    hooks.addAction(
      "email_sent",
      (msg: any) => {
        fired = msg.to;
      },
      10,
      "test-sent-action"
    );
    try {
      await service.send("hook@example.com", {
        subject: "s",
        html: "<p>h</p>",
        text: "h",
      });
      expect(fired).toBe("hook@example.com");
    } finally {
      hooks.removeAction("email_sent", "test-sent-action");
    }
  });

  it("escapes HTML in template fields", () => {
    const email = welcomeEmail({
      siteName: "Site",
      displayName: "<script>x</script>",
      loginUrl: "https://e.com",
    });
    expect(email.html).not.toContain("<script>x</script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("password reset text includes an ignore note", () => {
    const email = passwordResetEmail({
      siteName: "Site",
      displayName: "A",
      resetUrl: "https://e.com/r",
    });
    expect(email.text.toLowerCase()).toContain("ignore");
  });
});
