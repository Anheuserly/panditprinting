"use client";

import { useEffect, useState } from "react";
import { Bell, MapPin, X } from "lucide-react";

export function BrowserAccessPrompt() {
  const [visible, setVisible] = useState(false);
  const [notificationState, setNotificationState] = useState<NotificationPermission | "unsupported">("unsupported");
  const [locationEnabled, setLocationEnabled] = useState(false);

  useEffect(() => {
    setNotificationState("Notification" in window ? Notification.permission : "unsupported");
    setLocationEnabled(localStorage.getItem("amcmep-location-enabled") === "true");
    setVisible(localStorage.getItem("amcmep-browser-access-dismissed") !== "true");
  }, []);

  if (!visible || (notificationState !== "default" && locationEnabled)) return null;
  return <div className="fixed bottom-4 right-4 z-50 w-[min(390px,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
    <button onClick={() => { localStorage.setItem("amcmep-browser-access-dismissed", "true"); setVisible(false); }} className="absolute right-3 top-3 text-slate-400" title="Dismiss"><X className="size-4" /></button>
    <h2 className="pr-6 text-sm font-semibold text-slate-900">Stay updated</h2>
    <p className="mt-1 text-xs leading-5 text-slate-600">Enable alerts for new messages and calls. Location is used only when you choose nearby service features.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {notificationState === "default" && <button onClick={async () => setNotificationState(await Notification.requestPermission())} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-medium text-white"><Bell className="size-4" />Enable alerts</button>}
      {!locationEnabled && "geolocation" in navigator && <button onClick={() => navigator.geolocation.getCurrentPosition(() => { localStorage.setItem("amcmep-location-enabled", "true"); setLocationEnabled(true); }, () => undefined, { enableHighAccuracy: false, timeout: 10000 })} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700"><MapPin className="size-4" />Allow location</button>}
    </div>
  </div>;
}
