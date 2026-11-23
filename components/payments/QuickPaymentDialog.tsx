"use client";

// Record a fee in three taps: open (1), pick the member (2), Save (3).
// The amount and method are pre-filled from what the member owes, or from
// their last subscription when it has ended (renew and pay in one step).
//
// Works offline too: members and what they owe come from the copy saved on
// this device, and the payment is kept in the outbox until it can be synced.
import { useState } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, WifiOff } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebounce } from "@/hooks/use-debounce";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { usePermissions } from "@/hooks/usePermissions";
import { useMemberDirectory, useOnline, useOutbox } from "@/hooks/useOffline";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { applyPendingPayments, searchDirectory } from "@/lib/offline/outbox-types";
import { submitPayment } from "@/lib/offline/submit";
import type { FeeAction } from "@/lib/quick-payment";
import { PAYMENT_QUERY_KEYS } from "@/lib/payment-queries";
import { formatDate } from "@/lib/format";

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

const shortDate = (iso: string) => formatDate(iso);

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

function OfflineNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
      <WifiOff className="size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function MemberPicker({ onPick }: { onPick: (m: QuickPaymentMember) => void }) {
  const { data: session } = useSession();
  const online = useOnline();
  const directory = useMemberDirectory();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const gymId = session?.user?.selected_gym_id || undefined;
  const locationId = session?.user?.selected_location_id || undefined;
  const ready = debounced.trim().length >= 2;

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
    enabled: online && ready,
  });

  // Offline: search the copy of the member list saved on this device.
  const results: Array<{ id: string; name: string; detail: string }> = online
    ? (data ?? []).map(m => ({ id: m.id, name: memberName(m), detail: m.user.phone_number || m.location?.name || "" }))
    : searchDirectory(directory.data?.data ?? [], debounced).map(m => ({ id: m.id, name: m.name, detail: m.phone ?? "" }));

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>Find the member by name or phone number.</DialogDescription>
      </DialogHeader>
      {!online && (
        <OfflineNote>
          {directory.data
            ? "You're offline. Searching the members saved on this device; payments sync when you're back online."
            : "You're offline and no member list is saved on this device yet. Open this once while online."}
        </OfflineNote>
      )}
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
        {online && isFetching && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {!ready ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Type at least 2 letters or digits.</p>
        ) : (online ? data : true) && results.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No members found.</p>
        ) : (
          <ul className="divide-y">
            {results.map(m => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPick({ id: m.id, name: m.name })}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-sm text-muted-foreground">{m.detail}</span>
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
  const online = useOnline();
  const directory = useMemberDirectory();
  const { data, isLoading, error } = useQuery({
    queryKey: ["member-fee", member.id],
    queryFn: async () => (await axios.post<FeeResponse>("/api/payments/member-fee", { member_id: member.id })).data,
    enabled: online,
    retry: false,
  });

  // Offline (or the lookup failed): use what was saved on this device.
  const saved = directory.data?.data.find(m => m.id === member.id);
  const fallback = !online || error ? saved : undefined;
  const action = data?.action ?? fallback?.action;
  const phone = data?.member.phone ?? fallback?.phone;

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
        <DialogDescription>{phone || "Record a payment"}</DialogDescription>
      </DialogHeader>
      {online && isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!action && (!online || error) && (
        <p className="text-sm text-destructive">
          {!online
            ? "This member isn't saved on this device, so their fee can't be recorded offline."
            : getErrorMessage(error)}
        </p>
      )}
      {action && (
        <>
          {fallback && (
            <OfflineNote>Offline: using the fee saved on this device{directory.data ? ` (${shortDate(directory.data.savedAt)})` : ""}.</OfflineNote>
          )}
          <FeeAmountForm member={member} action={action} onDone={onDone} />
        </>
      )}
    </>
  );
}

function FeeAmountForm({ member, action: serverAction, onDone }: { member: QuickPaymentMember; action: FeeAction; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { can } = usePermissions();
  const { currencyCode, format } = useGymCurrency();
  const outbox = useOutbox();
  // Payments for this member still waiting on this device count as paid.
  const { action, pendingAmount, blockedReason } = applyPendingPayments(
    serverAction,
    outbox.filter(i => i.memberId === member.id)
  );
  const due = action.kind === "pay" ? action.balance : action.kind === "renew" ? action.amountDue : 0;
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [transactionId, setTransactionId] = useState("");

  const mutation = useMutation({
    // submitPayment handles being offline itself (queues the payment).
    networkMode: "always",
    mutationFn: async () => {
      const value = Number(amount);
      const payment = { payment_method: method, transaction_id: transactionId.trim() || undefined };
      const common = {
        userId: session?.user?.id ?? "",
        memberId: member.id,
        memberName: member.name,
        amount: value,
        method,
      };
      if (action.kind === "pay") {
        return submitPayment({
          ...common,
          kind: "payment",
          subscriptionId: action.subscriptionId,
          url: "/api/payments/createpayment",
          body: { subscription_type: "MEMBER", member_subscription_id: action.subscriptionId, amount: value, ...payment },
        });
      }
      if (action.kind !== "renew") throw new Error("Nothing to pay");
      return submitPayment({
        ...common,
        kind: "renew",
        url: "/api/membersubscriptions/renewmembersubscription-owner",
        body: {
          member_id: member.id,
          price: action.price,
          discount: action.discount,
          months: action.months,
          billing_model: action.billingModel,
          use_custom_dates: false,
          amount_paid: value,
          ...payment,
        },
      });
    },
    onSuccess: result => {
      const value = Number(amount);
      if (result === "queued") {
        toast.success(`Saved on this device: ${format(value)} from ${member.name}. It will sync when you're back online.`);
      } else {
        const left = due - value;
        toast.success(
          action.kind === "renew"
            ? `Renewed and ${format(value)} recorded for ${member.name}.`
            : left > 0
              ? `Payment recorded. ${member.name} still owes ${format(left)}.`
              : `Payment recorded. ${member.name} has paid in full.`
        );
        for (const key of PAYMENT_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
      }
      onDone();
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  if (blockedReason) return <p className="py-4 text-sm text-muted-foreground">{blockedReason}</p>;
  if (action.kind === "none") {
    return <p className="py-4 text-sm text-muted-foreground">{member.name} has no subscription yet. Add one from Memberships.</p>;
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
            {pendingAmount > 0 && <> · {format(pendingAmount)} waiting to sync</>}
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
