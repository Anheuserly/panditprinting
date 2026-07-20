"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import {
  Bell,
  Briefcase,
  Building2,
  ClipboardList,
  Home,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCircle,
  X,
} from "lucide-react";
import type { UserRole } from "@/types";
import {
  fetchBusinessesByIds,
  fetchMembershipsForIdentity,
  toBusiness,
} from "@/lib/services/appwriteServices";

const navItems: Array<{
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  external?: boolean;
}> = [
  {
    label: "Home",
    href: "/",
    icon: Home,
    roles: ["customer", "partner", "administrator"],
  },
  {
    label: "Assistant",
    href: "/assistant",
    icon: MessageSquare,
    roles: ["customer", "partner", "administrator"],
  },
  {
    label: "Messages",
    href: "/chats",
    icon: MessageSquare,
    roles: ["customer", "partner", "administrator"],
  },
  {
    label: "Market",
    href: "/marketplace",
    icon: ShoppingCart,
    roles: ["customer", "partner", "administrator"],
  },
  {
    label: "Requests",
    href: "/requests",
    icon: ClipboardList,
    roles: ["customer", "partner", "administrator"],
  },
  {
    label: "AMC Care",
    href: "/amc",
    icon: ShieldCheck,
    roles: ["customer", "partner", "administrator"],
  },
  {
    label: "Work",
    href: "/work",
    icon: Briefcase,
    roles: ["customer", "partner", "administrator"],
  },
  {
    label: "Business",
    href: "/business",
    icon: Building2,
    roles: ["customer", "partner", "administrator"],
  },
  {
    label: "Activity",
    href: "/activity",
    icon: Bell,
    roles: ["customer", "partner", "administrator"],
  },
  { label: "Profile", href: "/profile", icon: UserCircle, roles: ["customer", "partner", "administrator"] },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function Sidebar({ isOpen, onClose, collapsed, onCollapsedChange }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, activeRole } = useAuth();
  const [hasBusinessAccess, setHasBusinessAccess] = useState(false);

  useEffect(() => {
    let active = true;
    setHasBusinessAccess(false);

    if (!profile?.userId) return;

    fetchMembershipsForIdentity({
      userId: profile.userId,
    })
      .then(async (memberships) => {
        if (!active) return;

        const businessIds = memberships
          .filter((row) => {
            const memberUserId = (row as any).userId?.toString().trim();
            return memberUserId === profile.userId;
          })
          .map((row) => (row as any).businessId?.toString().trim())
          .filter(Boolean);
        const businesses = await fetchBusinessesByIds(businessIds);
        if (!active) return;
        const hasActiveBusiness = businesses
          .map(toBusiness)
          .some((business) => business.status === "active");

        setHasBusinessAccess(hasActiveBusiness);
      })
      .catch(() => {
        if (active) setHasBusinessAccess(false);
      });

    return () => {
      active = false;
    };
  }, [profile?.userId]);

  const handleNav = (href: string, external = false) => {
    if (external) {
      window.location.assign(href);
      return;
    }
    router.push(href);
    onClose();
  };

  const filteredItems = navItems.filter(
    (item) =>
      item.roles.includes(activeRole) &&
      (item.href !== "/work" || hasBusinessAccess),
  );

  return (
    <>
      {isOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r border-slate-200 bg-white transition-[width,transform] duration-200 ease-out lg:translate-x-0 ${collapsed ? "lg:w-20" : "lg:w-64"} ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 p-4 lg:hidden">
            <p className="text-sm font-bold text-slate-900">Navigation</p>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="hidden justify-end border-b border-slate-100 p-2 lg:flex">
            <button onClick={() => onCollapsedChange(!collapsed)} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"}>
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </button>
          </div>

          <nav className={`flex-1 overflow-y-auto py-3 ${collapsed ? "lg:px-2" : "px-3"}`}>
            <ul className="space-y-1">
              {filteredItems.map((item) => {
                const active =
                  !item.external &&
                  (pathname === item.href ||
                    (item.href !== "/" &&
                      pathname.startsWith(`${item.href}/`)));
                return (
                  <li key={item.href}>
                    <button
                      onClick={() => handleNav(item.href, item.external)}
                      title={collapsed ? item.label : undefined}
                      className={`group flex h-11 w-full items-center rounded-lg text-sm font-semibold transition-all ${collapsed ? "lg:justify-center lg:px-0" : "gap-3 px-3"} ${
                        active
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-lg ${active ? "bg-white/15" : "bg-white text-slate-400 group-hover:text-blue-600"}`}
                      >
                        <item.icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {activeRole === "guest" && (
            <div className="px-3 pb-3">
              <button
                onClick={() => handleNav("/login")}
                className="w-full rounded-2xl border border-blue-100 bg-blue-50 p-3 text-left hover:bg-blue-100"
              >
                <p className="text-sm font-bold text-blue-900">
                  Sign in for full access
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-700">
                  Requests, chats, and AMC records need an account.
                </p>
              </button>
            </div>
          )}

          <div className={`border-t border-slate-100 p-2 ${collapsed ? "lg:grid lg:gap-1" : "flex items-center gap-1"}`}>
            <button onClick={() => handleNav("/profile")} className={`flex h-11 min-w-0 flex-1 items-center rounded-lg text-left hover:bg-slate-100 ${collapsed ? "lg:justify-center" : "gap-3 px-2"}`} title="Profile">
              <Avatar src={profile?.avatar} name={profile?.name || "User"} size="sm" />
              <span className={`min-w-0 flex-1 truncate text-sm font-bold text-slate-800 ${collapsed ? "lg:hidden" : ""}`}>{profile?.name || "Profile"}</span>
            </button>
            <button onClick={() => handleNav("/settings")} className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Settings" title="Settings"><Settings className="size-5" /></button>
          </div>
        </div>
      </aside>
    </>
  );
}
