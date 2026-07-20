"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import toast from "react-hot-toast";
import { addCallCandidate, createCallSession, fetchCallCandidates, subscribeToCallRealtime, updateCallSession, type RealtimeRecord } from "@/lib/services/realtimeServices";

type CallMode = "voice" | "video";

interface Props {
  sessionId: string;
  meId: string;
  meName: string;
  otherId: string;
  otherName: string;
  businessId: string;
  mode: CallMode;
  incoming?: RealtimeRecord | null;
  onClose: (result?: { mode: CallMode; outcome: string; seconds: number }) => void;
}

const iceServers: RTCIceServer[] = [
  { urls: process.env.NEXT_PUBLIC_WEBRTC_STUN_URL || "stun:stun.l.google.com:19302" },
  ...(process.env.NEXT_PUBLIC_WEBRTC_TURN_URL ? [{ urls: process.env.NEXT_PUBLIC_WEBRTC_TURN_URL, username: process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME, credential: process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL }] : []),
];

export function WebCallDialog({ sessionId, meId, meName, otherId, otherName, businessId, mode, incoming, onClose }: Props) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const callId = useRef<string>(incoming?.$id || "");
  const startedAt = useRef<number | null>(null);
  const ending = useRef(false);
  const pendingLocalCandidates = useRef<RTCIceCandidateInit[]>([]);
  const pendingRemoteCandidates = useRef<RTCIceCandidateInit[]>([]);
  const [status, setStatus] = useState(incoming ? "Incoming call" : "Preparing call...");
  const [accepted, setAccepted] = useState(!incoming);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const finish = useCallback(async (outcome = "completed", remote = false) => {
    if (ending.current) return;
    ending.current = true;
    const seconds = startedAt.current ? Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)) : 0;
    if (!remote && callId.current) {
      await updateCallSession(callId.current, { status: outcome === "declined" ? "declined" : "ended", endedAt: new Date().toISOString() }).catch(() => undefined);
    }
    peer.current?.close();
    stream.current?.getTracks().forEach((track) => track.stop());
    onClose({ mode, outcome: outcome === "ended" ? "completed" : outcome, seconds });
  }, [mode, onClose]);

  const begin = useCallback(async () => {
    try {
      setAccepted(true);
      setStatus(incoming ? "Connecting..." : `Calling ${otherName}...`);
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === "video" });
      if (localVideo.current) localVideo.current.srcObject = stream.current;
      const pc = new RTCPeerConnection({ iceServers });
      peer.current = pc;
      stream.current.getTracks().forEach((track) => pc.addTrack(track, stream.current!));
      pc.ontrack = (event) => {
        if (remoteVideo.current && event.streams[0]) remoteVideo.current.srcObject = event.streams[0];
        startedAt.current ||= Date.now();
        setStatus("Connected");
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") { startedAt.current ||= Date.now(); setStatus("Connected"); }
        if (["failed", "closed"].includes(pc.connectionState) && !ending.current) void finish("failed", true);
      };
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        const value = event.candidate.toJSON();
        if (!callId.current) pendingLocalCandidates.current.push(value);
        else void addCallCandidate({ callId: callId.current, senderId: meId, candidate: value.candidate || "", sdpMid: value.sdpMid, sdpMLineIndex: value.sdpMLineIndex });
      };
      if (incoming) {
        await pc.setRemoteDescription({ type: "offer", sdp: String(incoming.offerSdp || "") });
        const existing = await fetchCallCandidates(callId.current).catch(() => []);
        for (const candidate of existing) if (String(candidate.senderId || "") !== meId && candidate.candidate) await pc.addIceCandidate({ candidate: String(candidate.candidate), sdpMid: String(candidate.sdpMid || "") || null, sdpMLineIndex: Number(candidate.sdpMLineIndex || 0) });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateCallSession(callId.current, { answerSdp: answer.sdp || "", status: "accepted", answeredAt: new Date().toISOString() });
      } else {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const row = await createCallSession({ chatSessionId: sessionId, callerId: meId, callerName: meName, calleeId: otherId, calleeName: otherName, businessId, mode, offerSdp: offer.sdp || "" });
        callId.current = row.$id;
        for (const candidate of pendingLocalCandidates.current.splice(0)) await addCallCandidate({ callId: row.$id, senderId: meId, candidate: candidate.candidate || "", sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex });
      }
    } catch (error) {
      toast.error(error instanceof DOMException && error.name === "NotAllowedError" ? "Allow camera and microphone access to make calls." : "Unable to start this call.");
      void finish("failed");
    }
  }, [businessId, finish, incoming, meId, meName, mode, otherId, otherName, sessionId]);

  useEffect(() => {
    const unsubscribe = subscribeToCallRealtime((record) => {
      const rowId = String(record.$id || "");
      if (String(record.callId || "") === callId.current && String(record.senderId || "") !== meId && record.candidate) {
        const candidate = { candidate: String(record.candidate), sdpMid: String(record.sdpMid || "") || null, sdpMLineIndex: Number(record.sdpMLineIndex || 0) };
        if (peer.current?.remoteDescription) void peer.current.addIceCandidate(candidate);
        else pendingRemoteCandidates.current.push(candidate);
      }
      if (rowId !== callId.current) return;
      if (!incoming && record.status === "accepted" && record.answerSdp && peer.current && !peer.current.remoteDescription) {
        void peer.current.setRemoteDescription({ type: "answer", sdp: String(record.answerSdp) }).then(async () => {
          const existing = await fetchCallCandidates(callId.current).catch(() => []);
          for (const candidate of existing) if (String(candidate.senderId || "") !== meId && candidate.candidate) pendingRemoteCandidates.current.push({ candidate: String(candidate.candidate), sdpMid: String(candidate.sdpMid || "") || null, sdpMLineIndex: Number(candidate.sdpMLineIndex || 0) });
          const seen = new Set<string>();
          for (const candidate of pendingRemoteCandidates.current.splice(0)) { const key = `${candidate.candidate}:${candidate.sdpMid}:${candidate.sdpMLineIndex}`; if (seen.add(key)) await peer.current?.addIceCandidate(candidate); }
        });
        setStatus("Connecting...");
      }
      if (["declined", "ended", "missed"].includes(String(record.status || ""))) void finish(String(record.status), true);
    });
    if (!incoming) void begin();
    return () => { unsubscribe(); peer.current?.close(); stream.current?.getTracks().forEach((track) => track.stop()); };
  }, [begin, finish, incoming, meId]);

  const decline = async () => {
    if (callId.current) await updateCallSession(callId.current, { status: "declined", endedAt: new Date().toISOString() }).catch(() => undefined);
    onClose();
  };

  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
    <div className="relative flex min-h-[440px] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-slate-950 text-white shadow-2xl">
      <video ref={remoteVideo} autoPlay playsInline className={`absolute inset-0 size-full object-cover ${mode === "video" ? "block" : "hidden"}`} />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-slate-900/30 to-slate-950/80 p-8">
        <div className="grid size-20 place-items-center rounded-full bg-blue-600 text-2xl font-semibold">{otherName.slice(0, 2).toUpperCase()}</div>
        <h2 className="mt-4 text-xl font-semibold">{otherName}</h2><p className="mt-1 text-sm text-slate-300">{status}</p>
        {mode === "video" && <video ref={localVideo} autoPlay muted playsInline className="absolute bottom-24 right-4 h-36 w-24 rounded-md border border-white/20 object-cover shadow-lg" />}
      </div>
      <div className="relative z-20 flex items-center justify-center gap-3 border-t border-white/10 bg-slate-950/90 p-5">
        {incoming && !accepted ? <><button onClick={decline} className="grid size-12 place-items-center rounded-full bg-red-600" title="Decline"><PhoneOff /></button><button onClick={() => void begin()} className="flex h-12 items-center gap-2 rounded-full bg-emerald-600 px-5 font-medium"><PhoneOff className="rotate-[135deg]" />Answer</button></> : <>
          <button onClick={() => { const next = !muted; stream.current?.getAudioTracks().forEach((track) => track.enabled = !next); setMuted(next); }} className="grid size-11 place-items-center rounded-full bg-white/10" title={muted ? "Unmute" : "Mute"}>{muted ? <MicOff /> : <Mic />}</button>
          {mode === "video" && <button onClick={() => { const next = !cameraOff; stream.current?.getVideoTracks().forEach((track) => track.enabled = !next); setCameraOff(next); }} className="grid size-11 place-items-center rounded-full bg-white/10" title={cameraOff ? "Turn camera on" : "Turn camera off"}>{cameraOff ? <VideoOff /> : <Video />}</button>}
          <button onClick={() => void finish("completed")} className="grid size-12 place-items-center rounded-full bg-red-600" title="End call"><PhoneOff /></button>
        </>}
      </div>
    </div>
  </div>;
}
