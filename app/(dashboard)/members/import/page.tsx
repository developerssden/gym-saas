"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { Upload, Download, ArrowLeft } from "lucide-react";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/getErrorMessage";
import type { BulkImportResponse, ImportMode } from "@/lib/bulk-import/types";
import { useSubscriptionValidation } from "@/hooks/useSubscriptionValidation";
import { SubscriptionExpiredModal } from "@/components/subscription/SubscriptionExpiredModal";

export default function MemberImportPage() {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>("member_with_subscription");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkImportResponse | null>(null);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const { isSubscriptionActive, subscriptionExpired } = useSubscriptionValidation();

  const selectedGymId = session?.user?.selected_gym_id;
  const selectedLocationId = session?.user?.selected_location_id;

  if (status === "loading") {
    return <FullScreenLoader />;
  }

  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  const downloadTemplate = (format: "csv" | "xlsx") => {
    window.open(`/api/members/bulkimport-template?format=${format}`, "_blank");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const name = selected.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      toast.error("Please upload a .csv or .xlsx file");
      return;
    }
    setFile(selected);
    setResult(null);
  };

  const handleImport = async () => {
    if (!isSubscriptionActive || subscriptionExpired) {
      setShowExpiredModal(true);
      return;
    }

    if (!selectedGymId || !selectedLocationId) {
      toast.error("Select a gym and location from the header first");
      return;
    }

    if (!file) {
      toast.error("Choose a file to import");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);
    formData.append("gym_id", selectedGymId);
    formData.append("location_id", selectedLocationId);

    setLoading(true);
    try {
      const res = await axios.post<BulkImportResponse>(
        "/api/members/bulkimport",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setResult(res.data);
      if (res.data.failed === 0) {
        toast.success(`Imported ${res.data.succeeded} members successfully`);
      } else {
        toast.warning(
          `Imported ${res.data.succeeded} of ${res.data.total} rows (${res.data.failed} failed)`
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      {loading && <FullScreenLoader label="Importing members..." />}

      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/members">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to members
            </Link>
          </Button>
          <h1 className="h1">Bulk import members</h1>
          <p className="text-sm text-muted-foreground">
            Upload a spreadsheet to add many members at once for your selected
            gym and location.
          </p>
        </div>
      </div>

      {!selectedGymId || !selectedLocationId ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Select a gym and location from the header before importing.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Import settings</CardTitle>
            <CardDescription>
              Required columns: full_name, phone_number. For subscription mode
              also include start_date, price, and end_date or months.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Import mode</Label>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as ImportMode)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="members_only"
                    id="members_only"
                  />
                  <Label htmlFor="members_only" className="font-normal">
                    Members only
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="member_with_subscription"
                    id="member_with_subscription"
                  />
                  <Label
                    htmlFor="member_with_subscription"
                    className="font-normal"
                  >
                    Members + subscription + payment
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Download template</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate("csv")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate("xlsx")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Excel
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Upload file</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={handleFileChange}
              />
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center hover:bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                {file ? (
                  <p className="text-sm font-medium">{file.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click to choose .csv or .xlsx (max 500 rows, 5 MB)
                  </p>
                )}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleImport}
              disabled={
                !file ||
                !selectedGymId ||
                !selectedLocationId ||
                loading
              }
            >
              Import members
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Column reference</CardTitle>
            <CardDescription>
              All columns can be included; unused ones are ignored in members-only
              mode.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Required:</strong>{" "}
                full_name, phone_number
              </li>
              <li>
                <strong className="text-foreground">Subscription mode:</strong>{" "}
                start_date, price, end_date or months
              </li>
              <li>
                <strong className="text-foreground">Optional:</strong> email,
                address, city, state, zip_code, country, date_of_birth, cnic,
                payment_method, transaction_id, payment_date
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Import results</CardTitle>
            <CardDescription>
              {result.succeeded} succeeded, {result.failed} failed out of{" "}
              {result.total} rows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.results.map((row) => (
                  <TableRow key={row.row}>
                    <TableCell>{row.row}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "success" ? "default" : "destructive"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.status === "success"
                        ? `Member created`
                        : row.error}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {result.succeeded > 0 && (
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => router.push("/members")}
              >
                View members
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <SubscriptionExpiredModal
        open={showExpiredModal}
        onClose={() => setShowExpiredModal(false)}
      />
    </PageContainer>
  );
}
