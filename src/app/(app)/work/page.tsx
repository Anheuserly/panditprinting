"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  MessageSquare,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import {
  fetchAssignments,
  fetchBusinessesByIds,
  fetchBusinessRequests,
  fetchMembershipsForIdentity,
  toBusiness,
  toServiceRequest,
} from "@/lib/services/appwriteServices";
import { createWorkspaceHandoff } from "@/lib/services/authServices";
import type { ServiceRequest } from "@/types";

const workspaceUrl =
  process.env.NEXT_PUBLIC_WORKSPACE_URL || "https://workspace.amcmep.in";

export default function WorkPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [openingWorkspace, setOpeningWorkspace] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!profile?.userId) return;
      setLoading(true);
      try {
        const memberships = await fetchMembershipsForIdentity({
          userId: profile.userId,
        });
        const exactMemberships = memberships.filter((item) => {
          const memberUserId = (item as any).userId?.toString().trim();
          return memberUserId === profile.userId;
        });
        const membershipBusinessIds = Array.from(
          new Set(
            [
              ...exactMemberships.map(
                (item) => (item as any).businessId?.toString() || "",
              ),
            ].filter(Boolean),
          ),
        );
        const businessDocuments = await fetchBusinessesByIds(
          membershipBusinessIds,
        );
        const connectedIds = businessDocuments
          .map(toBusiness)
          .filter((business) => business.status === "active")
          .map((business) => business.$id);
        if (!connectedIds.length) {
          router.replace("/business");
          return;
        }
        setBusinessIds(connectedIds);
        const [requestRows, assignmentRows] = await Promise.all([
          Promise.all(
            connectedIds.map((businessId) => fetchBusinessRequests(businessId)),
          ),
          Promise.all(
            connectedIds.map((businessId) => fetchAssignments({ businessId })),
          ),
        ]);
        const merged = new Map(
          requestRows.flat().map((row) => [row.$id, toServiceRequest(row)]),
        );
        assignmentRows.flat().forEach((row) => {
          const request = toServiceRequest({
            ...row,
            $id: row.requestId || row.serviceRequestId || row.$id,
            title: row.serviceType
              ? `${row.serviceType} work`
              : "Assigned work",
            siteAddress: row.siteName,
            createdAt: row.assignedAt || row.$createdAt,
          });
          if (!merged.has(request.$id)) merged.set(request.$id, request);
        });
        if (alive)
          setRequests(
            Array.from(merged.values()).sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt),
            ),
          );
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [profile?.userId, router]);

  const active = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status === "open" ||
          request.status === "in_progress" ||
          request.status === "awaiting_payment",
      ),
    [requests],
  );
  const completed = requests.filter(
    (request) => request.status === "completed",
  ).length;
  async function openWorkspace() {
    if (!profile || !businessIds.length) return;
    setOpeningWorkspace(true);
    try {
      const token = await createWorkspaceHandoff(profile);
      window.location.assign(
        `${workspaceUrl}/?sso=${encodeURIComponent(token)}`,
      );
    } finally {
      setOpeningWorkspace(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-blue-600">Work</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Requests that need attention
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Assigned service work from every business connected to your account.
          </p>
        </div>
        {businessIds.length ? (
          <button
            onClick={openWorkspace}
            disabled={openingWorkspace}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {openingWorkspace ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Open workspace <ArrowUpRight size={17} />
          </button>
        ) : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Needs action"
          value={active.length}
          icon={ClipboardList}
          tone="blue"
        />
        <Metric
          label="In progress"
          value={
            requests.filter((item) => item.status === "in_progress").length
          }
          icon={BriefcaseBusiness}
          tone="amber"
        />
        <Metric
          label="Completed"
          value={completed}
          icon={CheckCircle2}
          tone="green"
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-950">Active requests</h2>
          <p className="mt-1 text-xs text-slate-500">
            Only work connected to your business memberships is shown.
          </p>
        </div>
        {loading ? (
          <div className="grid min-h-52 place-items-center">
            <Loader2 className="size-6 animate-spin text-blue-600" />
          </div>
        ) : active.length ? (
          <div className="divide-y divide-slate-100">
            {active.map((request) => (
              <article
                key={request.$id}
                className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_150px_190px] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-slate-950">
                      {request.title}
                    </h3>
                    <Status value={request.status} />
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                    {request.description}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin size={13} />{" "}
                    {request.siteAddress || "Location not added"}
                  </p>
                </div>
                <p className="text-xs font-semibold text-slate-600">
                  {request.serviceType}
                </p>
                <div className="flex items-center justify-end gap-2">
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar size={13} />{" "}
                    {new Date(request.createdAt).toLocaleDateString("en-IN")}
                  </span>
                  <a
                    href={`/chats?requestId=${request.$id}`}
                    title="Open chat"
                    className="grid size-9 place-items-center rounded-md border border-slate-200 text-blue-700 hover:bg-blue-50"
                  >
                    <MessageSquare size={16} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <CheckCircle2 className="mx-auto text-emerald-500" size={30} />
            <h2 className="mt-4 font-bold text-slate-900">
              No work needs attention
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {businessIds.length
                ? "New assigned requests will appear here automatically."
                : "Create a business or join a business team to receive work."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof ClipboardList;
  tone: "blue" | "amber" | "green";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
  };
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div
        className={`grid size-9 place-items-center rounded-md ${tones[tone]}`}
      >
        <Icon size={17} />
      </div>
      <p className="mt-4 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
    </article>
  );
}
function Status({ value }: { value: ServiceRequest["status"] }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[11px] font-bold capitalize ${value === "in_progress" ? "bg-blue-50 text-blue-700" : value === "awaiting_payment" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
