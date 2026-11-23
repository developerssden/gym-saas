"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, UserPlus, UserRound } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useNameBreadcrumb } from "@/components/layout/breadcrumb-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LabeledField } from "@/components/forms/labeled-field";
import { StickyFormFooter } from "@/components/forms/sticky-form-footer";
import { ShareReceiptButton } from "@/components/common/whatsapp-actions";
import { NewMemberMembership, type MembershipSaved } from "@/components/members/new-member-membership";
import { SubscriptionLimitModal } from "@/components/subscription/SubscriptionLimitModal";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { usePermissions } from "@/hooks/usePermissions";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { offerPushNotifications } from "@/lib/push-offer";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { formatDate, paymentMethodLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

type Details = {
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  date_of_birth: string;
  cnic: string;
  address: string;
  city: string;
};

const EMPTY: Details = {
  first_name: "",
  last_name: "",
  phone_number: "",
  email: "",
  date_of_birth: "",
  cnic: "",
  address: "",
  city: "",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Created = { id: string; name: string; phone: string };

const ManageMemberContent = () => {
  const { data: session, status } = useSession({ required: true });
  const searchParams = useSearchParams();
  const action = (searchParams?.get("action") as "create" | "edit" | "view") || "create";
  const memberId = searchParams?.get("id") || null;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { format: money } = useGymCurrency();
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();

  const [values, setValues] = useState<Details>(EMPTY);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [limitInfo, setLimitInfo] = useState<unknown>(null);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  // Adding a member: details → membership and fee → done.
  const [created, setCreated] = useState<Created | null>(null);
  const [saved, setSaved] = useState<MembershipSaved | null>(null);

  const isEdit = action === "edit" && !!memberId;
  const selectedGymId = session?.user?.selected_gym_id || "";
  const selectedLocationId = session?.user?.selected_location_id || "";

  // "View" is the member's profile page now.
  useEffect(() => {
    if (action === "view" && memberId) router.replace(`/members/${memberId}`);
  }, [action, memberId, router]);

  const { data: memberData, isLoading: fetchingMember } = useQuery({
    queryKey: ["member", memberId],
    queryFn: async () => (await axios.post("/api/members/getmember", { id: memberId })).data,
    enabled: isEdit,
  });

  // Fill the form once the member has loaded.
  if (isEdit && memberData && loadedFor !== memberId) {
    const u = memberData.user ?? {};
    setLoadedFor(memberId);
    setValues({
      first_name: u.first_name ?? "",
      last_name: u.last_name ?? "",
      phone_number: u.phone_number ?? "",
      email: u.email ?? "",
      date_of_birth: u.date_of_birth ? String(u.date_of_birth).slice(0, 10) : "",
      cnic: u.cnic ?? "",
      address: u.address ?? "",
      city: u.city ?? "",
    });
    if (u.email || u.date_of_birth || u.cnic || u.address) setMoreOpen(true);
  }

  const memberName = memberData?.user
    ? `${memberData.user.first_name ?? ""} ${memberData.user.last_name ?? ""}`.trim()
    : "";
  useNameBreadcrumb(isEdit && !!memberName && { label: memberName, href: `/members/${memberId}` });

  const set = (field: keyof Details) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  // Name and phone are what the counter needs; an existing member with only an email can keep it.
  const hadEmailOnly = isEdit && !memberData?.user?.phone_number && !!memberData?.user?.email;
  const errors = {
    first_name: values.first_name.trim() ? null : "Enter their first name",
    phone_number:
      values.phone_number.trim() || (hadEmailOnly && values.email.trim())
        ? values.phone_number.trim() && values.phone_number.replace(/\D/g, "").length < 7
          ? "That number looks too short"
          : null
        : "Enter a phone number for reminders and receipts",
    email: values.email.trim() && !EMAIL.test(values.email.trim()) ? "That email doesn't look right" : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const show = (e: string | null) => (submitted ? e : null);

  const handleError = (err: unknown) => {
    const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
    if (data?.error === "LIMIT_EXCEEDED") setLimitInfo(data);
    else if (data?.error === "SUBSCRIPTION_EXPIRED") setShowExpiredModal(true);
    else toast.error(getErrorMessage(err));
  };

  const payload = () => ({
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    phone_number: values.phone_number.trim(),
    email: values.email.trim(),
    date_of_birth: values.date_of_birth || null,
    cnic: values.cnic.trim(),
    address: values.address.trim(),
    city: values.city.trim(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      axios.post("/api/members/createmember", { ...payload(), gym_id: selectedGymId, location_id: selectedLocationId }),
    onSuccess: (res) => {
      const name = `${values.first_name.trim()} ${values.last_name.trim()}`.trim();
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["setup-progress"] });
      queryClient.invalidateQueries({ queryKey: ["offline-directory"] });
      offerPushNotifications();
      const id = res.data?.data?.id as string;
      if (can("membersubscriptions.create")) {
        toast.success(`Added ${name}. Now their membership.`);
        setCreated({ id, name, phone: values.phone_number.trim() });
        window.scrollTo({ top: 0 });
      } else {
        toast.success(`Added ${name}`);
        router.push(`/members/${id}`);
      }
    },
    onError: handleError,
  });

  const updateMutation = useMutation({
    mutationFn: () => axios.post("/api/members/updatemember", { id: memberId, ...payload() }),
    onSuccess: () => {
      toast.success(`Saved ${values.first_name.trim()}'s details`);
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member"] });
      queryClient.invalidateQueries({ queryKey: ["member-profile", memberId] });
      router.push(`/members/${memberId}`);
    },
    onError: handleError,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors) {
      if (errors.email) setMoreOpen(true);
      return;
    }
    if (!isSubscriptionActive || subscriptionExpired) {
      setShowExpiredModal(true);
      return;
    }
    if (isEdit) updateMutation.mutate();
    else {
      if (!selectedGymId || !selectedLocationId) {
        toast.error("Choose a gym and branch at the top of the page first.");
        return;
      }
      createMutation.mutate();
    }
  };

  const startOver = () => {
    setValues(EMPTY);
    setSubmitted(false);
    setMoreOpen(false);
    setCreated(null);
    setSaved(null);
    window.scrollTo({ top: 0 });
  };

  if (status === "loading" || action === "view" || (isEdit && fetchingMember)) {
    return (
      <PageContainer>
        <div aria-busy="true" aria-label="Loading" className="mx-auto flex max-w-xl flex-col gap-4">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </PageContainer>
    );
  }
  if (session?.user?.role !== "GYM_OWNER" && session?.user?.role !== "STAFF") {
    return redirect("/unauthorized");
  }

  // Step 3: done.
  if (created && saved) {
    const owes = saved.due - saved.paid;
    return (
      <PageContainer>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-6 text-center">
          <CheckCircle2 aria-hidden className="size-12 text-primary-dim" />
          <div>
            <h1 className="h1">{created.name} is a member</h1>
            <p className="mt-2 text-muted-foreground">
              {saved.endDate ? `Membership until ${formatDate(saved.endDate)}.` : "Membership saved."}{" "}
              {saved.paid > 0 && `Paid ${money(saved.paid)} · ${paymentMethodLabel(saved.method)}.`}{" "}
              {owes > 0 && `${money(owes)} still to collect.`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {saved.paymentId && can("membersubscriptions.whatsapp") && (
              <ShareReceiptButton
                className="h-11"
                paymentId={saved.paymentId}
                memberName={created.name}
                phone={created.phone}
                gymName={session?.user?.gyms?.find((g) => g.id === selectedGymId)?.name}
                amount={saved.paid}
                paymentDate={new Date()}
              />
            )}
            <Button variant="outline" asChild className="h-11">
              <Link href={`/members/${created.id}`}>
                <UserRound aria-hidden /> Open profile
              </Link>
            </Button>
            <Button variant="outline" className="h-11" onClick={startOver}>
              <UserPlus aria-hidden /> Add another member
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Step 2: membership and fee.
  if (created) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-xl">
          <PageHeader title={`Membership for ${created.name}`} description="Step 2 of 2 · You can skip this and add it later." />
        </div>
        <NewMemberMembership
          memberId={created.id}
          gymId={selectedGymId}
          canTakeFee={can("payments.record") || can("membersubscriptions.renew")}
          onSaved={setSaved}
          onSkip={() => router.push(`/members/${created.id}`)}
        />
      </PageContainer>
    );
  }

  // Step 1 (or editing): the member's details.
  const saving = createMutation.isPending || updateMutation.isPending;
  return (
    <PageContainer>
      <div className="mx-auto max-w-xl">
        <PageHeader
          title={isEdit ? `Edit ${memberName || "member"}` : "Add member"}
          description={
            isEdit
              ? `${memberData?.gym?.name ?? ""}${memberData?.location?.name ? `, ${memberData.location.name}` : ""}`
              : can("membersubscriptions.create")
                ? "Step 1 of 2 · Name and phone are enough. Membership and fee come next."
                : "Name and phone are enough."
          }
        />

        {!isEdit && (!selectedGymId || !selectedLocationId) && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
            Choose a gym and branch at the top of the page first.
          </div>
        )}

        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledField label="First name" required error={show(errors.first_name)}>
              {(p) => (
                <Input {...p} autoFocus={!isEdit} autoComplete="given-name" value={values.first_name} onChange={set("first_name")} className="h-12" />
              )}
            </LabeledField>
            <LabeledField label="Last name">
              {(p) => <Input {...p} autoComplete="family-name" value={values.last_name} onChange={set("last_name")} className="h-12" />}
            </LabeledField>
          </div>

          <LabeledField label="Phone" required={!hadEmailOnly} hint="For WhatsApp reminders and receipts." error={show(errors.phone_number)}>
            {(p) => (
              <Input
                {...p}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="e.g. 0301 2345678"
                value={values.phone_number}
                onChange={set("phone_number")}
                className="h-12"
              />
            )}
          </LabeledField>

          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="h-11 w-full justify-between px-2 md:h-9">
                More details (optional)
                <ChevronDown aria-hidden className={cn("transition-transform", moreOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-4 pt-2 sm:grid-cols-2">
              <LabeledField label="Email" error={show(errors.email)} className="sm:col-span-2">
                {(p) => (
                  <Input {...p} type="email" autoComplete="email" value={values.email} onChange={set("email")} className="h-11" />
                )}
              </LabeledField>
              <LabeledField label="Date of birth">
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={values.date_of_birth}
                    onChange={set("date_of_birth")}
                    className="h-11"
                  />
                )}
              </LabeledField>
              <LabeledField label="CNIC">
                {(p) => <Input {...p} inputMode="numeric" placeholder="e.g. 35202-1234567-1" value={values.cnic} onChange={set("cnic")} className="h-11" />}
              </LabeledField>
              <LabeledField label="Address" className="sm:col-span-2">
                {(p) => <Input {...p} autoComplete="street-address" value={values.address} onChange={set("address")} className="h-11" />}
              </LabeledField>
              <LabeledField label="City" hint="Leave empty to use the branch's city.">
                {(p) => <Input {...p} autoComplete="address-level2" value={values.city} onChange={set("city")} className="h-11" />}
              </LabeledField>
            </CollapsibleContent>
          </Collapsible>

          <StickyFormFooter>
            <Button type="button" variant="outline" onClick={() => router.push(isEdit ? `/members/${memberId}` : "/members")} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? "Save changes" : can("membersubscriptions.create") ? "Add and continue" : "Add member"}
            </Button>
          </StickyFormFooter>
        </form>
      </div>

      {!!limitInfo && (
        <SubscriptionLimitModal
          open
          onClose={() => setLimitInfo(null)}
          limitInfo={limitInfo as React.ComponentProps<typeof SubscriptionLimitModal>["limitInfo"]}
        />
      )}
      <SubscriptionExpiredModal open={showExpiredModal} onClose={() => setShowExpiredModal(false)} />
    </PageContainer>
  );
};

const ManageMemberPage = () => (
  <Suspense fallback={null}>
    <ManageMemberContent />
  </Suspense>
);

export default ManageMemberPage;
