"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Search, X } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareReceiptButton } from "@/components/common/whatsapp-actions";
import { MemberStatusBadge } from "@/components/members/member-status-badge";
import { MembershipForm, type MembershipSaved } from "@/components/membersubscriptions/MembershipForm";
import { useDebounce } from "@/hooks/use-debounce";
import { usePermissions } from "@/hooks/usePermissions";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { formatDate, paymentMethodLabel } from "@/lib/format";
import type { MembershipRow } from "@/components/membersubscriptions/columns";

const nameOf = (r: MembershipRow) => `${r.user.first_name ?? ""} ${r.user.last_name ?? ""}`.trim() || "Member";

/** Add a membership: pick the member (or arrive with ?member=id), then the membership form. */
export function AddMembership({ initialMemberId }: { initialMemberId: string | null }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { can } = usePermissions();
  const { format } = useGymCurrency();
  const gymId = session?.user?.selected_gym_id || "";
  const locationId = session?.user?.selected_location_id || "";

  const [query, setQuery] = useState("");
  const search = useDebounce(query, 300);
  const [picked, setPicked] = useState<MembershipRow | null>(null);
  const [saved, setSaved] = useState<MembershipSaved | null>(null);

  // Arriving from a member's profile: load just that member.
  const preset = useQuery<MembershipRow | null>({
    queryKey: ["members", "pick", initialMemberId],
    queryFn: async () => {
      const res = await axios.post("/api/members/getmemberprofile", { id: initialMemberId });
      const p = res.data;
      return {
        id: p.member.id,
        user: { ...p.member.user },
        gym: p.member.gym,
        membership: {
          state: p.status.state,
          label: p.status.label,
          days: p.status.days,
          endDate: p.subscriptions[0]?.endDate ?? null,
          startDate: p.subscriptions[0]?.startDate ?? null,
          frozenSince: null,
          isExpiredFlag: false,
          subscriptionId: null,
          price: null,
          billingModel: null,
          owes: p.status.owes,
          balance: p.status.balance,
        },
      };
    },
    enabled: !!initialMemberId && !picked,
  });
  const member = picked ?? preset.data ?? null;

  const results = useQuery<{ data: MembershipRow[] }>({
    queryKey: ["members", "pick-search", search, gymId, locationId],
    queryFn: async () =>
      (
        await axios.post("/api/members/getmembers", {
          page: 1,
          limit: 8,
          search,
          gym_id: gymId || undefined,
          location_id: locationId || undefined,
          with_status: true,
        })
      ).data,
    enabled: !member && !!gymId && search.trim().length > 0,
  });

  if (saved && member) {
    const name = nameOf(member);
    const owes = saved.due - saved.paid;
    return (
      <PageContainer>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-6 text-center">
          <CheckCircle2 aria-hidden className="size-12 text-primary-dim" />
          <div>
            <h1 className="h1">Membership saved</h1>
            <p className="mt-2 text-muted-foreground">
              {name}
              {saved.endDate ? ` until ${formatDate(saved.endDate)}.` : "."}{" "}
              {saved.paid > 0 && `Paid ${format(saved.paid)} · ${paymentMethodLabel(saved.method)}.`}{" "}
              {owes > 0 && `${format(owes)} still to collect.`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {saved.paymentId && can("membersubscriptions.whatsapp") && (
              <ShareReceiptButton
                className="h-11"
                paymentId={saved.paymentId}
                memberName={name}
                phone={member.user.phone_number}
                gymName={member.gym?.name}
                gymCountry={member.gym?.country}
                amount={saved.paid}
                paymentDate={new Date()}
              />
            )}
            <Button variant="outline" asChild className="h-11">
              <Link href={`/members/${member.id}`}>Open profile</Link>
            </Button>
            <Button variant="outline" asChild className="h-11">
              <Link href="/membersubscriptions">Back to memberships</Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-xl">
        <PageHeader title="Add membership" description="Pick the member, then their plan and fee." />

        {!member ? (
          initialMemberId && preset.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex flex-col gap-3">
              <label htmlFor="member-search" className="text-sm font-medium">
                Member
              </label>
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="member-search"
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or phone"
                  className="h-12 pl-9"
                  aria-controls="member-results"
                />
              </div>
              <ul id="member-results" className="divide-y divide-border rounded-lg border border-border empty:hidden" aria-live="polite">
                {results.isFetching && !results.data && (
                  <li className="p-3">
                    <Skeleton className="h-5 w-1/2" />
                  </li>
                )}
                {results.data?.data.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(r)}
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{nameOf(r)}</span>
                        <span className="block truncate text-sm text-muted-foreground">{r.user.phone_number || "No phone"}</span>
                      </span>
                      <MemberStatusBadge state={r.membership.state} label={r.membership.label} />
                    </button>
                  </li>
                ))}
                {results.data && results.data.data.length === 0 && (
                  <li className="p-3 text-sm text-muted-foreground">
                    No member matches.{" "}
                    {can("members.create") && (
                      <Link href="/members/manage?action=create" className="font-medium text-foreground underline underline-offset-2">
                        Add a new member
                      </Link>
                    )}
                  </li>
                )}
              </ul>
            </div>
          )
        ) : (
          <div className="mb-6 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{nameOf(member)}</p>
                <p className="truncate text-sm text-muted-foreground">{member.user.phone_number || "No phone"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <MemberStatusBadge state={member.membership.state} label={member.membership.label} />
                {!initialMemberId && (
                  <Button type="button" variant="ghost" size="icon" className="size-11 md:size-9" aria-label="Choose another member" onClick={() => setPicked(null)}>
                    <X aria-hidden />
                  </Button>
                )}
              </div>
            </div>
            {(member.membership.state === "active" || member.membership.state === "frozen") && member.membership.endDate && (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {nameOf(member)} already has a membership until {formatDate(member.membership.endDate)}. A new one runs alongside it from the date you pick.
              </p>
            )}
          </div>
        )}
      </div>

      {member && (
        <MembershipForm
          key={member.id}
          mode="new"
          memberId={member.id}
          gymId={gymId}
          canTakeFee={can("payments.record") || can("membersubscriptions.renew")}
          onSaved={setSaved}
          onCancel={() => router.push(initialMemberId ? `/members/${initialMemberId}` : "/membersubscriptions")}
        />
      )}
    </PageContainer>
  );
}
