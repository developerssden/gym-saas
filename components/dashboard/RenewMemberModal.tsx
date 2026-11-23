"use client";

import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/forms/responsive-dialog";
import { MembershipForm } from "@/components/membersubscriptions/MembershipForm";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate, paymentMethodLabel } from "@/lib/format";

interface RenewMemberModalProps {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  /** Their last plan, used when no fee is remembered for that length. */
  defaultPrice: number;
  defaultBillingModel: string;
}

/** Renew a membership: length presets, fee, discount, and the fee now with how it was paid. */
export default function RenewMemberModal({
  open,
  onClose,
  memberId,
  memberName,
  defaultPrice,
  defaultBillingModel,
}: RenewMemberModalProps) {
  const { data: session } = useSession();
  const { can } = usePermissions();
  const { format } = useGymCurrency();

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Renew ${memberName}`}
      description="Starts today. Days left on their current membership are added on."
    >
      <MembershipForm
        mode="renew"
        layout="dialog"
        memberId={memberId}
        gymId={session?.user?.selected_gym_id}
        canTakeFee={can("payments.record") || can("membersubscriptions.renew")}
        defaultMonths={defaultBillingModel === "YEARLY" ? 12 : 1}
        defaultPrice={defaultPrice}
        onCancel={onClose}
        onSaved={(r) => {
          const until = r.endDate ? ` until ${formatDate(r.endDate)}` : "";
          const owes = r.due - r.paid;
          toast.success(
            r.paid > 0
              ? `Renewed ${memberName}${until}. Took ${format(r.paid)} · ${paymentMethodLabel(r.method)}${owes > 0 ? `, ${format(owes)} still to collect` : ""}.`
              : `Renewed ${memberName}${until}. ${format(r.due)} to collect.`,
          );
          onClose();
        }}
      />
    </ResponsiveDialog>
  );
}
