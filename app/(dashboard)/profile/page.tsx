"use client";

import Link from "next/link";
import axios from "axios";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import DataFetchError from "@/components/common/DataFetchError";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { AccountSection } from "@/components/profile/AccountSection";
import { PasswordSection } from "@/components/profile/PasswordSection";
import { PlanSection } from "@/components/profile/PlanSection";
import PushNotificationToggle from "@/components/profile/PushNotificationToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { accountValuesFrom } from "@/lib/profile";

type Profile = Parameters<typeof accountValuesFrom>[0] & { id: string; email: string | null };

const ProfilePage = () => {
  const { data: session, status } = useSession({ required: true });
  const role = session?.user?.role;
  const allowed = role === "GYM_OWNER" || role === "STAFF";
  const isOwner = role === "GYM_OWNER";

  const { data: profile, isLoading, error, refetch } = useQuery<Profile>({
    queryKey: ["profile", session?.user?.id],
    queryFn: async () => (await axios.post("/api/profile/getprofile")).data,
    enabled: status === "authenticated" && allowed,
  });

  if (status !== "loading" && !allowed) return redirect("/unauthorized");

  const sections = [
    { id: "account", label: "Account" },
    { id: "password", label: "Password" },
    { id: "notifications", label: "Notifications" },
    ...(isOwner ? [{ id: "plan", label: "Plan & billing" }] : []),
  ];

  return (
    <PageContainer>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <PageHeader title="Profile" description="Your details, password, notifications and plan." />

        {/* Jump links: one tap to a section on a long phone screen. Wraps instead of scrolling sideways. */}
        <nav aria-label="Profile sections" className="-mt-2 flex flex-wrap gap-2">
          {sections.map(s => (
            <Button key={s.id} asChild variant="outline" size="sm" className="h-11 rounded-full md:h-8">
              <a href={`#${s.id}`}>{s.label}</a>
            </Button>
          ))}
        </nav>

        {(status === "loading" || isLoading) && (
          <div aria-busy="true" aria-label="Loading" className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}
        {error && <DataFetchError error={error} onRetry={() => refetch()} message="Couldn't load your profile" />}

        {profile && (
          <>
            <AccountSection key={profile.id} email={profile.email} initial={accountValuesFrom(profile)} />
            <PasswordSection />

            <Card id="notifications" className="scroll-mt-20">
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Alerts on this phone or computer when memberships are about to end.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <PushNotificationToggle />
                <Button asChild variant="ghost" className="h-11 w-full justify-between px-2 md:h-9">
                  <Link href="/notifications">
                    See all notifications
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {isOwner && <PlanSection />}
          </>
        )}
      </div>
    </PageContainer>
  );
};

export default ProfilePage;
