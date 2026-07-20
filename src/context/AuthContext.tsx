"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { ID, type Models } from "appwrite";
import { appwrite } from "@/lib/appwrite/client";
import {
  clearCurrentSession,
  clearStoredProfileSession,
  ensureAnonymousSession,
  linkEmailClientProfile,
  loadStoredProfileSession,
  storeProfileSession,
} from "@/lib/services/authServices";
import { fetchClientProfile, readString, readStringArray } from "@/lib/services/appwriteServices";
import type { UserProfile, UserRole } from "@/types";

interface AuthState {
  user: Models.User<Models.Preferences> | null;
  profile: UserProfile | null;
  session: Models.Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  activeRole: UserRole;
  roles: UserRole[];
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  completeEmailSetup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  createGuestSession: () => Promise<void>;
  completeQrProfileSession: (profile: UserProfile) => void;
  switchRole: (role: UserRole) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function guestProfile(user?: Models.User<Models.Preferences> | null): UserProfile {
  const now = new Date().toISOString();
  return {
    $id: user?.$id ?? "guest",
    userId: user?.$id ?? "guest",
    customerId: "",
    name: "Guest",
    email: "",
    phone: "",
    avatar: "",
    city: "",
    state: "",
    country: "India",
    roles: ["guest"],
    activeRole: "guest",
    preferredLanguage: "en",
    businessIds: [],
    activeBusinessId: "",
    createdAt: user?.$createdAt ?? now,
    updatedAt: user?.$updatedAt ?? now,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    activeRole: "guest",
    roles: ["guest"],
  });

