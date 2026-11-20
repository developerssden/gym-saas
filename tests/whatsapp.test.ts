import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFeeReminderMessage,
  buildReceiptMessage,
  buildWhatsAppUrl,
  callingCodeForCountry,
  toWhatsAppNumber,
} from "@/lib/whatsapp";

test("Pakistani numbers in any common format become 92XXXXXXXXXX", () => {
  for (const input of [
    "0300 1234567",
    "0300-1234567",
    "+92 300 1234567",
    "+92-300-1234567",
    "0092 300 1234567",
    "923001234567",
    "3001234567",
  ]) {
    assert.equal(toWhatsAppNumber(input, "PK"), "923001234567", input);
  }
});

test("missing country falls back to Pakistan; other countries use their code", () => {
  assert.equal(toWhatsAppNumber("0300 1234567"), "923001234567");
  assert.equal(callingCodeForCountry("GB"), "44");
  assert.equal(toWhatsAppNumber("07700 900123", "GB"), "447700900123");
  assert.equal(toWhatsAppNumber("+1 415 555 0100", "PK"), "14155550100");
});

test("empty or impossible numbers return null", () => {
  for (const input of [null, undefined, "", "   ", "abc", "12345", "+92 300 1234567 1234567"]) {
    assert.equal(toWhatsAppNumber(input as string | null | undefined, "PK"), null, String(input));
  }
});

test("wa.me URL encodes the message, with or without a number", () => {
  assert.equal(
    buildWhatsAppUrl("923001234567", "Fee due & thanks"),
    "https://wa.me/923001234567?text=Fee%20due%20%26%20thanks"
  );
  assert.equal(buildWhatsAppUrl(null, "Hi"), "https://wa.me/?text=Hi");
});

const now = new Date(2026, 10, 20, 10, 0); // 20 Nov 2026, local time

test("due-soon reminder uses first name, amount and a friendly date", () => {
  const base = { memberName: "Ali Raza", gymName: "Iron Zone Gym", amount: "Rs 3,000", isExpired: false, now };

  assert.equal(
    buildFeeReminderMessage({ ...base, endDate: new Date(2026, 10, 21) }),
    "Assalam o Alaikum Ali, a reminder that your gym fee of Rs 3,000 is due tomorrow (21 Nov). Please pay at the front desk to keep your membership active. Thank you!\n\n— Iron Zone Gym"
  );
  assert.match(buildFeeReminderMessage({ ...base, endDate: new Date(2026, 10, 20) }), /is due today \(20 Nov\)/);
  assert.match(buildFeeReminderMessage({ ...base, endDate: new Date(2026, 10, 25) }), /is due on 25 Nov\./);
});

test("expired reminder invites the member back; no signature without a gym name", () => {
  const message = buildFeeReminderMessage({
    memberName: "Hamza",
    amount: "Rs 3,000",
    endDate: new Date(2026, 10, 15),
    isExpired: true,
    now,
  });
  assert.equal(
    message,
    "Assalam o Alaikum Hamza, your gym membership ended on 15 Nov. Renew for Rs 3,000 to keep training — we'd love to see you back!"
  );
});

test("receipt message thanks the member for the payment", () => {
  assert.equal(
    buildReceiptMessage({
      memberName: "Usman Butt",
      gymName: "Iron Zone Gym",
      amount: "Rs 8,000",
      paymentDate: new Date(2026, 10, 18),
    }),
    "Assalam o Alaikum Usman, thank you for your payment of Rs 8,000 on 18 Nov at Iron Zone Gym. Your receipt is attached.\n\n— Iron Zone Gym"
  );
});
