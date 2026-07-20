"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { consumeApprovedQrLogin, createQrLoginSession, fetchQrLoginSession, type QrLoginSession } from "@/lib/services/authServices";
import toast from "react-hot-toast";
import { CheckCircle2, HelpCircle, Loader2, LockKeyhole, Mail, QrCode, RefreshCw, Smartphone } from "lucide-react";

export default function QrLoginPage() {
  const { completeQrProfileSession, login } = useAuth();
  const [mode, setMode] = useState<"qr" | "email">("qr");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [emailLoading, setEmailLoading] = useState(false);
  const [session, setSession] = useState<QrLoginSession | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("Creating secure QR...");
  const [error, setError] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getDestination = () => {
    const requested = new URLSearchParams(window.location.search).get("returnTo");
    if (!requested) return "/";
    if (requested.startsWith("/") && !requested.startsWith("//")) return requested;
    try {
      const url = new URL(requested);
      return url.protocol === "https:" && url.hostname === "workspace.amcmep.in" ? url.toString() : "/";
    } catch {
      return "/";
    }
  };

  const stopPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
  };

  const startSession = async () => {
    stopPolling();
    setIsLoading(true);
    setError("");
    setMessage("Creating secure QR...");
    try {
      const nextSession = await createQrLoginSession();
      const image = await QRCode.toDataURL(nextSession.payload, {
        width: 260,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setSession(nextSession);
      setQrImage(image);
      setMessage("Open AMC MEP 24x7 One on your verified phone and scan this QR.");
      pollingRef.current = setInterval(async () => {
        try {
          const latest = await fetchQrLoginSession(nextSession.token);
          if (!latest) return;
          if (new Date(latest.expiresAt).getTime() < Date.now()) {
            stopPolling();
            setError("This QR expired. Generate a new code.");
            setMessage("");
            return;
          }
          if (latest.status === "approved") {
            stopPolling();
            const profile = await consumeApprovedQrLogin(latest.token);
            completeQrProfileSession(profile);
            toast.success("Device login approved");
            const destination = getDestination();
            window.location.replace(!profile.name?.trim() || !profile.email?.trim() ? `/complete-profile?returnTo=${encodeURIComponent(destination)}` : destination);
          } else if (latest.status === "used" || latest.status === "expired") {
            stopPolling();
            setError(latest.status === "used" ? "This QR was already used." : "This QR expired. Generate a new code.");
            setMessage("");
          }
        } catch {
          setMessage("Waiting for approval from your phone...");
        }
      }, 4000);
    } catch (err: any) {
      setError(err.message || "Unable to create QR login.");
      setMessage("");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    startSession();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitEmail(event: React.FormEvent) { event.preventDefault(); setEmailLoading(true); setError(""); try { await login(email, password); window.location.replace(getDestination()); } catch (err: any) { setError(err?.code === 401 ? "Email or password is incorrect." : err?.message || "Unable to sign in."); } finally { setEmailLoading(false); } }

  return (
    <div className="animate-fade-in">
      <Card className="border-slate-200 shadow-xl shadow-slate-200/60">
        <CardContent className="p-6 sm:p-7">
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            <button onClick={() => { setMode("qr"); if (!pollingRef.current) startSession(); }} className={`h-10 rounded-md text-sm font-bold ${mode === "qr" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Phone QR</button>
            <button onClick={() => { stopPolling(); setMode("email"); setError(""); }} className={`h-10 rounded-md text-sm font-bold ${mode === "email" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Email</button>
          </div>
          <div className="mb-6">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <QrCode className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">{mode === "qr" ? "Sign in from your phone" : "Sign in with email"}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">{mode === "qr" ? "Open AMC MEP 24x7 One on your verified phone, then scan this code from your profile." : "Use the email and password already connected to your mobile profile."}</p>
          </div>
          {mode === "email" ? <form onSubmit={submitEmail} className="space-y-4"><label className="block"><span className="text-xs font-bold text-slate-700">Email address</span><div className="relative mt-2"><Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/><input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3 text-sm" placeholder="Enter your email address"/></div></label><label className="block"><span className="text-xs font-bold text-slate-700">Password</span><div className="relative mt-2"><LockKeyhole className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/><input required minLength={8} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3 text-sm" placeholder="Enter your password"/></div></label>{error ? <p className="rounded-md bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800">{error}</p> : null}<Button className="w-full" disabled={emailLoading}>{emailLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : null}Sign in</Button></form> : <>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex min-h-[292px] items-center justify-center rounded-2xl bg-white p-4 shadow-sm">
              {isLoading ? (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="text-sm font-semibold">{message}</span>
                </div>
              ) : qrImage ? (
                <img src={qrImage} alt="AMC MEP QR login code" className="h-[260px] w-[260px]" />
              ) : (
                <QrCode className="h-24 w-24 text-slate-300" />
              )}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex gap-3">
              {error ? <RefreshCw className="mt-0.5 h-5 w-5 text-orange-600" /> : <Smartphone className="mt-0.5 h-5 w-5 text-blue-700" />}
              <div>
                <p className={`text-sm font-bold ${error ? "text-orange-800" : "text-blue-900"}`}>
                  {error || "Waiting for mobile approval"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {error || message || "The browser will continue automatically when the phone approves this login."}
                </p>
              </div>
            </div>
          </div>

          {session && !error && (
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Expires at {new Date(session.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}

          <Button variant="outline" className="mt-5 w-full" onClick={startSession} disabled={isLoading}>
            <RefreshCw className="h-4 w-4" />
            Generate new QR
          </Button>
          </>}
          <div className="mt-5 border-t border-slate-100 pt-5 text-center">
            <p className="text-xs leading-5 text-slate-500">Accounts are created and verified only in the AMC MEP mobile app.</p>
            <a href="https://www.amcmep.in/support" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800"><HelpCircle className="h-4 w-4" />Need help signing in?</a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
