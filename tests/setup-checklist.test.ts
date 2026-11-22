import assert from "node:assert/strict";
import test from "node:test";
import { buildSetupSteps, nextSetupStep, setupComplete, type SetupProgress } from "@/lib/setup-checklist";

const none: SetupProgress = { gym: false, location: false, members: false, payment: false, notifications: false };
const all: SetupProgress = { gym: true, location: true, members: true, payment: true, notifications: true };

test("steps follow the setup order from the issue", () => {
  assert.deepEqual(
    buildSetupSteps(none, false).map(s => s.id),
    ["gym", "location", "members", "payment", "notifications", "install"]
  );
});

test("progress comes from data; next step is the first not done", () => {
  const steps = buildSetupSteps({ ...none, gym: true, location: true, payment: true }, false);
  assert.deepEqual(steps.filter(s => s.done).map(s => s.id), ["gym", "location", "payment"]);
  assert.equal(nextSetupStep(steps)?.id, "members");
  assert.equal(setupComplete(steps), false);
});

test("complete only when every step, including install, is done", () => {
  assert.equal(setupComplete(buildSetupSteps(all, false)), false);
  assert.equal(nextSetupStep(buildSetupSteps(all, false))?.id, "install");
  assert.equal(setupComplete(buildSetupSteps(all, true)), true);
  assert.equal(nextSetupStep(buildSetupSteps(all, true)), undefined);
});
