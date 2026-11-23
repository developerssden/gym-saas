"use client";

import { use, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, FileText, Mail, MessageCircle, Pencil, Phone, RotateCcw, Trash2 } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useNameBreadcrumb } from "@/components/layout/breadcrumb-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import DataFetchError from "@/components/common/DataFetchError";
import { RowActions } from "@/components/common/row-actions";
import { useConfirm } from "@/components/common/confirm-dialog";
import { ShareReceiptMenuItem, WhatsAppReminderButton } from "@/components/common/whatsapp-actions";
import { MemberStatusBadge, OwesBadge } from "@/components/members/member-status-badge";
import RenewMemberModal from "@/components/dashboard/RenewMemberModal";
import QuickPaymentDialog from "@/components/payments/QuickPaymentDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { billingModelLabel, formatDate, formatDateRange, paymentMethodLabel } from "@/lib/format";
import { recordedByLabel } from "@/lib/recorded-by";
import { resolveGymCountry } from "@/lib/currency";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { initials } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { MemberProfileResponse } from "@/pages/api/members/getmemberprofile";

async function downloadReceipt(paymentId: string) {
  try {
    const res = await axios.post("/api/payments/generateinvoice", { payment_id: paymentId }, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `receipt-${paymentId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(getErrorMessage(err) || "Couldn't create the receipt");
  }
}

export default function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { format: money } = useGymCurrency();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [paying, setPaying] = useState(false);
  const [renewing, setRenewing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<MemberProfileResponse>({
    queryKey: ["member-profile", id],
    queryFn: async () => (await axios.post("/api/members/getmemberprofile", { id })).data,
  });

  const name = data ? `${data.member.user.first_name ?? ""} ${data.member.user.last_name ?? ""}`.trim() || "Member" : "";
  useNameBreadcrumb(!!name && { label: name });

  const remove = useMutation({
    mutationFn: () => axios.post("/api/members/deletemember", { id }),
    onSuccess: () => {
      toast.success(`Deleted ${name}`);
      queryClient.invalidateQueries({ queryKey: ["members"] });
      router.push("/members");
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) {
    return (
      <PageContainer>
        <div aria-busy="true" aria-label="Loading member" className="flex flex-col gap-4">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer>
        <DataFetchError error={error} onRetry={() => refetch()} message="Couldn't load this member" />
      </PageContainer>
    );
  }

  const { member, status, subscriptions, payments, canSeeAmounts } = data;
  const current = subscriptions.find((s) => !s.isExpired || s.frozenSince) ?? subscriptions[0] ?? null;
  const country = resolveGymCountry(member.gym.country, member.location.country);
  const phone = member.user.phone_number;
  const whatsapp = toWhatsAppNumber(phone, country);
  const canRecord = can("payments.record") || can("membersubscriptions.renew");
  const canRenew = can("membersubscriptions.renew") && !!current;
  const canRemind =
    can("membersubscriptions.whatsapp") && !!current && (status.state === "expiring" || status.state === "expired");

  const askDelete = async () => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      description: "They're removed from your members and can no longer be renewed or sent reminders. This can't be undone.",
      confirmLabel: "Delete member",
      destructive: true,
    });
    if (ok) remove.mutate();
  };

  return (
    <PageContainer>
      {confirmDialog}
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold text-secondary-foreground"
            >
              {initials(name)}
            </span>
            {name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <MemberStatusBadge state={status.state} label={status.label} />
            {status.owes && <OwesBadge amount={status.balance !== null ? money(status.balance) : null} />}
            <span>
              Member since {formatDate(member.joinedAt)} · {member.location.name}
            </span>
          </span>
        }
        actions={
          <>
            {canRecord && (
              <Button onClick={() => setPaying(true)}>
                <Banknote aria-hidden /> Record payment
              </Button>
            )}
            {canRenew && (
              <Button variant="outline" onClick={() => setRenewing(true)}>
                <RotateCcw aria-hidden /> Renew
              </Button>
            )}
            {canRemind && current && (
              <WhatsAppReminderButton
                memberName={name}
                phone={phone}
                gymName={member.gym.name}
                gymCountry={country}
                price={current.price}
                endDate={current.endDate}
                isExpired={status.state === "expired"}
              />
            )}
            {can("members.edit") && (
              <Button variant="outline" asChild>
                <Link href={`/members/manage?action=edit&id=${member.id}`}>
                  <Pencil aria-hidden /> Edit
                </Link>
              </Button>
            )}
            {can("members.delete") && (
              <RowActions
                className="!flex-none"
                moreLabel={`More actions for ${name}`}
                actions={[{ label: "Delete member", icon: Trash2, destructive: true, onClick: askDelete }]}
              />
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr] lg:items-start">
        <div className="flex flex-col gap-4">
          {/* Contact */}
          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="font-heading text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {phone ? (
                <div className="flex flex-col gap-2">
                  <p className="font-medium tabular-nums">{phone}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" asChild className="h-11 md:h-9">
                      <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                        <Phone aria-hidden /> Call
                      </a>
                    </Button>
                    {whatsapp && (
                      <Button variant="outline" asChild className="h-11 md:h-9">
                        <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle aria-hidden /> WhatsApp
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No phone number saved.</p>
              )}
              <dl className="grid gap-2 text-sm">
                {member.user.email && (
                  <Detail label="Email">
                    <a href={`mailto:${member.user.email}`} className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                      <Mail aria-hidden className="size-3.5" /> {member.user.email}
                    </a>
                  </Detail>
                )}
                {(member.user.address || member.user.city) && (
                  <Detail label="Address">{[member.user.address, member.user.city].filter(Boolean).join(", ")}</Detail>
                )}
                {member.user.date_of_birth && <Detail label="Date of birth">{formatDate(member.user.date_of_birth)}</Detail>}
                {member.user.cnic && <Detail label="CNIC">{member.user.cnic}</Detail>}
                <Detail label="Branch">
                  {member.gym.name}, {member.location.name}
                </Detail>
              </dl>
            </CardContent>
          </Card>

          {/* Current membership */}
          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="font-heading text-base">Membership</CardTitle>
              {!current && <CardDescription>No membership yet.</CardDescription>}
            </CardHeader>
            {current && (
              <CardContent>
                <dl className="grid gap-2 text-sm">
                  <Detail label="Plan">
                    {billingModelLabel(current.billingModel)}
                    {canSeeAmounts && ` · ${money(current.price)}`}
                  </Detail>
                  <Detail label="Period">{formatDateRange(current.startDate, current.endDate)}</Detail>
                  <Detail label="Status">
                    <MemberStatusBadge state={status.state} label={status.label} />
                  </Detail>
                  {current.frozenSince && <Detail label="Frozen since">{formatDate(current.frozenSince)}</Detail>}
                  {canSeeAmounts && current.amountDue !== null && (
                    <>
                      <Detail label="Due">{money(current.amountDue)}</Detail>
                      <Detail label="Paid">{money(current.paid ?? 0)}</Detail>
                      <Detail label="Balance">
                        <span className={cn((current.balance ?? 0) > 0 && "font-semibold text-destructive")}>
                          {money(current.balance ?? 0)}
                        </span>
                      </Detail>
                    </>
                  )}
                </dl>
              </CardContent>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {/* Payments */}
          {payments && (
            <Card className="gap-0 py-0">
              <CardHeader className="border-b border-border py-4 [.border-b]:pb-4">
                <CardTitle className="font-heading text-base">Payments</CardTitle>
                <CardDescription>
                  {payments.length === 0
                    ? "No payments yet."
                    : `${payments.length} payment${payments.length === 1 ? "" : "s"}, ${money(payments.reduce((s, p) => s + p.amount, 0))} in all`}
                </CardDescription>
              </CardHeader>
              {payments.length > 0 && (
                <CardContent className="px-0">
                  <ul className="divide-y divide-border">
                    {payments.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold tabular-nums">{money(p.amount)}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(p.paymentDate)} · {paymentMethodLabel(p.paymentMethod)}
                            {p.transactionId && ` · ${p.transactionId}`}
                            {p.recordedBy && ` · ${recordedByLabel(p.recordedBy)}`}
                          </p>
                        </div>
                        <RowActions
                          visible={1}
                          moreLabel={`More for the ${money(p.amount)} payment on ${formatDate(p.paymentDate)}`}
                          actions={[{ label: "Receipt", icon: FileText, onClick: () => void downloadReceipt(p.id) }]}
                          moreItems={
                            can("membersubscriptions.whatsapp") ? (
                              <ShareReceiptMenuItem
                                paymentId={p.id}
                                memberName={name}
                                phone={phone}
                                gymName={member.gym.name}
                                gymCountry={country}
                                amount={p.amount}
                                paymentDate={p.paymentDate}
                              />
                            ) : undefined
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          )}

          {/* Membership history */}
          <Card className="gap-0 py-0">
            <CardHeader className="border-b border-border py-4 [.border-b]:pb-4">
              <CardTitle className="font-heading text-base">Membership history</CardTitle>
              <CardDescription>
                {subscriptions.length === 0 ? "No memberships yet." : "Every membership, newest first, with freezes."}
              </CardDescription>
            </CardHeader>
            {subscriptions.length > 0 && (
              <CardContent className="px-0">
                <ul className="divide-y divide-border">
                  {subscriptions.map((s) => (
                    <li key={s.id} className="px-4 py-3 sm:px-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{formatDateRange(s.startDate, s.endDate)}</p>
                        <span className="text-sm text-muted-foreground">
                          {billingModelLabel(s.billingModel)}
                          {canSeeAmounts && ` · ${money(s.price)}`}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {s.frozenSince ? (
                          <MemberStatusBadge state="frozen" label="Frozen" />
                        ) : s.isExpired ? (
                          <MemberStatusBadge state="expired" label="Ended" />
                        ) : null}
                        {canSeeAmounts && (s.balance ?? 0) > 0 && <OwesBadge amount={money(s.balance ?? 0)} />}
                        {s.churnReason && <span>Left: {s.churnReason}</span>}
                      </div>
                      {s.freezes.length > 0 && (
                        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                          {s.freezes.map((f) => (
                            <li key={f.id}>
                              Frozen {f.endDate ? formatDateRange(f.startDate, f.endDate) : `since ${formatDate(f.startDate)}`}
                              {f.days ? ` (+${f.days} day${f.days === 1 ? "" : "s"})` : ""}
                              {f.reason && ` · ${f.reason}`}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {current && renewing && (
        <RenewMemberModal
          open
          onClose={() => {
            setRenewing(false);
            queryClient.invalidateQueries({ queryKey: ["member-profile", id] });
          }}
          memberId={member.id}
          memberName={name}
          defaultPrice={current.price}
          defaultBillingModel={current.billingModel}
        />
      )}
      <QuickPaymentDialog
        open={paying}
        onClose={() => {
          setPaying(false);
          queryClient.invalidateQueries({ queryKey: ["member-profile", id] });
        }}
        member={{ id: member.id, name }}
      />
    </PageContainer>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-baseline gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
