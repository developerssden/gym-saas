import assert from "node:assert/strict";
import test from "node:test";
import { customPlanEmailUrl, customPlanWhatsAppUrl, shortPlanName } from "@/lib/plan-pricing";

test("short plan name drops a trailing 'Plan' so messages don't repeat it", () => {
  assert.equal(shortPlanName("Pro Plan"), "Pro");
  assert.equal(shortPlanName("  pro plan "), "pro");
  assert.equal(shortPlanName("Pro"), "Pro");
  assert.equal(shortPlanName("Planet Fitness"), "Planet Fitness");
  assert.equal(shortPlanName("Plan"), "Plan");
});

test("messages for a plan named 'Pro Plan' say 'Pro plan' once", () => {
  const text = new URL(customPlanWhatsAppUrl("Pro Plan", "923001234567")).searchParams.get("text");
  assert.equal(text, "Hi, I'm interested in the Kettlio Pro plan for my gym.");
  const params = new URLSearchParams(customPlanEmailUrl("Pro Plan", "a@b.com").split("?")[1]);
  assert.equal(params.get("subject"), "Kettlio Pro plan");
});

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
