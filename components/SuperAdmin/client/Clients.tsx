"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Session } from "next-auth";
import Link from "next/link";
import { columns } from "./columns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Client as ClientType } from "@/types";
import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import DataFetchError from "@/components/common/DataFetchError";
import { Loader2 } from "lucide-react";

const Subscription = ({ session }: { session: Session }) => {
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 1000);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["clients", pagination.pageIndex, pagination.pageSize, debouncedFilter],
    queryFn: async () => {
      const response = await axios.post("/api/clients/getclients", {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: debouncedFilter,
      });
      return response.data as { data: ClientType[]; totalCount: number; pageCount: number };
    },
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (!inviteSuccess) return;
    const timer = setTimeout(() => {
      setInviteOpen(false);
      setInviteSuccess(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [inviteSuccess]);

  const handleInvite = async () => {
    setInviteError("");
    setInviteLoading(true);
    try {
      await axios.post("/api/clients/invite", { email: inviteEmail });
      setInviteSuccess(true);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to send invite";
      setInviteError(message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInviteOpenChange = (open: boolean) => {
    setInviteOpen(open);
    if (!open) {
      setInviteError("");
      setInviteSuccess(false);
      setInviteEmail("");
    }
  };

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1">Clients</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setInviteOpen(true)}>
            Invite Client
          </Button>
          <Link href={`/clients/manage?action=create`}>
            <Button>Create Client</Button>
          </Link>
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={handleInviteOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Gym Owner</DialogTitle>
          </DialogHeader>
          {inviteSuccess ? (
            <p className="text-sm text-green-600">Invite sent!</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="owner@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviteLoading}
                />
                <p className="text-muted-foreground text-sm">
                  They&apos;ll receive an email with a link to complete their profile.
                </p>
              </div>
              {inviteError && (
                <p className="text-destructive text-sm">{inviteError}</p>
              )}
            </div>
          )}
          {!inviteSuccess && (
            <DialogFooter>
              <Button
                onClick={handleInvite}
                disabled={inviteLoading || !inviteEmail.trim()}
              >
                {inviteLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Invite"
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {isLoading && !data && (
        <div className="flex justify-center items-center h-64">
          <FullScreenLoader label="Loading Clients..." />
        </div>
      )}

      {error && (
        <DataFetchError
          error={error}
          onRetry={() => refetch()}
          message="Error loading clients"
        />
      )}

      {data && (
        <DataTable
          columns={columns}
          data={data.data}
          searchableColumns={["first_name", "last_name", "email"]}
          pageCount={data.pageCount}
          rowCount={data.totalCount}
          onPaginationChange={setPagination}
          onSearchChange={setGlobalFilter}
          pagination={pagination}
          searchValue={globalFilter}
        />
      )}
    </PageContainer>
  );
};

export default Subscription;
