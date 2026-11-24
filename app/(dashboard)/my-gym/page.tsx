"use client";

// Settings → My gym: the owner's gym details and its branches on one page,
// with plan usage. Adding and editing happen in dialogs.
import { Suspense, useState } from "react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, MapPin, Pencil, Phone, Plus } from "lucide-react";
import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PlaceDialog, type Place } from "@/components/my-gym/PlaceDialog";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";
import { SubscriptionLimitModal } from "@/components/subscription/SubscriptionLimitModal";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useGyms } from "@/hooks/use-gyms";
import { useLocations } from "@/hooks/use-locations";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { getCurrencyCodeFromCountry, resolveGymCountry } from "@/lib/currency";
import { planUsage, type PlanUsage } from "@/lib/plan-usage";
import { cn } from "@/lib/utils";

type DialogState =
  | { kind: "gym"; place?: Place }
  | { kind: "branch"; place?: Place }
  | null;

const addressLine = (p: Place) => [p.address, p.city, p.state].filter(Boolean).join(", ");

function UsageMeter({ usage, label }: { usage: PlanUsage; label: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm">
        <span className="font-medium">{usage.text}</span>
        {usage.atLimit && <span className="text-muted-foreground"> · your plan&apos;s limit</span>}
        {usage.nearLimit && <span className="text-muted-foreground"> · one left on your plan</span>}
      </p>
      {usage.percent > 0 && (
        <Progress
          value={usage.percent}
          aria-label={`${label}: ${usage.text}`}
          className={cn("h-1.5 bg-border", usage.atLimit && "[&_[data-slot=progress-indicator]]:bg-amber-500")}
        />
      )}
    </div>
  );
}

function PlaceDetails({ place }: { place: Place }) {
  const address = addressLine(place);
  return (
    <div className="min-w-0 space-y-1 text-sm text-muted-foreground">
      {address ? (
        <p className="flex items-start gap-2">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{address}</span>
        </p>
      ) : (
        <p>No address yet</p>
      )}
      {place.phone_number && (
        <p className="flex items-center gap-2">
          <Phone aria-hidden className="size-4 shrink-0" />
          <a href={`tel:${place.phone_number}`} className="hover:text-foreground">
            {place.phone_number}
          </a>
        </p>
      )}
    </div>
  );
}

