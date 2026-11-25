import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanFilePart,
  contentDisposition,
  downloadFileName,
  fileDate,
  fileDateTime,
  filenameFromDisposition,
  paymentFileDate,
} from "../lib/download-filename";

const TZ = "Asia/Karachi";

test("file dates are readable and use no characters Windows rejects", () => {
  const at = new Date("2026-11-25T10:45:00Z"); // 3:45 PM in Karachi
  assert.equal(fileDate(at, TZ), "25 Nov 2026");
  assert.equal(fileDateTime(at, TZ), "25 Nov 2026 3.45 PM");
});

test("downloadFileName joins parts and drops empty ones and bad characters", () => {
  assert.equal(downloadFileName(["Receipt", "Ali Khan", "25 Nov 2026"], "pdf"), "Receipt - Ali Khan - 25 Nov 2026.pdf");
  assert.equal(downloadFileName(["Receipt", "", null, "A/B: C?"], "pdf"), "Receipt - A B C.pdf");
  assert.equal(downloadFileName([], "pdf"), "Download.pdf");
  assert.equal(cleanFilePart("  Iron   Gym.  "), "Iron Gym");
});

test("receipt time comes from when the payment was recorded, only on the same day", () => {
  const recorded = new Date("2026-11-25T10:45:00Z");
  assert.equal(paymentFileDate(new Date("2026-11-24T19:00:00Z"), recorded, TZ), "25 Nov 2026 3.45 PM"); // midnight 25 Nov in Karachi
  assert.equal(paymentFileDate(new Date("2026-11-20T19:00:00Z"), recorded, TZ), "21 Nov 2026"); // back-dated: day only
});

test("Content-Disposition round-trips names with spaces and non-English letters", () => {
  for (const name of ["Receipt - Ali Khan - 25 Nov 2026 3.45 PM.pdf", "Receipt - علی خان - 25 Nov 2026.pdf", "Report - O'Brien (Main).xlsx"]) {
    const header = contentDisposition(name);
    assert.match(header, /^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
    assert.equal(filenameFromDisposition(header, "x"), name);
  }
});

test("filenameFromDisposition falls back when the header is missing or plain", () => {
  assert.equal(filenameFromDisposition(undefined, "Receipt.pdf"), "Receipt.pdf");
  assert.equal(filenameFromDisposition('attachment; filename="a b.pdf"', "x"), "a b.pdf");
});
