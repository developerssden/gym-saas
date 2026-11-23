import { test } from "node:test";
import assert from "node:assert/strict";
import { memberPaymentSearchWhere, ownerPaymentSearchWhere } from "@/lib/payments/payment-search";

test("empty or missing search adds no filter", () => {
  for (const s of [undefined, null, "", "   ", 42]) {
    assert.equal(memberPaymentSearchWhere(s), null);
    assert.equal(ownerPaymentSearchWhere(s), null);
  }
});

test("member search matches transaction ID and member name, email, phone (trimmed)", () => {
  const where = memberPaymentSearchWhere("  Ali  ");
  assert.deepEqual(where?.OR?.[0], { transaction_id: { contains: "Ali", mode: "insensitive" } });
  const userOr = (where?.OR?.[1] as { memberSubscription: { member: { user: { OR: unknown[] } } } })
    .memberSubscription.member.user.OR;
  assert.deepEqual(userOr, [
    { first_name: { contains: "Ali", mode: "insensitive" } },
    { last_name: { contains: "Ali", mode: "insensitive" } },
    { email: { contains: "Ali", mode: "insensitive" } },
    { phone_number: { contains: "Ali", mode: "insensitive" } },
  ]);
  assert.equal(where?.OR?.length, 2);
});

test("phone matches in any format are included as member ids", () => {
  const where = memberPaymentSearchWhere("0301 84", ["m1", "m2"]);
  assert.deepEqual(where?.OR?.[2], { memberSubscription: { member_id: { in: ["m1", "m2"] } } });
});

test("owner search matches transaction ID and owner details", () => {
  const where = ownerPaymentSearchWhere("TX-9");
  assert.deepEqual(where?.OR?.[0], { transaction_id: { contains: "TX-9", mode: "insensitive" } });
  assert.ok("ownerSubscription" in (where?.OR?.[1] ?? {}));
});
