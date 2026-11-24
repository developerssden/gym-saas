"use client";

// Dashboard checklist that walks a new owner through setup. Progress comes from
// their data; it disappears once everything is done (or when they hide it).
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import QuickPaymentDialog from "@/components/payments/QuickPaymentDialog";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { enablePushNotifications, pushSupported } from "@/lib/push-client";
import {
  canPromptInstall,
  isAppInstalled,
  isIos,
  promptInstall,
  subscribeInstallPrompt,
} from "@/lib/install-prompt";
import {
  buildSetupSteps,
  nextSetupStep,
  setupComplete,
  type SetupProgress,
  type SetupStep,
} from "@/lib/setup-checklist";

const hiddenKey = (userId: string) => `kettlio:setup-hidden:${userId}`;

function readHidden(userId: string | undefined): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(hiddenKey(userId)) === "1";
  } catch {
    return false;
  }
}

export default function SetupChecklist() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const isOwner = session?.user?.role === "GYM_OWNER";
  const [hidden, setHidden] = useState(() => readHidden(userId));

  const installed = useSyncExternalStore(subscribeInstallPrompt, isAppInstalled, () => false);

  const { data: progress } = useQuery({
    queryKey: ["setup-progress"],
    queryFn: async () => (await axios.get<SetupProgress>("/api/dashboard/setup-progress")).data,
    enabled: isOwner && !hidden,
  });

  if (!isOwner || hidden || !progress) return null;

  const steps = buildSetupSteps(progress, installed);
  if (setupComplete(steps)) return null;

  const doneCount = steps.filter(s => s.done).length;
  const next = nextSetupStep(steps);

  const hide = () => {
    try {
      if (userId) localStorage.setItem(hiddenKey(userId), "1");
    } catch {
      // Not remembered without storage; hidden until the next visit.
    }
    setHidden(true);
  };

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Get your gym set up</CardTitle>
          <CardDescription>
            {doneCount} of {steps.length} done. A few minutes now saves you hours every month.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={hide} aria-label="Hide setup checklist">
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={(doneCount / steps.length) * 100} aria-label="Setup progress" />
        <ol className="divide-y">
          {steps.map(step => (
            <StepRow key={step.id} step={step} isNext={step.id === next?.id} />
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function StepRow({ step, isNext }: { step: SetupStep; isNext: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      {step.done ? (
        <CheckCircle2 className="size-5 shrink-0 text-green-600" aria-label="Done" />
      ) : (
        <Circle className="size-5 shrink-0 text-muted-foreground" aria-label="Not done" />
      )}
      <div className="min-w-0 flex-1">
        <p className={step.done ? "text-muted-foreground line-through" : "font-medium"}>{step.title}</p>
        {!step.done && <p className="text-sm text-muted-foreground">{step.description}</p>}
      </div>
      {!step.done && <StepAction step={step} primary={isNext} />}
    </li>
  );
}

function StepAction({ step, primary }: { step: SetupStep; primary: boolean }) {
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const canPrompt = useSyncExternalStore(subscribeInstallPrompt, canPromptInstall, () => false);
  const variant = primary ? "default" : "outline";

  const link = (href: string, label: string) => (
    <Button asChild size="sm" variant={variant}>
      <Link href={href}>{label}</Link>
    </Button>
  );

  switch (step.id) {
    case "gym":
      return link("/my-gym?add=gym", "Add gym");
    case "location":
      return link("/my-gym?add=branch", "Add branch");
    case "members":
      return (
        <div className="flex gap-2">
          {link("/members/import", "Import from Excel")}
          <Button asChild size="sm" variant="ghost">
            <Link href="/members/manage?action=create">Add one</Link>
          </Button>
        </div>
      );
    case "payment":
      return (
        <>
          <Button size="sm" variant={variant} onClick={() => setPaying(true)}>
            Record payment
          </Button>
          <QuickPaymentDialog
            open={paying}
            onClose={() => {
              setPaying(false);
              void queryClient.invalidateQueries({ queryKey: ["setup-progress"] });
            }}
          />
        </>
      );
    case "notifications":
      if (!pushSupported()) return <p className="text-sm text-muted-foreground">Not supported in this browser</p>;
      if (Notification.permission === "denied") {
        return <p className="text-sm text-muted-foreground">Blocked: allow notifications in your browser settings</p>;
      }
      return (
        <Button
          size="sm"
          variant={variant}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await enablePushNotifications();
              toast.success("Notifications turned on");
              await queryClient.invalidateQueries({ queryKey: ["setup-progress"] });
            } catch (err) {
              toast.error(getErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Turning on…" : "Turn on"}
        </Button>
      );
    case "install":
      if (canPrompt) {
        return (
          <Button size="sm" variant={variant} onClick={() => void promptInstall()}>
            Install
          </Button>
        );
      }
      return showInstallHelp ? (
        <p className="w-full text-sm text-muted-foreground sm:w-auto sm:max-w-xs">
          {isIos()
            ? "In Safari, tap the Share button, then “Add to Home Screen”."
            : "Open your browser menu (⋮) and choose “Install app” or “Add to Home screen”."}
        </p>
      ) : (
        <Button size="sm" variant={variant} onClick={() => setShowInstallHelp(true)}>
          How to install
        </Button>
      );
  }
}
