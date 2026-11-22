"use client";

// Record a fee in three taps: open (1), pick the member (2), Save (3).
// The amount and method are pre-filled from what the member owes, or from
// their last subscription when it has ended (renew and pay in one step).
import { useState } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebounce } from "@/hooks/use-debounce";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/getErrorMessage";
import type { FeeAction } from "@/lib/quick-payment";

export type QuickPaymentMember = { id: string; name: string };

type MemberRow = {
  id: string;
  user: { first_name: string | null; last_name: string | null; phone_number: string | null };
  location?: { name: string } | null;
};

type FeeResponse = {
  member: { id: string; name: string; phone: string | null };
  action: FeeAction;
};

const memberName = (m: MemberRow) => `${m.user.first_name ?? ""} ${m.user.last_name ?? ""}`.trim() || "Member";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

type Props = {
  open: boolean;
  onClose: () => void;
  /** Skip the search when opened from a member's row. */
  member?: QuickPaymentMember | null;
};

export default function QuickPaymentDialog({ open, onClose, member }: Props) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="top-[10%] translate-y-0 sm:max-w-md">
        {/* Remount on open so it starts fresh each time. */}
        {open && <QuickPaymentFlow onClose={onClose} initialMember={member ?? null} />}
      </DialogContent>
    </Dialog>
  );
}

function QuickPaymentFlow({ onClose, initialMember }: { onClose: () => void; initialMember: QuickPaymentMember | null }) {
  const [picked, setPicked] = useState<QuickPaymentMember | null>(initialMember);

  if (!picked) return <MemberPicker onPick={setPicked} />;
  return (
    <FeeForm
      member={picked}
      onBack={initialMember ? undefined : () => setPicked(null)}
      onDone={onClose}
    />
  );
}

