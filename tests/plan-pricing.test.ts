import assert from "node:assert/strict";
import test from "node:test";
import { customPlanEmailUrl, customPlanWhatsAppUrl } from "@/lib/plan-pricing";

test("custom plan WhatsApp link names the plan", () => {
  const url = new URL(customPlanWhatsAppUrl("Pro", "923001234567"));
  assert.equal(url.origin + url.pathname, "https://wa.me/923001234567");
  assert.equal(url.searchParams.get("text"), "Hi, I'm interested in the Kettlio Pro plan for my gym.");
});

test("custom plan email link has the plan in the subject and an encoded body", () => {
  const link = customPlanEmailUrl("Pro", "sales@example.com");
  assert.ok(link.startsWith("mailto:sales@example.com?"));
  const params = new URLSearchParams(link.split("?")[1]);
  assert.equal(params.get("subject"), "Kettlio Pro plan");
  assert.match(params.get("body") ?? "", /^Hi, I'm interested in the Kettlio Pro plan for my gym\.\n\nGym name:/);
  // Spaces must be %20, not "+", or mail apps show the plus signs.
  assert.ok(!link.includes("+"));
});
