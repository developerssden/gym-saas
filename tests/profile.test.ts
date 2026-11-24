import assert from "node:assert/strict";
import test from "node:test";
import { accountErrors, accountPayload, accountValuesFrom, passwordErrors } from "@/lib/profile";

const filled = accountValuesFrom({ first_name: "Ali", phone_number: "0301 2345678" });

test("only first name and phone are required", () => {
  assert.deepEqual(accountErrors(filled), {});
  const errors = accountErrors(accountValuesFrom({}));
  assert.deepEqual(Object.keys(errors).sort(), ["first_name", "phone_number"]);
});

test("a too-short phone or a future birthday is flagged", () => {
  assert.equal(accountErrors({ ...filled, phone_number: "123" }).phone_number, "That number looks too short");
  const today = new Date("2026-11-24T12:00:00Z");
  assert.ok(accountErrors({ ...filled, date_of_birth: "2027-01-01" }, today).date_of_birth);
  assert.equal(accountErrors({ ...filled, date_of_birth: "1990-05-01" }, today).date_of_birth, undefined);
});

test("empty optional fields are sent as null, required ones trimmed", () => {
  const payload = accountPayload({ ...filled, first_name: "  Ali ", city: "  ", date_of_birth: "" });
  assert.equal(payload.first_name, "Ali");
  assert.equal(payload.city, null);
  assert.equal(payload.date_of_birth, null);
  assert.equal(payload.last_name, null);
});

test("a missing date of birth stays empty instead of defaulting to today", () => {
  assert.equal(accountValuesFrom({ date_of_birth: null }).date_of_birth, "");
  assert.equal(accountValuesFrom({ date_of_birth: "1990-05-01T00:00:00.000Z" }).date_of_birth, "1990-05-01");
});

test("password: current required, new at least 6 characters, confirmation must match", () => {
  assert.deepEqual(Object.keys(passwordErrors({ current_password: "", new_password: "", confirm_password: "" })).sort(), [
    "current_password",
    "new_password",
  ]);
  assert.ok(passwordErrors({ current_password: "x", new_password: "abc", confirm_password: "abc" }).new_password);
  assert.ok(passwordErrors({ current_password: "x", new_password: "abcdef", confirm_password: "abcdeg" }).confirm_password);
  assert.deepEqual(passwordErrors({ current_password: "x", new_password: "abcdef", confirm_password: "abcdef" }), {});
});
