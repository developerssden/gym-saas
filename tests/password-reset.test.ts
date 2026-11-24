import assert from "node:assert/strict";
import test from "node:test";
import {
  EMAIL_PATTERN,
  RESET_TOKEN_TTL_MINUTES,
  inCooldown,
  normalizeEmail,
  resetTokenExpiry,
  resetTokenProblem,
} from "@/lib/password-reset";

const now = new Date("2026-11-24T10:00:00Z");
const active = { is_active: true, is_deleted: false };

test("a reset link lasts one hour", () => {
  assert.equal(resetTokenExpiry(now).getTime() - now.getTime(), RESET_TOKEN_TTL_MINUTES * 60_000);
  assert.equal(RESET_TOKEN_TTL_MINUTES, 60);
});

test("a fresh, unused link for an active account works", () => {
  assert.equal(resetTokenProblem({ used: false, expires_at: resetTokenExpiry(now), user: active }, now), null);
});

test("used, expired, unknown and deactivated links are refused", () => {
  assert.equal(resetTokenProblem(null, now), "invalid");
  assert.equal(resetTokenProblem({ used: true, expires_at: resetTokenExpiry(now), user: active }, now), "used");
  assert.equal(
    resetTokenProblem({ used: false, expires_at: new Date(now.getTime() - 1), user: active }, now),
    "expired"
  );
  assert.equal(
    resetTokenProblem({ used: false, expires_at: resetTokenExpiry(now), user: { is_active: false, is_deleted: false } }, now),
    "invalid"
  );
  assert.equal(
    resetTokenProblem({ used: false, expires_at: resetTokenExpiry(now), user: { is_active: true, is_deleted: true } }, now),
    "invalid"
  );
});

test("only one reset email a minute per account", () => {
  assert.equal(inCooldown(null, now), false);
  assert.equal(inCooldown(new Date(now.getTime() - 30_000), now), true);
  assert.equal(inCooldown(new Date(now.getTime() - 61_000), now), false);
});

test("emails are trimmed and lower-cased before lookup", () => {
  assert.equal(normalizeEmail("  Ali@Gym.COM "), "ali@gym.com");
  assert.equal(normalizeEmail(undefined), "");
  assert.ok(EMAIL_PATTERN.test("ali@gym.com"));
  assert.ok(!EMAIL_PATTERN.test("ali@gym"));
});
