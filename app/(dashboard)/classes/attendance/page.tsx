/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import FullScreenLoader from "@/components/common/FullScreenLoader";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { redirect, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/use-debounce";
import { CATEGORY_LABELS } from "@/components/classes/columns";

type MemberRow = {
  id: string;
  user: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone_number: string | null;
  };
};

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "";

const NONE = "__none__";

const AttendanceContent = () => {
  const { data: session, status } = useSession({ required: true });
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [classId, setClassId] = useState(searchParams?.get("class_id") || "");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [recordedById, setRecordedById] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});

  const selectedGymId = session?.user?.selected_gym_id;
  const selectedLocationId = session?.user?.selected_location_id;

  const { data: classesData } = useQuery({
    queryKey: ["classes", "attendance-picker", selectedGymId, selectedLocationId],
    queryFn: async () => {
      const res = await axios.post("/api/classes/getclasses", {
        page: 1,
        limit: 200,
        gym_id: selectedGymId,
        location_id: selectedLocationId || undefined,
      });
      return res.data.data as Array<{
        id: string;
        name: string;
        category: string;
        start_time: string | null;
      }>;
    },
    enabled: !!selectedGymId,
  });

  const { data: staffList } = useQuery({
    queryKey: ["staff", "recorders", selectedGymId],
    queryFn: async () => {
      const res = await axios.post("/api/staff/getstaffs", {
        page: 1,
        limit: 200,
        gym_id: selectedGymId,
      });
      return res.data.data as Array<{
        id: string;
        first_name: string;
        last_name: string | null;
      }>;
    },
    enabled: !!selectedGymId,
  });

  const { data: membersData, isLoading: loadingMembers } = useQuery({
    queryKey: ["members", "attendance", selectedGymId, selectedLocationId, debouncedSearch],
    queryFn: async () => {
      const res = await axios.post("/api/members/getmembers", {
        page: 1,
        limit: 100,
        search: debouncedSearch,
        gym_id: selectedGymId,
        location_id: selectedLocationId || undefined,
      });
      return res.data.data as MemberRow[];
    },
    enabled: !!selectedGymId && !!classId,
  });

  const { data: attendanceData } = useQuery({
    queryKey: ["attendance", classId, date],
    queryFn: async () => {
      const res = await axios.post("/api/classes/attendance/getattendance", {
        class_id: classId,
        attendance_date: date,
      });
      return res.data.data as Array<{
        member_id: string;
        status: AttendanceStatus;
      }>;
    },
    enabled: !!classId && !!date,
  });

  useEffect(() => {
    if (!attendanceData) return;
    const next: Record<string, AttendanceStatus> = {};
    for (const row of attendanceData) {
      next[row.member_id] = row.status;
    }
    setMarks(next);
  }, [attendanceData, classId, date]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const records = Object.entries(marks)
        .filter(([, status]) => status)
        .map(([member_id, status]) => ({ member_id, status }));
      if (records.length === 0) {
        throw new Error("Mark at least one member before saving");
      }
      return axios.post("/api/classes/attendance/recordattendance", {
        class_id: classId,
        attendance_date: date,
        recorded_by_id: recordedById || null,
        records,
      });
    },
    onSuccess: () => {
      toast.success("Attendance saved");
      queryClient.invalidateQueries({ queryKey: ["attendance", classId, date] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });

  const members = membersData ?? [];

  const visibleMembers = useMemo(() => members, [members]);

  if (status === "loading") {
    return <FullScreenLoader />;
  }
  if (session?.user?.role !== "GYM_OWNER") {
    return redirect("/unauthorized");
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h1 className="h1">Class attendance</h1>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!classId || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save attendance"}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label>Class</Label>
            <Select value={classId || NONE} onValueChange={(v) => setClassId(v === NONE ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Select class</SelectItem>
                {(classesData ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({CATEGORY_LABELS[c.category] || c.category}
                    {c.start_time ? ` ${c.start_time}` : ""})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Recorded by (optional)</Label>
            <Select
              value={recordedById || NONE}
              onValueChange={(v) => setRecordedById(v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Gym owner</SelectItem>
                {(staffList ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {`${s.first_name} ${s.last_name ?? ""}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Search members</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, phone"
              disabled={!classId}
            />
          </div>
        </div>

        {!classId && (
          <p className="text-sm text-muted-foreground">Select a class to load the check-in sheet.</p>
        )}

        {classId && loadingMembers && <FullScreenLoader label="Loading members..." />}

        {classId && !loadingMembers && (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">Member</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleMembers.length === 0 && (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={3}>
                      No members found for this gym/location.
                    </td>
                  </tr>
                )}
                {visibleMembers.map((m) => {
                  const name =
                    `${m.user?.first_name ?? ""} ${m.user?.last_name ?? ""}`.trim() || "—";
                  const contact = m.user?.phone_number || m.user?.email || "—";
                  const value = marks[m.id] || "";
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{name}</td>
                      <td className="p-3 text-muted-foreground">{contact}</td>
                      <td className="p-3">
                        <Select
                          value={value || NONE}
                          onValueChange={(v) =>
                            setMarks((prev) => ({
                              ...prev,
                              [m.id]: (v === NONE ? "" : v) as AttendanceStatus,
                            }))
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Unset" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Unset</SelectItem>
                            <SelectItem value="PRESENT">Present</SelectItem>
                            <SelectItem value="ABSENT">Absent</SelectItem>
                            <SelectItem value="LATE">Late</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

const AttendancePage = () => (
  <Suspense fallback={<FullScreenLoader label="Loading..." />}>
    <AttendanceContent />
  </Suspense>
);

export default AttendancePage;
