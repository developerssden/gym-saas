import { test } from "node:test";
import assert from "node:assert/strict";
import { planUsage } from "@/lib/plan-usage";

test("plan usage reads like '2 of 3 branches used'", () => {
  assert.deepEqual(planUsage(2, 3, "branch", "branches"), { text: "2 of 3 branches used", percent: 67, atLimit: false, nearLimit: true });
  assert.deepEqual(planUsage(3, 3, "branch", "branches"), { text: "3 of 3 branches used", percent: 100, atLimit: true, nearLimit: false });
  assert.deepEqual(planUsage(1, 5, "gym"), { text: "1 of 5 gyms used", percent: 20, atLimit: false, nearLimit: false });
  assert.equal(planUsage(0, 1, "gym").text, "0 of 1 gym used");
});

test("no limit: just the count", () => {
  assert.deepEqual(planUsage(2, null, "gym"), { text: "2 gyms", percent: 0, atLimit: false, nearLimit: false });
  assert.equal(planUsage(1, undefined, "gym").text, "1 gym");
});
