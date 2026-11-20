import assert from "node:assert/strict";
import test from "node:test";
import {
  amountDue,
  parseMoney,
  summarizeBalance,
  validateFeeInput,
} from "@/lib/member-balance";

test("amount due = price - discount + admission fee", () => {
  assert.equal(amountDue({ price: 3000 }), 3000);
  assert.equal(amountDue({ price: 3000, discount: 500 }), 2500);
  assert.equal(amountDue({ price: 3000, discount: 500, admission_fee: 1000 }), 3500);
  assert.equal(amountDue({ price: 3000, discount: null, admission_fee: null }), 3000);
});

test("amount due never goes negative from a bad discount", () => {
  assert.equal(amountDue({ price: 3000, discount: 5000 }), 0);
  assert.equal(amountDue({ price: 3000, discount: -100 }), 3000);
  assert.equal(amountDue({ price: 3000, admission_fee: -100 }), 3000);
});

test("a partial payment leaves the rest as balance", () => {
  assert.deepEqual(summarizeBalance({ price: 3000 }, [{ amount: 2000 }]), {
    amount_due: 3000,
    amount_paid: 2000,
    balance: 1000,
    overpaid: 0,
  });
});

test("existing fully-paid subscriptions (defaults, one full payment) have balance 0", () => {
  const legacy = { price: 3000, discount: 0, admission_fee: 0 };
  assert.equal(summarizeBalance(legacy, [{ amount: 3000 }]).balance, 0);
});

test("several instalments add up; nothing paid means the whole amount is owed", () => {
  const fee = { price: 8000, discount: 1000, admission_fee: 1500 }; // due 8500
  assert.equal(summarizeBalance(fee, []).balance, 8500);
  assert.equal(summarizeBalance(fee, [{ amount: 3000 }, { amount: 2500 }]).balance, 3000);
  assert.equal(summarizeBalance(fee, [{ amount: 3000 }, { amount: 5500 }]).balance, 0);
});

test("overpayment shows as overpaid, never as a negative balance", () => {
  const s = summarizeBalance({ price: 3000, discount: 1000 }, [{ amount: 3000 }]);
  assert.equal(s.balance, 0);
  assert.equal(s.overpaid, 1000);
});

test("parseMoney: blanks use the fallback, whole numbers parse, anything else is NaN", () => {
  assert.equal(parseMoney(undefined, 0), 0);
  assert.equal(parseMoney("", 7), 7);
  assert.equal(parseMoney(null, 5), 5);
  assert.equal(parseMoney(2500, 0), 2500);
  assert.equal(parseMoney(" 2500 ", 0), 2500);
  assert.ok(Number.isNaN(parseMoney("12.5", 0)));
  assert.ok(Number.isNaN(parseMoney("abc", 0)));
});

test("validateFeeInput accepts sensible fees, including paying nothing now", () => {
  assert.equal(validateFeeInput({ price: 3000, discount: 0, admission_fee: 0, amount_paid: 3000 }), null);
  assert.equal(validateFeeInput({ price: 3000, discount: 500, admission_fee: 1000, amount_paid: 0 }), null);
  assert.equal(validateFeeInput({ price: 3000, discount: 3000, admission_fee: 0, amount_paid: 0 }), null);
  assert.equal(validateFeeInput({ price: 3000, discount: 0, admission_fee: 0 }), null); // editing: no payment
});

test("validateFeeInput rejects impossible fees with a readable message", () => {
  const base = { price: 3000, discount: 0, admission_fee: 0 };
  assert.match(validateFeeInput({ ...base, price: 0 })!, /Price/);
  assert.match(validateFeeInput({ ...base, price: Number.NaN })!, /Price/);
  assert.match(validateFeeInput({ ...base, discount: -1 })!, /Discount/);
  assert.match(validateFeeInput({ ...base, discount: 3001 })!, /more than the price/);
  assert.match(validateFeeInput({ ...base, admission_fee: -5 })!, /Admission fee/);
  assert.match(validateFeeInput({ ...base, amount_paid: -1 })!, /Amount paid/);
  assert.match(
    validateFeeInput({ price: 3000, discount: 500, admission_fee: 0, amount_paid: 2501 })!,
    /more than the amount due \(2500\)/
  );
});
