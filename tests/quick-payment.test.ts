import assert from "node:assert/strict";
import test from "node:test";
import { phoneSearchDigits } from "@/lib/members/phone-digits";
import { decideFeeAction, type QuickSubscription } from "@/lib/quick-payment";

const digitsOnly = (s: string) => s.replace(/\D/g, "");
const matches = (search: string, stored: string) =>
  (phoneSearchDigits(search) ?? []).some(d => digitsOnly(stored).includes(d));

test("phone search ignores formatting, the national 0 and +92", () => {
  assert.deepEqual(phoneSearchDigits("0301 84"), ["30184"]);
  assert.deepEqual(phoneSearchDigits("+92 301-84"), ["9230184", "30184"]);
  assert.deepEqual(phoneSearchDigits("0092 301 84"), ["9230184", "30184"]);
  // The example from the issue: "0301 84" finds a member stored as "+92301 84…".
  assert.ok(matches("0301 84", "+923018412345"));
  assert.ok(matches("+92 301 84", "03018412345"));
  assert.ok(matches("301-841", "+92 301 8412345"));
  assert.ok(!matches("0301 85", "+923018412345"));
});

test("names, emails and very short numbers are not phone searches", () => {
  for (const s of ["Ali", "ali@x.com", "Ali 0301", "01", "", "  ", "+"]) {
    assert.equal(phoneSearchDigits(s), null, s);
  }
  assert.equal(phoneSearchDigits(undefined), null);
});

function sub(o: Partial<QuickSubscription>): QuickSubscription {
  return {
    id: "s",
    price: 3000,
    discount: 0,
    admission_fee: 0,
    billing_model: "MONTHLY",
    end_date: "2026-12-01T12:00:00.000Z",
    is_active: true,
    is_expired: false,
    createdAt: "2026-11-01T12:00:00.000Z",
    payments: [],
    ...o,
  };
}

test("collects the balance on the newest subscription that is owed", () => {
  const action = decideFeeAction([
    sub({ id: "old", createdAt: "2026-09-01T00:00:00Z", is_active: false, payments: [{ amount: 2000 }] }),
    sub({ id: "new", admission_fee: 1000, discount: 500, payments: [{ amount: 1500 }] }),
  ]);
  assert.equal(action.kind, "pay");
  if (action.kind === "pay") {
    assert.equal(action.subscriptionId, "new");
    assert.equal(action.amountDue, 3500);
    assert.equal(action.balance, 2000);
  }
});

test("older unpaid balance is still collected when the newest is paid", () => {
  const action = decideFeeAction([
    sub({ id: "old", createdAt: "2026-09-01T00:00:00Z", is_active: false }),
    sub({ id: "new", payments: [{ amount: 3000 }] }),
  ]);
  assert.equal(action.kind === "pay" && action.subscriptionId, "old");
});

test("paid and still running: nothing to pay", () => {
  const action = decideFeeAction([sub({ payments: [{ amount: 3000 }] })]);
  assert.deepEqual(action, { kind: "paid", paidUntil: "2026-12-01T12:00:00.000Z" });
});

test("ended and paid: renew on the same terms without the admission fee", () => {
  const monthly = decideFeeAction([
    sub({ is_expired: true, discount: 500, admission_fee: 1000, payments: [{ amount: 3500 }] }),
  ]);
  assert.equal(monthly.kind, "renew");
  if (monthly.kind === "renew") {
    assert.equal(monthly.months, 1);
    assert.equal(monthly.amountDue, 2500);
    assert.equal(monthly.discount, 500);
  }
  const yearly = decideFeeAction([
    sub({ billing_model: "YEARLY", price: 30000, is_active: false, payments: [{ amount: 30000 }] }),
  ]);
  assert.equal(yearly.kind === "renew" && yearly.months, 12);
  assert.equal(yearly.kind === "renew" && yearly.billingModel, "YEARLY");
});

test("no subscription yet", () => {
  assert.deepEqual(decideFeeAction([]), { kind: "none" });
});
