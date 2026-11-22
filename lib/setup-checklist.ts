// Setup checklist for new gym owners, shown on the dashboard until done.
// Progress comes from real data (setup-progress API) plus whether the app is
// installed on this device.
import { APP_NAME } from "@/constants/brand";

/** From GET /api/dashboard/setup-progress. */
export type SetupProgress = {
  gym: boolean;
  location: boolean;
  members: boolean;
  payment: boolean;
  /** This owner has a push subscription on at least one device. */
  notifications: boolean;
};

export type SetupStepId = keyof SetupProgress | "install";

export type SetupStep = {
  id: SetupStepId;
  title: string;
  description: string;
  done: boolean;
};

export function buildSetupSteps(progress: SetupProgress, installed: boolean): SetupStep[] {
  return [
    { id: "gym", title: "Add your gym", description: "Name, address and country (sets your currency).", done: progress.gym },
    { id: "location", title: "Add a location", description: "Each branch of your gym is a location.", done: progress.location },
    { id: "members", title: "Add your members", description: "Import them all from Excel, or add them one by one.", done: progress.members },
    { id: "payment", title: "Record your first payment", description: "Take a member's fee and share the receipt.", done: progress.payment },
    { id: "notifications", title: "Turn on notifications", description: "Get reminded when members' fees are due.", done: progress.notifications },
    { id: "install", title: "Install the app", description: `Open ${APP_NAME} from your home screen like any other app.`, done: installed },
  ];
}

export function setupComplete(steps: SetupStep[]): boolean {
  return steps.every(s => s.done);
}

/** The first step not done yet, which the checklist highlights. */
export function nextSetupStep(steps: SetupStep[]): SetupStep | undefined {
  return steps.find(s => !s.done);
}
