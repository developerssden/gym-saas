"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { IMPORT_COLUMNS } from "@/lib/bulk-import/columns";
import type { BulkImportCheckResponse, BulkImportResponse, ImportMode, ImportRowResult } from "@/lib/bulk-import/types";
import { MAX_IMPORT_ROWS } from "@/lib/bulk-import/types";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { offerPushNotifications } from "@/lib/push-offer";
import { cn } from "@/lib/utils";

const MODES: Array<{ id: ImportMode; title: string; description: string }> = [
  { id: "members_only", title: "Members only", description: "Names, phone numbers and contact details." },
  {
    id: "member_with_subscription",
    title: "Members and their membership",
    description: "Also the start date, how long it lasts and the fee paid. Each fee is recorded as paid.",
  },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="flex gap-3 sm:gap-4">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-3 pb-2">
        <h2 id={`step-${n}`} className="pt-0.5 font-semibold">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

/** Rows that can't be added, with the reason. */
function ProblemRows({ rows }: { rows: ImportRowResult[] }) {
  const problems = rows.filter((r): r is Extract<ImportRowResult, { status: "error" }> => r.status === "error");
  if (!problems.length) return null;
  return (
    <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
      {problems.map((r) => (
        <li key={r.row} className="px-3 py-2.5 text-sm">
          <span className="font-medium">
            Row {r.row} · {r.name}
          </span>
          <span className="block text-destructive">{r.error}</span>
        </li>
      ))}
    </ul>
  );
}

export default function MemberImportPage() {
  const { data: session, status } = useSession({ required: true });
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>("member_with_subscription");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<BulkImportResponse | null>(null);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();

  const gymId = session?.user?.selected_gym_id;
  const locationId = session?.user?.selected_location_id;
  const branchName = session?.user?.locations?.find((l) => l.id === locationId)?.name;

  const formData = (checkOnly: boolean) => {
    const data = new FormData();
    data.append("file", file as File);
    data.append("mode", mode);
    data.append("gym_id", gymId ?? "");
    data.append("location_id", locationId ?? "");
    if (checkOnly) data.append("check_only", "1");
    return data;
  };

  // Checked again whenever the file, what's in it or the branch changes.
  const check = useQuery({
    queryKey: ["member-import-check", file?.name, file?.size, file?.lastModified, mode, gymId, locationId],
    queryFn: async () => (await axios.post<BulkImportCheckResponse>("/api/members/bulkimport", formData(true))).data,
    enabled: !!file && !!gymId && !!locationId && !result,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const importRows = useMutation({
    mutationFn: async () => (await axios.post<BulkImportResponse>("/api/members/bulkimport", formData(false))).data,
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["membersubscriptions"] });
      if (data.succeeded > 0) offerPushNotifications();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  if (status === "loading") return <FullScreenLoader />;
  if (session?.user?.role !== "GYM_OWNER" && session?.user?.role !== "STAFF") return redirect("/unauthorized");

  const chooseFile = (selected: File | undefined) => {
    if (!selected) return;
    const name = selected.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      toast.error("Upload an Excel (.xlsx) or CSV file");
      return;
    }
    setFile(selected);
    setResult(null);
  };

  const startOver = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runImport = () => {
    if (!isSubscriptionActive || subscriptionExpired) {
      setShowExpiredModal(true);
      return;
    }
    importRows.mutate();
  };

  const columns = IMPORT_COLUMNS.filter((c) => mode === "member_with_subscription" || !c.membership);

  const report = check.data;
  const overLimit = !!report && report.ready > report.slotsLeft;

  return (
    <PageContainer>
      <PageHeader
        title="Import members"
        description={`Add many members at once from an Excel file${branchName ? `, into ${branchName}` : ""}.`}
      />

      {!gymId || !locationId ? (
        <div className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          Choose a gym and branch at the top of the page first. Members are added to that branch.
        </div>
      ) : null}

      {result ? (
        <div className="max-w-2xl space-y-4" role="status">
          <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Added {plural(result.succeeded, "member")}</p>
              {result.failed > 0 && (
                <p className="text-sm text-muted-foreground">
                  {plural(result.failed, "row")} weren&apos;t added. Fix them in your file and import it again; members already
                  added are skipped.
                </p>
              )}
            </div>
          </div>
          <ProblemRows rows={result.results} />
          <div className="flex flex-col gap-2 sm:flex-row">
            {result.succeeded > 0 && (
              <Button asChild className="h-11">
                <Link href="/members">View members</Link>
              </Button>
            )}
            <Button variant="outline" className="h-11" onClick={startOver}>
              Import another file
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <Step n={1} title="What's in your file?">
            <div role="radiogroup" aria-label="What's in your file?" className="grid gap-2 sm:grid-cols-2">
              {MODES.map((m) => {
                const selected = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      selected ? "border-primary bg-primary/10" : "hover:bg-muted"
                    )}
                  >
                    <span className="block font-medium">{m.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{m.description}</span>
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n={2} title="Download the template">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="h-11">
                <a href="/api/members/bulkimport-template?format=xlsx" download>
                  <Download aria-hidden /> Excel template
                </a>
              </Button>
              <Button asChild variant="outline" className="h-11">
                <a href="/api/members/bulkimport-template?format=csv" download>
                  <Download aria-hidden /> CSV template
                </a>
              </Button>
            </div>
          </Step>

          <Step n={3} title="Fill it in">
            <p className="text-sm text-muted-foreground">
              One member per row, under these headings. Columns you don&apos;t use can stay empty. Dates like 31/01/2026.
            </p>
            <ul className="divide-y rounded-md border text-sm">
              {columns.map((c) => {
                const needed = c.required === "always" || (c.required === "membership" && mode === "member_with_subscription");
                return (
                  <li key={c.key} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2 sm:grid-cols-[10rem_1fr_auto]">
                    <span className="font-medium">
                      {c.label}
                      {needed && <span className="ml-1.5 text-xs font-normal text-destructive">Needed</span>}
                    </span>
                    <span className="col-start-1 text-muted-foreground sm:col-start-2 sm:row-start-1">{c.hint}</span>
                    <span className="col-start-2 row-start-1 text-right text-muted-foreground sm:col-start-3">
                      {c.example && (
                        <>
                          <span className="sr-only">Example: </span>
                          {c.example}
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Step>

          <Step n={4} title="Upload and check">
            <input
              ref={fileInputRef}
              id="import-file"
              type="file"
              accept=".xlsx,.csv"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => chooseFile(e.target.files?.[0])}
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                chooseFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center",
                dragging && "border-primary bg-primary/5"
              )}
            >
              {file ? (
                <p className="flex items-center gap-2 text-sm font-medium">
                  <FileSpreadsheet aria-hidden className="size-4 text-muted-foreground" />
                  {file.name}
                </p>
              ) : (
                <p className="hidden text-sm text-muted-foreground md:block">Drop the file here, or</p>
              )}
              <Button
                type="button"
                variant={file ? "outline" : "default"}
                className="h-11"
                disabled={!gymId || !locationId}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload aria-hidden /> {file ? "Choose another file" : "Choose file"}
              </Button>
              <p className="text-xs text-muted-foreground">Excel or CSV, up to {MAX_IMPORT_ROWS} members and 5 MB.</p>
            </div>

            {file && (
              <div aria-live="polite" className="space-y-3">
                {check.isFetching ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 aria-hidden className="size-4 animate-spin" /> Checking your file…
                  </p>
                ) : check.error ? (
                  <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{getErrorMessage(check.error)}</p>
                ) : report ? (
                  <>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="font-semibold">
                        {plural(report.ready, "member")} ready
                        {report.failed > 0 && <span className="text-destructive">, {plural(report.failed, "row")} need fixing</span>}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {report.failed > 0
                          ? "Rows that need fixing are skipped. Fix them in your file and upload it again, or import the ready ones now."
                          : "Everything looks right."}
                      </p>
                    </div>
                    {overLimit && (
                      <p className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm">
                        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>
                          {report.slotsLeft === 0
                            ? "This branch has reached its member limit on your plan. Upgrade to add more."
                            : `This branch has room for ${plural(report.slotsLeft, "more member")} on your plan. Remove some rows or upgrade your plan.`}
                        </span>
                      </p>
                    )}
                    <ProblemRows rows={report.results} />
                    {report.ready > 0 && (
                      <Button
                        className="h-12 w-full text-base sm:w-auto"
                        disabled={overLimit}
                        loading={importRows.isPending}
                        onClick={runImport}
                      >
                        {importRows.isPending ? "Importing…" : `Import ${plural(report.ready, "member")}`}
                      </Button>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </Step>
        </div>
      )}

      <SubscriptionExpiredModal open={showExpiredModal} onClose={() => setShowExpiredModal(false)} />
    </PageContainer>
  );
}