function MemberPicker({ onPick }: { onPick: (m: QuickPaymentMember) => void }) {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const gymId = session?.user?.selected_gym_id || undefined;
  const locationId = session?.user?.selected_location_id || undefined;

  const { data, isFetching } = useQuery({
    queryKey: ["quick-payment-members", debounced, gymId, locationId],
    queryFn: async () =>
      (
        await axios.post<{ data: MemberRow[] }>("/api/members/getmembers", {
          page: 1,
          limit: 8,
          search: debounced.trim(),
          gym_id: gymId,
          location_id: locationId,
        })
      ).data.data,
    enabled: debounced.trim().length >= 2,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>Find the member by name or phone number.</DialogDescription>
      </DialogHeader>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="e.g. Ali or 0301 234"
          className="h-11 pl-9"
          inputMode="search"
          aria-label="Search members"
        />
        {isFetching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {debounced.trim().length < 2 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Type at least 2 letters or digits.</p>
        ) : data && data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No members found.</p>
        ) : (
          <ul className="divide-y">
            {(data ?? []).map(m => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPick({ id: m.id, name: memberName(m) })}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="font-medium">{memberName(m)}</span>
                  <span className="text-sm text-muted-foreground">{m.user.phone_number || m.location?.name || ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function FeeForm({ member, onBack, onDone }: { member: QuickPaymentMember; onBack?: () => void; onDone: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["member-fee", member.id],
    queryFn: async () => (await axios.post<FeeResponse>("/api/payments/member-fee", { member_id: member.id })).data,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {onBack && (
            <Button type="button" variant="ghost" size="icon" className="-ml-2 size-8" onClick={onBack} aria-label="Pick another member">
              <ArrowLeft className="size-4" />
            </Button>
          )}
          {member.name}
        </DialogTitle>
        <DialogDescription>{data?.member.phone || "Record a payment"}</DialogDescription>
      </DialogHeader>
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{getErrorMessage(error)}</p>}
      {data && <FeeAmountForm member={member} action={data.action} onDone={onDone} />}
    </>
  );
}

function FeeAmountForm({ member, action, onDone }: { member: QuickPaymentMember; action: FeeAction; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { currencyCode, format } = useGymCurrency();
  const due = action.kind === "pay" ? action.balance : action.kind === "renew" ? action.amountDue : 0;
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [transactionId, setTransactionId] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      const payment = {
        payment_method: method,
        transaction_id: transactionId.trim() || undefined,
      };
      if (action.kind === "pay") {
        return axios.post("/api/payments/createpayment", {
          subscription_type: "MEMBER",
          member_subscription_id: action.subscriptionId,
          amount: value,
          ...payment,
        });
      }
      if (action.kind === "renew") {
        return axios.post("/api/membersubscriptions/renewmembersubscription-owner", {
          member_id: member.id,
          price: action.price,
          discount: action.discount,
          months: action.months,
          billing_model: action.billingModel,
          use_custom_dates: false,
          amount_paid: value,
          ...payment,
        });
      }
    },
    onSuccess: () => {
      const left = due - Number(amount);
      toast.success(
        action.kind === "renew"
          ? `Renewed and ${format(Number(amount))} recorded for ${member.name}.`
          : left > 0
            ? `Payment recorded. ${member.name} still owes ${format(left)}.`
            : `Payment recorded. ${member.name} has paid in full.`
      );
      for (const key of ["membersubscriptions", "payments", "members", "ownerDashboardOverview", "monthly-report", "member-fee", "setup-progress"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      onDone();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  if (action.kind === "none") {
    return <p className="py-4 text-sm text-muted-foreground">{member.name} has no subscription yet. Create one from Member Subscriptions.</p>;
  }
  if (action.kind === "paid") {
    return <p className="py-4 text-sm">Nothing to pay: fees are paid until <strong>{shortDate(action.paidUntil)}</strong>.</p>;
  }
  const allowed = action.kind === "pay" ? can("payments.record") : can("membersubscriptions.renew");
  if (!allowed) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        {action.kind === "renew"
          ? "Their subscription has ended. You don't have permission to renew it."
          : "You don't have permission to record payments."}
      </p>
    );
  }

  const value = Number(amount);
  const amountError =
    !amount.trim() || !Number.isInteger(value) || value <= 0
      ? "Enter a whole amount greater than 0"
      : value > due
        ? `Can't be more than ${format(due)}`
        : null;
  const needsTxn = method === "BANK_TRANSFER" && !transactionId.trim();

  return (
    <form
      className="grid gap-4"
      onSubmit={e => {
        e.preventDefault();
        if (!amountError && !needsTxn) mutation.mutate();
      }}
    >
      <div className="rounded-md bg-muted p-3 text-sm">
        {action.kind === "pay" ? (
          <>
            Owes <strong>{format(action.balance)}</strong>
            {action.balance < action.amountDue && <> of {format(action.amountDue)}</>} · subscription ends {shortDate(action.endDate)}
          </>
        ) : (
          <>
            Subscription ended {shortDate(action.endedOn)}. Saving <strong>renews it for {action.months === 12 ? "1 year" : "1 month"}</strong> at{" "}
            {format(action.amountDue)}.
          </>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="quick-amount">Amount ({currencyCode})</Label>
        <Input
          id="quick-amount"
          type="number"
          inputMode="numeric"
          min={1}
          max={due}
          step={1}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="h-11 text-lg"
          aria-invalid={!!amountError || undefined}
        />
        {amountError && <p className="text-sm text-destructive">{amountError}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label>Paid by</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={method}
          onValueChange={v => v && setMethod(v as "CASH" | "BANK_TRANSFER")}
          className="w-full"
        >
          <ToggleGroupItem value="CASH" className="h-11 flex-1">Cash</ToggleGroupItem>
          <ToggleGroupItem value="BANK_TRANSFER" className="h-11 flex-1">Bank transfer</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {method === "BANK_TRANSFER" && (
        <div className="grid gap-1.5">
          <Label htmlFor="quick-txn">Transaction ID</Label>
          <Input id="quick-txn" value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="Bank reference number" className="h-11" />
        </div>
      )}

      <Button type="submit" className="h-12 text-base" disabled={mutation.isPending || !!amountError || needsTxn}>
        {mutation.isPending
          ? "Saving..."
          : action.kind === "renew"
            ? `Renew & record ${format(value || 0)}`
            : `Record ${format(value || 0)}`}
      </Button>
    </form>
  );
}