  const refreshProfile = useCallback(async () => {
    try {
      const user = await appwrite.account.get();
      if (!user.email) {
        const stored = loadStoredProfileSession();
        if (stored?.profile) {
          const fresh = await appwrite.databases
            .getDocument(
              process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "680b2cfb002805548743",
              process.env.NEXT_PUBLIC_APPWRITE_USERDATA_COLLECTION_ID ??
                process.env.NEXT_PUBLIC_CLIENTS_COLLECTION_ID ??
                "680b30be0039f9a1d03e",
              stored.profile.$id,
            )
            .catch(() => null);
          const profile: UserProfile = fresh
            ? {
                ...stored.profile,
                customerId: readString(fresh, "customerId") || stored.profile.customerId,
                name: readString(fresh, "name") || stored.profile.name,
                email: readString(fresh, "email") || stored.profile.email,
                phone: readString(fresh, "phone") || stored.profile.phone,
                avatar: readString(fresh, "profileImage") || stored.profile.avatar,
                city: readString(fresh, "city"),
                state: readString(fresh, "state"),
                country: readString(fresh, "country") || stored.profile.country || "India",
                roles: (readStringArray(fresh, "roles") as UserRole[]).length
                  ? (readStringArray(fresh, "roles") as UserRole[])
                  : stored.profile.roles,
                activeRole:
                  (readString(fresh, "activeRole") as UserRole) || stored.profile.activeRole,
                businessIds: readStringArray(fresh, "businessIds"),
                activeBusinessId:
                  readString(fresh, "activeBusinessId") || stored.profile.activeBusinessId,
                preferredLanguage:
                  readString(fresh, "language") || stored.profile.preferredLanguage || "en",
                updatedAt: readString(fresh, "updatedAt") || fresh.$updatedAt,
              }
            : stored.profile;
          storeProfileSession(profile);
          setState((prev) => ({
            ...prev,
            user,
            profile,
            isAuthenticated: true,
            activeRole: profile.activeRole,
            roles: profile.roles,
            isLoading: false,
          }));
          return;
        }

        setState((prev) => ({
          ...prev,
          user,
          profile: guestProfile(user),
          isAuthenticated: true,
          activeRole: "guest",
          roles: ["guest"],
          isLoading: false,
        }));
        return;
      }
      const clientProfile = await fetchClientProfile(user.$id);
      const clientRoles = readStringArray(clientProfile ?? {}, "roles") as UserRole[];
      const roles: UserRole[] = clientRoles.length
        ? clientRoles
        : user.prefs?.roles?.length
        ? user.prefs.roles
        : ["customer"];
      const activeRole =
        (readString(clientProfile ?? {}, "activeRole") as UserRole) ||
        (user.prefs?.activeRole as UserRole) ||
        roles[0];

      const profile: UserProfile = {
        $id: clientProfile?.$id ?? user.$id,
        userId: user.$id,
        customerId: readString(clientProfile ?? {}, "customerId"),
        name: readString(clientProfile ?? {}, "name") || user.name || user.prefs?.name || "User",
        email: readString(clientProfile ?? {}, "email") || user.email,
        phone: readString(clientProfile ?? {}, "phone") || user.phone,
        avatar: readString(clientProfile ?? {}, "profileImage") || user.prefs?.avatar,
        city: readString(clientProfile ?? {}, "city"),
        state: readString(clientProfile ?? {}, "state"),
        country: readString(clientProfile ?? {}, "country") || "India",
        roles,
        activeRole,
        referralCode:
          user.prefs?.referralCode ||
          readString(clientProfile ?? {}, "referralCode") ||
          buildReferralCode(readString(clientProfile ?? {}, "customerId") || user.$id),
        preferredLanguage: readString(clientProfile ?? {}, "language") || user.prefs?.preferredLanguage || "en",
        businessIds: readStringArray(clientProfile ?? {}, "businessIds"),
        activeBusinessId: readString(clientProfile ?? {}, "activeBusinessId"),
        createdAt: readString(clientProfile ?? {}, "createdAt") || user.$createdAt,
        updatedAt: readString(clientProfile ?? {}, "updatedAt") || user.$updatedAt,
      };

      setState((prev) => ({
        ...prev,
        user,
        profile,
        isAuthenticated: true,
        activeRole,
        roles,
        isLoading: false,
      }));
    } catch {
      try {
        await ensureAnonymousSession();
        const user = await appwrite.account.get();
        setState((prev) => ({
          ...prev,
          user,
          profile: guestProfile(user),
          isAuthenticated: true,
          activeRole: "guest",
          roles: ["guest"],
          isLoading: false,
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          user: null,
          profile: guestProfile(null),
          isLoading: false,
          isAuthenticated: true,
          activeRole: "guest",
          roles: ["guest"],
        }));
      }
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const logout = useCallback(async () => {
    clearStoredProfileSession();
    await clearCurrentSession();
    setState({
      user: null,
      profile: guestProfile(null),
      session: null,
      isLoading: false,
      isAuthenticated: true,
      activeRole: "guest",
      roles: ["guest"],
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    clearStoredProfileSession();
    await clearCurrentSession();
    await appwrite.account.createEmailPasswordSession(email.trim().toLowerCase(), password);
    const user = await appwrite.account.get();
    await linkEmailClientProfile({ accountId: user.$id, email: user.email, name: user.name });
    await refreshProfile();
  }, [refreshProfile]);

  const completeEmailSetup = useCallback(async (name: string, email: string, password: string) => {
    const trusted = loadStoredProfileSession()?.profile;
    if (!trusted?.$id || !trusted.phone) throw new Error("Verified phone profile is required.");
    await clearCurrentSession();
    try {
      await appwrite.account.create(ID.unique(), email.trim().toLowerCase(), password, name.trim());
    } catch (error: any) {
      if (error?.code !== 409) throw error;
    }
    await appwrite.account.createEmailPasswordSession(email.trim().toLowerCase(), password);
    const user = await appwrite.account.get();
    await linkEmailClientProfile({ accountId: user.$id, email: user.email, name, trustedClientId: trusted.$id });
    clearStoredProfileSession();
    await refreshProfile();
  }, [refreshProfile]);

  const createGuestSession = useCallback(async () => {
    clearStoredProfileSession();
    await clearCurrentSession();
    await ensureAnonymousSession();
    try {
      await appwrite.account.updatePrefs({
        roles: ["guest"],
        activeRole: "guest",
      });
    } catch {}
    const user = await appwrite.account.get().catch(() => null);
    setState((prev) => ({
      ...prev,
      user,
      profile: guestProfile(user),
      session: null,
      isLoading: false,
      isAuthenticated: true,
      activeRole: "guest",
      roles: ["guest"],
    }));
  }, []);

  const completeQrProfileSession = useCallback((profile: UserProfile) => {
    storeProfileSession(profile);
    setState((prev) => ({
      ...prev,
      profile,
      isAuthenticated: true,
      activeRole: profile.activeRole,
      roles: profile.roles,
      isLoading: false,
    }));
  }, []);

  const switchRole = useCallback(
    (role: UserRole) => {
      if (state.roles.includes(role)) {
        setState((prev) => ({ ...prev, activeRole: role }));
      }
    },
    [state.roles]
  );

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        completeEmailSetup,
        logout,
        createGuestSession,
        completeQrProfileSession,
        switchRole,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function buildReferralCode(seed: string) {
  const cleaned = seed.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `AMC${cleaned.slice(-6) || "MEP247"}`;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
