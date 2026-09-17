import "./setup";
import { describe, expect, test } from "bun:test";
import { escapeHtml } from "@/email/templates/escape";
import { resolveRecipient } from "@/email/recipient";
import { verificationEmail } from "@/email/templates/verify-email";
import { resetPasswordEmail } from "@/email/templates/reset-password";
import { twoFactorCodeEmail } from "@/email/templates/two-factor-code";
import { recoverAccountEmail } from "@/email/templates/recover-account";
import { accountDeletionEmail } from "@/email/templates/delete-account";
import {
  newDeviceLoginEmail,
  passwordChangedEmail,
} from "@/email/templates/security-alert";

describe("escapeHtml", () => {
  test("escapes every markup metacharacter", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  test("coerces numbers", () => {
    expect(escapeHtml(30)).toBe("30");
  });
});

describe("resolveRecipient", () => {
  const devInbox = "dev@example.com";

  test("non-prod always redirects to DEV_INBOX", () => {
    expect(
      resolveRecipient({ isProduction: false, to: "user@example.com", devInbox }),
    ).toEqual({ action: "send", recipient: devInbox });
  });

  test("non-prod with no DEV_INBOX skips", () => {
    expect(
      resolveRecipient({ isProduction: false, to: "user@example.com", devInbox: "" }),
    ).toEqual({ action: "skip" });
  });

  test("prod sends to the given recipient", () => {
    expect(
      resolveRecipient({ isProduction: true, to: "user@example.com", devInbox }),
    ).toEqual({ action: "send", recipient: "user@example.com" });
  });

  test("prod with a null recipient fails loudly instead of falling back to the dev inbox", () => {
    expect(() =>
      resolveRecipient({ isProduction: true, to: null, devInbox }),
    ).toThrow("non-null recipient");
  });
});

describe("email templates escape user-controlled input", () => {
  const hostile = `<img src=x onerror=alert(1)>`;

  test("verify-email escapes userName", () => {
    const html = verificationEmail(hostile, "https://app.example/t");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
  });

  test("verify-email attribute-escapes the link", () => {
    const href = `https://app.example/t" onmouseover="alert(1)`;
    const html = verificationEmail("bob", href);
    expect(
      html,
    ).toContain(`href="https://app.example/t&quot; onmouseover=&quot;alert(1)"`);
  });

  test("reset-password escapes userName and both link contexts", () => {
    const html = resetPasswordEmail(hostile, 'https://app.example/r"');
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain(`href="${'https://app.example/r"'}">`);
  });

  test("two-factor-code escapes userName and code", () => {
    const html = twoFactorCodeEmail(hostile, `<code>`, 10);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;code&gt;");
  });

  test("recover-account escapes userName and link", () => {
    const html = recoverAccountEmail(hostile, "https://app.example/rec");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
  });

  test("delete-account escapes userName and deletion time", () => {
    const html = accountDeletionEmail(hostile, `<b>now</b>`);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;b&gt;now&lt;/b&gt;");
  });

  test("security-alert escapes userName, userAgent, and occurred", () => {
    const login = newDeviceLoginEmail(hostile, `<b>nasty-ua</b>`);
    expect(login).toContain("&lt;img");
    expect(login).not.toContain("<img");
    expect(login).toContain("&lt;b&gt;nasty-ua&lt;/b&gt;");

    const changed = passwordChangedEmail(hostile, `sometime <script>`);
    expect(changed).toContain("&lt;img");
    expect(changed).not.toContain("<img");
    expect(changed).toContain("&lt;script&gt;");
  });
});