"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Building2, Check, CheckCircle2, Loader2, MapPin, MessageSquare, Plus, Search, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import toast from "react-hot-toast";

import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { addBusinessPartner, createBusiness, fetchBusinessMemberships, fetchBusinessesByIds, fetchMembershipsForUser, fetchWorkspacePeople, toBusiness, toWorkspaceMembership } from "@/lib/services/appwriteServices";
import type { Business, WorkspaceMembership, WorkspacePerson } from "@/types";
import { createWorkspaceHandoff } from "@/lib/services/authServices";

const workspaceUrl = process.env.NEXT_PUBLIC_WORKSPACE_URL || "https://workspace.amcmep.in";

export default function BusinessPage() {
  const { profile, refreshProfile } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [people, setPeople] = useState<WorkspacePerson[]>([]);
  const [activeId, setActiveId] = useState(profile?.activeBusinessId || "");
  const [loading, setLoading] = useState(true);
  const [showPartners, setShowPartners] = useState(false);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openingChat, setOpeningChat] = useState("");
  const [draft, setDraft] = useState({ name: "", businessType: "Service Provider", city: "" });

  const load = async () => {
    if (!profile?.userId) return;
    setLoading(true);
    try {
      const ownMembershipRows = await fetchMembershipsForUser(profile.userId);
      const ownMemberships = ownMembershipRows.map(toWorkspaceMembership);
      const ids = Array.from(new Set([...(profile.businessIds || []), ...ownMemberships.map((item) => item.businessId)].filter(Boolean)));
      const businessRows = await fetchBusinessesByIds(ids);
      const mapped = businessRows.map(toBusiness);
      const preferred = mapped.some((item) => item.$id === activeId) ? activeId : mapped.find((item) => item.$id === profile.activeBusinessId)?.$id || mapped[0]?.$id || "";
      setBusinesses(mapped); setActiveId(preferred);
      if (preferred) setMemberships((await fetchBusinessMemberships(preferred)).map(toWorkspaceMembership));
      setPeople(await fetchWorkspacePeople(profile.userId));
    } catch { toast.error("Unable to load business records"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [profile?.businessIds, profile?.userId]);
  useEffect(() => { if (!activeId) return; fetchBusinessMemberships(activeId).then((rows) => setMemberships(rows.map(toWorkspaceMembership))).catch(() => {}); }, [activeId]);

  const business = businesses.find((item) => item.$id === activeId);
  const viewer = memberships.find((item) => item.userId === profile?.userId);
  const canManage = business?.ownerId === profile?.userId || viewer?.role === "owner" || viewer?.role === "admin" || viewer?.permissions.includes("manage_members");
  const memberIds = new Set(memberships.map((item) => item.userId));
  const personByUserId = new Map(people.map((person) => [person.userId, person]));
  const candidates = useMemo(() => people.filter((person) => !memberIds.has(person.userId)).filter((person) => `${person.name} ${person.company} ${person.partnerSkills.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [people, memberships, query]);

  const addPartner = async (person: WorkspacePerson) => {
    if (!business || !profile?.userId) return;
    setSavingId(person.userId);
    try { await addBusinessPartner({ business, person, invitedBy: profile.userId }); toast.success(`${person.name} added to ${business.name}`); await load(); }
    catch (error: any) { toast.error(error?.message || "Unable to add partner"); }
    finally { setSavingId(""); }
  };

  const handleCreate = async () => {
    if (!profile?.$id || !profile.userId) return;
    if (draft.name.trim().length < 2 || !draft.city.trim()) { toast.error("Add a business name and primary city"); return; }
    setCreating(true);
    try {
      await createBusiness({ clientDocumentId: profile.$id, userId: profile.userId, ownerName: profile.name, ...draft });
      await refreshProfile();
      setShowCreate(false);
      setDraft({ name: "", businessType: "Service Provider", city: "" });
      await load();
      toast.success("Business created");
    } catch (error: any) { toast.error(error?.message || "Unable to create business"); }
    finally { setCreating(false); }
  };

  const openCommunication = async (member?: WorkspaceMembership, name?: string) => {
    if (!profile || !business) return;
    setOpeningChat(member?.userId || "all");
    try {
      const token = await createWorkspaceHandoff(profile);
      const params = new URLSearchParams({ sso: token, businessId: business.$id });
      if (member) {
        params.set("startUserId", member.userId);
        params.set("startName", name || member.memberName || "Business member");
        params.set("conversationType", member.role === "partner" ? "partner" : "team");
      }
      window.location.assign(`${workspaceUrl}/communication?${params.toString()}`);
    } catch (error: any) {
      toast.error(error?.message || "Communication could not be opened");
      setOpeningChat("");
    }
  };

  if (loading && !businesses.length) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-7 animate-spin text-blue-600" /></div>;
  if (!business) return <div className="mx-auto max-w-3xl py-20 text-center"><div className="mx-auto grid size-14 place-items-center rounded-lg bg-blue-50 text-blue-600"><Building2 size={26} /></div><h1 className="mt-5 text-2xl font-black text-slate-950">Create your first business</h1><p className="mt-2 text-sm text-slate-500">Add a business profile to receive work and open its management workspace.</p><button onClick={() => setShowCreate(true)} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white"><Plus size={17} /> Add business</button>{showCreate ? <CreateBusinessDialog draft={draft} setDraft={setDraft} creating={creating} onCreate={handleCreate} onClose={() => setShowCreate(false)} /> : null}</div>;

  return <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase text-blue-600">Business</p><h1 className="mt-2 text-3xl font-black text-slate-950">Business and partner management</h1><p className="mt-2 text-sm text-slate-600">Manage the business identity and enrolled partners separately from daily work.</p></div><div className="flex gap-2"><select value={activeId} onChange={(event) => setActiveId(event.target.value)} className="h-11 min-w-48 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">{businesses.map((item) => <option key={item.$id} value={item.$id}>{item.name}</option>)}</select><button onClick={() => setShowCreate(true)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white"><Plus size={17} /> Add business</button></div></header>

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"><article className="rounded-lg border border-slate-200 bg-white p-6"><div className="flex items-start gap-4"><div className="grid size-14 shrink-0 place-items-center rounded-lg bg-slate-950 text-white"><Building2 size={25} /></div><div className="min-w-0"><h2 className="truncate text-xl font-bold text-slate-950">{business.name}</h2><p className="mt-1 text-sm text-slate-500">{business.description || "AMC MEP business profile"}</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Detail icon={MapPin} label="Location" value={[business.city,business.state].filter(Boolean).join(", ") || "Not added"} /><Detail icon={CheckCircle2} label="Status" value={business.status} /><Detail icon={Users} label="Members" value={String(memberships.length)} /></div></article><aside className="rounded-lg border border-blue-200 bg-blue-50 p-5"><ShieldCheck className="text-blue-600" size={22} /><h2 className="mt-4 font-bold text-slate-950">Your access</h2><p className="mt-2 text-sm capitalize text-slate-600">{viewer?.role || (business.ownerId === profile?.userId ? "Owner" : "Member")}</p><p className="mt-2 text-xs leading-5 text-slate-500">Member actions follow the live permissions stored for this business.</p></aside></section>

    <section className="rounded-lg border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-950">Team and partners</h2><p className="mt-1 text-xs text-slate-500">{memberships.length} active member{memberships.length === 1 ? "" : "s"}</p></div><div className="flex gap-2"><button onClick={() => void openCommunication()} disabled={Boolean(openingChat)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{openingChat === "all" ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare size={16} />} Communication <ArrowUpRight size={15} /></button>{canManage ? <button onClick={() => setShowPartners(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white"><UserPlus size={16} /> Add partner</button> : null}</div></div><div className="divide-y divide-slate-100">{memberships.map((member) => { const person=personByUserId.get(member.userId); const isCurrentUser=member.userId === profile?.userId; const name=(isCurrentUser ? profile?.name : "") || member.memberName || person?.name || `Member ${member.userId.slice(-4)}`; return <article key={member.$id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"><Avatar src={isCurrentUser ? profile?.avatar : person?.avatar} name={name} size="md" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-slate-950">{name}</p>{person?.partnerVerified ? <Check className="text-blue-600" size={15} /> : null}<span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold capitalize text-slate-600">{member.role}</span></div><p className="mt-1 text-xs text-slate-500">{[person?.company, person?.partnerType?.replaceAll("_", " & "), member.onDuty === false ? "Off duty" : "Available"].filter(Boolean).join(" · ")}</p></div><div className="flex items-center gap-3"><div className="text-xs text-slate-500"><p>{member.permissions.length} permissions</p><p className="mt-1">Joined {new Date(member.joinedAt).toLocaleDateString("en-IN")}</p></div>{!isCurrentUser ? <button onClick={() => void openCommunication(member, name)} disabled={Boolean(openingChat)} className="grid size-9 shrink-0 place-items-center rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50" aria-label={`Message ${name}`} title={`Message ${name}`}>{openingChat === member.userId ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare size={16} />}</button> : null}</div></article>; })}</div></section>

    {showPartners ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><section className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="text-lg font-bold text-slate-950">Add enrolled partner</h2><p className="mt-1 text-xs text-slate-500">Service, vendor, and hybrid partners from live userData profiles.</p></div><button onClick={() => setShowPartners(false)} className="grid size-9 place-items-center rounded-md hover:bg-slate-100" aria-label="Close"><X size={18} /></button></header><div className="p-5"><label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, business, or skill" className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-blue-500" /></label></div><div className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto px-5 pb-5">{candidates.length ? candidates.map((person) => <article key={person.userId} className="flex items-center gap-3 py-4"><Avatar src={person.avatar} name={person.name} size="md" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-950">{person.name}</p><p className="mt-1 truncate text-xs text-slate-500">{[person.company,person.partnerType.replaceAll("_"," & "),person.partnerSkills.slice(0,2).join(", ")].filter(Boolean).join(" · ")}</p></div><button disabled={savingId === person.userId} onClick={() => addPartner(person)} className="inline-flex h-9 items-center gap-2 rounded-md border border-blue-200 px-3 text-xs font-bold text-blue-700 disabled:opacity-50"><Plus size={14} /> {savingId === person.userId ? "Adding..." : "Add"}</button></article>) : <div className="py-12 text-center text-sm text-slate-500">No eligible enrolled partners found.</div>}</div></section></div> : null}
    {showCreate ? <CreateBusinessDialog draft={draft} setDraft={setDraft} creating={creating} onCreate={handleCreate} onClose={() => setShowCreate(false)} /> : null}
  </div>;
}

function Detail({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-4"><Icon size={17} className="text-blue-600" /><p className="mt-3 text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-bold capitalize text-slate-900">{value}</p></div>; }

function CreateBusinessDialog({ draft, setDraft, creating, onCreate, onClose }: { draft: { name: string; businessType: string; city: string }; setDraft: React.Dispatch<React.SetStateAction<{ name: string; businessType: string; city: string }>>; creating: boolean; onCreate: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 text-left"><section className="w-full max-w-md rounded-lg bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="text-lg font-bold text-slate-950">Add business</h2><p className="mt-1 text-xs text-slate-500">Create another business under your account.</p></div><button onClick={onClose} className="grid size-9 place-items-center rounded-md hover:bg-slate-100" aria-label="Close"><X size={18} /></button></header><div className="space-y-4 p-5"><label className="block text-sm font-bold text-slate-700">Business name<input autoFocus value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-blue-500" /></label><label className="block text-sm font-bold text-slate-700">Business type<select value={draft.businessType} onChange={(event) => setDraft((value) => ({ ...value, businessType: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal"><option>Service Provider</option><option>Vendor</option><option>Service &amp; Vendor</option></select></label><label className="block text-sm font-bold text-slate-700">Primary city<input value={draft.city} onChange={(event) => setDraft((value) => ({ ...value, city: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-blue-500" /></label><button disabled={creating} onClick={onCreate} className="h-11 w-full rounded-lg bg-blue-600 text-sm font-bold text-white disabled:opacity-60">{creating ? "Creating..." : "Create business"}</button></div></section></div>;
}
