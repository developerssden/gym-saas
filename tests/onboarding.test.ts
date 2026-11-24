import assert from "node:assert/strict";
import test from "node:test";
import { missingInviteFields, newPasswordErrors, onboardingErrors } from "@/lib/onboarding";

const valid = {
  first_name: "Sara",
  last_name: "",
  phone_number: "+923012345678",
  password: "secret1",
  confirm_password: "secret1",
};

test("name, phone and a matching password are enough; last name is optional", () => {
  assert.deepEqual(onboardingErrors(valid), {});
});

test("each missing field gets its own message", () => {
  const errors = onboardingErrors({ first_name: " ", last_name: "", phone_number: "", password: "", confirm_password: "" });
  assert.deepEqual(Object.keys(errors).sort(), ["first_name", "password", "phone_number"]);
  assert.equal(onboardingErrors({ ...valid, phone_number: "+92 30" }).phone_number, "That number looks too short");
});

test("new password: at least 6 characters and typed the same twice", () => {
  assert.equal(newPasswordErrors("abc", "abc").password, "Use at least 6 characters");
  assert.equal(newPasswordErrors("abcdef", "abcdeg").confirm_password, "The two passwords don't match");
  assert.deepEqual(newPasswordErrors("abcdef", "abcdef"), {});
});

test("the invite API needs only a first name and phone (no address or date of birth)", () => {
  assert.deepEqual(missingInviteFields({ first_name: "Sara", phone_number: "+923012345678" }), []);
  assert.deepEqual(missingInviteFields({ first_name: "", phone_number: undefined }), ["first_name", "phone_number"]);
});
