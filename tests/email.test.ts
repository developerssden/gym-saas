import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml } from "@/lib/email/escape-html";
import {
  getOwnerReminderEmail,
  getSuperAdminSummaryEmail,
} from "@/lib/email/subscription-emails";
import { buildInviteEmailHtml } from "@/lib/invite-email";

test("escapes all HTML-significant characters", () => {
  assert.equal(
    escapeHtml(`&<>"'`),
    "&amp;&lt;&gt;&quot;&#39;"
  );
});

test("subscription email HTML escapes database-controlled values", () => {
  const malicious = `<img src=x onerror="alert('x')">`;
  const email = getOwnerReminderEmail(malicious, 2, `Gold & <Elite>`);

  assert.equal(email.html.includes("<img"), false);
  assert.match(email.html, /&lt;img/);
  assert.match(email.html, /Gold &amp; &lt;Elite&gt;/);
  assert.match(email.text, /<img/);
});

test("summary email HTML escapes names, addresses, and plan names", () => {
  const email = getSuperAdminSummaryEmail([
    {
      name: "<Owner>",
      email: '"owner"@example.com',
      planName: "A&B",
    },
  ]);

  assert.match(email.html, /&lt;Owner&gt;/);
  assert.match(email.html, /&quot;owner&quot;@example.com/);
  assert.match(email.html, /A&amp;B/);
});

test("invite links are escaped at the HTML attribute boundary", () => {
  const html = buildInviteEmailHtml(
    `https://example.com/invite?next="><script>alert(1)</script>`
  );

  assert.equal(html.includes("<script>"), false);
  assert.match(html, /&quot;&gt;&lt;script&gt;/);
});
