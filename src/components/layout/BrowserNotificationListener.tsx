"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeToNotificationRealtime } from "@/lib/services/realtimeServices";

export function BrowserNotificationListener() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.userId) return;
    const identities = new Set([profile.userId, profile.customerId, profile.$id].filter(Boolean));
    return subscribeToNotificationRealtime((record) => {
      const recipient = String(record.recipientUserId || record.userId || "");
      if (recipient && !identities.has(recipient)) return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const title = String(record.title || "AMC MEP update");
      const body = String(record.message || record.description || record.body || "There is a new update on your account.");
      const notice = new Notification(title, { body, tag: `amcmep-${record.$id || title}` });
      notice.onclick = () => { window.focus(); window.location.assign(record.actionUrl || record.link || "/activity"); notice.close(); };
    });
  }, [profile]);

  return null;
}