function MyGymContent() {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOwner = session?.user?.role === "GYM_OWNER";
  const [chosenGymId, setChosenGymId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [limitFor, setLimitFor] = useState<"gym" | "location" | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const [handledAdd, setHandledAdd] = useState(false);

  const gyms = useGyms({ page: 1, limit: 50, enabled: isOwner });
  const gymList = gyms.data?.data ?? [];
  const gym =
    gymList.find((g) => g.id === chosenGymId) ??
    gymList.find((g) => g.id === session?.user?.selected_gym_id) ??
    gymList[0];

  const branches = useLocations({ page: 1, limit: 100, gym_id: gym?.id, enabled: isOwner && !!gym });
  // Branch limits count every branch of every gym the owner has.
  const allBranches = useLocations({ page: 1, limit: 1, enabled: isOwner });
  const { isSubscriptionActive, subscriptionExpired, gymLimit, locationLimit } = useSubscriptionValidation({
    gymCount: gyms.data?.totalCount,
    locationCount: allBranches.data?.totalCount,
  });

  const gymUsage = planUsage(gyms.data?.totalCount ?? 0, gymLimit, "gym");
  const branchUsage = planUsage(allBranches.data?.totalCount ?? 0, locationLimit, "branch", "branches");
  const planActive = isSubscriptionActive && !subscriptionExpired;

  const add = (kind: "gym" | "branch") => {
    if (!planActive) return setShowExpired(true);
    if (kind === "gym" && gymUsage.atLimit) return setLimitFor("gym");
    if (kind === "branch" && branchUsage.atLimit) return setLimitFor("location");
    setDialog({ kind });
  };

  // ?add=gym / ?add=branch (from the setup checklist) opens the form once ready.
  const wanted = searchParams?.get("add");
  const ready = gyms.data && (wanted !== "branch" || (gym && allBranches.data));
  if (!handledAdd && ready && (wanted === "gym" || wanted === "branch")) {
    setHandledAdd(true);
    add(wanted === "branch" && !gym ? "gym" : wanted);
    router.replace("/my-gym");
  }

  if (status === "loading") {
    return (
      <PageContainer>
        <Skeleton className="mb-6 h-9 w-48" />
        <Skeleton className="h-48 w-full" />
      </PageContainer>
    );
  }
  // Admins manage every gym on the Gyms and Locations pages.
  if (session?.user?.role === "SUPER_ADMIN") return redirect("/gyms");
  if (!isOwner) return redirect("/unauthorized");

  const currency = gym ? getCurrencyCodeFromCountry(resolveGymCountry(gym.country, branches.data?.data?.[0]?.country)) : null;
  const showGymList = gymList.length > 1 || (gymLimit ?? 0) > 1;

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="My gym" description="Your gym's details, its branches and what your plan allows." />

      {gyms.error ? (
        <DataFetchError error={gyms.error} onRetry={() => gyms.refetch()} message="Couldn't load your gym" />
      ) : !gyms.data ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : !gym ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Building2 aria-hidden className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium">Add your gym to get started</p>
          <p className="mt-1 text-sm text-muted-foreground">Its name, address and country. Then add the branch where members train.</p>
          <Button className="mt-4 h-11" onClick={() => add("gym")}>
            <Plus aria-hidden /> Add gym
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {showGymList && (
            <section aria-labelledby="your-gyms" className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 id="your-gyms" className="font-semibold">
                    Your gyms
                  </h2>
                  <UsageMeter usage={gymUsage} label="Gyms" />
                </div>
                <Button variant="outline" className="h-11 md:h-9" onClick={() => add("gym")}>
                  <Plus aria-hidden /> Add gym
                </Button>
              </div>
              <div role="group" aria-label="Show gym" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {gymList.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={g.id === gym.id}
                    onClick={() => setChosenGymId(g.id)}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors md:min-h-9",
                      g.id === gym.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
                    )}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="gym-details" className="rounded-lg border bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <h2 id="gym-details" className="text-lg font-semibold break-words">
                  {gym.name}
                </h2>
                <PlaceDetails place={gym} />
                {currency && <p className="text-sm text-muted-foreground">Money shown in {currency}</p>}
              </div>
              <Button variant="outline" className="h-11 shrink-0 md:h-9" onClick={() => setDialog({ kind: "gym", place: gym })}>
                <Pencil aria-hidden /> Edit
              </Button>
            </div>
          </section>

          <section aria-labelledby="branches" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <h2 id="branches" className="font-semibold">
                  Branches
                </h2>
                <UsageMeter usage={branchUsage} label="Branches" />
              </div>
              <Button className="h-11 md:h-9" onClick={() => add("branch")}>
                <Plus aria-hidden /> Add branch
              </Button>
            </div>

            {branches.error ? (
              <DataFetchError error={branches.error} onRetry={() => branches.refetch()} message="Couldn't load branches" />
            ) : !branches.data ? (
              <Skeleton className="h-24 w-full" />
            ) : branches.data.data.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm">
                <p className="font-medium">No branches yet</p>
                <p className="mt-1 text-muted-foreground">Add the place where members train. Members, equipment and fees belong to a branch.</p>
              </div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {branches.data.data.map((b) => (
                  <li key={b.id} className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium break-words">
                        {b.name}
                        {b.id === session?.user?.selected_location_id && (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">Selected</span>
                        )}
                      </p>
                      <PlaceDetails place={b} />
                    </div>
                    <Button
                      variant="outline"
                      className="h-11 shrink-0 md:h-9"
                      onClick={() => setDialog({ kind: "branch", place: b })}
                      aria-label={`Edit ${b.name}`}
                    >
                      <Pencil aria-hidden /> <span className="hidden sm:inline">Edit</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <PlaceDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        kind={dialog?.kind ?? "gym"}
        place={dialog?.place}
        gymId={gym?.id}
        defaultCountry={gym?.country}
        onLimit={() => setLimitFor(dialog?.kind === "branch" ? "location" : "gym")}
      />
      <SubscriptionLimitModal
        open={!!limitFor}
        onClose={() => setLimitFor(null)}
        limitInfo={{
          resourceType: limitFor ?? "gym",
          current: limitFor === "location" ? (allBranches.data?.totalCount ?? 0) : (gyms.data?.totalCount ?? 0),
          max: (limitFor === "location" ? locationLimit : gymLimit) ?? 0,
        }}
      />
      <SubscriptionExpiredModal open={showExpired} onClose={() => setShowExpired(false)} />
    </PageContainer>
  );
}

// useSearchParams needs a Suspense boundary.
export default function MyGymPage() {
  return (
    <Suspense fallback={null}>
      <MyGymContent />
    </Suspense>
  );
}
