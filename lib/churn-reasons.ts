/** Why a member left. Values are stored on MemberSubscription.churn_reason. */
export const CHURN_REASONS = [
  { value: "TOO_EXPENSIVE", label: "Too expensive" },
  { value: "STOPPED_COMING", label: "Stopped coming" },
  { value: "MOVED", label: "Moved away" },
  { value: "SWITCHED_GYM", label: "Switched to another gym" },
  { value: "MEDICAL", label: "Medical / health reasons" },
  { value: "OTHER", label: "Other" },
];

export function churnReasonLabel(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  return CHURN_REASONS.find((r) => r.value === value)?.label ?? value;
}
