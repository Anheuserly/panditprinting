"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelative } from "@/lib/utils";
import {
  fetchChatMessages,
  fetchChatSessions,
  fetchMembershipsForIdentity,
  fetchClientProfile,
  fetchServiceRequestById,
  sendChatMessage,
  sendChatCallHistory,
  toChatMessage,
  toChatSession,
  toServiceRequest,
  readString,
  userIdentity,
} from "@/lib/services/appwriteServices";
import { subscribeToCallRealtime, subscribeToChatRealtime, updateCallSession, type RealtimeRecord } from "@/lib/services/realtimeServices";
import { WebCallDialog } from "@/components/chat/WebCallDialog";
import toast from "react-hot-toast";
import {
  MessageSquare, Send, Search, CheckCheck, ChevronLeft, Phone, Video
} from "lucide-react";
import type { ChatSession, ChatMessage } from "@/types";

export default function ChatsPage() {
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messagesBySession, setMessagesBySession] = useState<Record<string, ChatMessage[]>>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [memberBusinessIds, setMemberBusinessIds] = useState<Set<string>>(new Set());
  const [requesterBySession, setRequesterBySession] = useState<Record<string, { name: string; phone: string }>>({});
  const [activeCall, setActiveCall] = useState<{ mode: "voice" | "video"; incoming?: RealtimeRecord; outgoing: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadSessions() {
      if (!profile?.userId) return;
      setIsLoading(true);
      try {
        const docs = await fetchChatSessions({ ...userIdentity(profile), limit: 100 });
        const mapped = docs.map((doc) => toChatSession(doc, profile.userId));
        if (!alive) return;
        setSessions(mapped);
        const requestedId = searchParams.get("requestId");
        const requestedSession = requestedId ? mapped.find((session) => session.requestId === requestedId) : undefined;
        setSelectedSessionId((current) => requestedSession?.$id ?? current ?? mapped[0]?.$id ?? null);
        const resolved = await Promise.all(mapped.map(async (session) => {
          let name = session.clientName || "";
          let phone = session.clientPhone || "";
          let clientId = session.clientId || "";
          if (session.requestId) {
            const requestDocument = await fetchServiceRequestById(session.requestId);
            if (requestDocument) {
              const request = toServiceRequest(requestDocument);
              name ||= request.customerName;
              phone ||= request.customerPhone;
              clientId ||= request.customerId;
            }
          }
          if ((!name || !phone) && clientId) {
            const client = await fetchClientProfile(clientId).catch(() => null);
            if (client) {
              name ||= readString(client, "name") || readString(client, "clientName");
              phone ||= readString(client, "phone");
            }
          }
          return [session.$id, { name, phone }] as const;
        }));
        if (alive) setRequesterBySession(Object.fromEntries(resolved));
      } catch {
        if (alive) toast.error("Unable to load chats");
      } finally {
        if (alive) setIsLoading(false);
      }
    }
    loadSessions();
    return () => { alive = false; };
  }, [profile, searchParams]);

  useEffect(() => {
    let alive = true;
    if (!profile?.userId) return;
    fetchMembershipsForIdentity({ userId: profile.userId, customerId: profile.customerId, documentId: profile.$id, phone: profile.phone })
      .then((rows) => {
        if (!alive) return;
        setMemberBusinessIds(new Set(rows.map((row) => row.data?.businessId?.toString() || "").filter(Boolean)));
      })
      .catch(() => { if (alive) setMemberBusinessIds(new Set()); });
    return () => { alive = false; };
  }, [profile]);

  useEffect(() => {
    let alive = true;
    async function loadMessages() {
      if (!selectedSessionId || messagesBySession[selectedSessionId]) return;
      try {
        const docs = await fetchChatMessages(selectedSessionId);
        if (alive) {
          setMessagesBySession((prev) => ({
            ...prev,
            [selectedSessionId]: docs.map(toChatMessage),
          }));
        }
      } catch {
        if (alive) toast.error("Unable to load messages");
      }
    }
    loadMessages();
    return () => { alive = false; };
  }, [messagesBySession, selectedSessionId]);

  useEffect(() => {
    if (!profile?.userId) return;
    const unsubscribe = subscribeToChatRealtime((record) => {
      const sessionId = readString(record, "sessionId");
      const isMessage = Boolean(sessionId && (record.messageText !== undefined || record.messageType !== undefined));
      if (isMessage) {
        const message = toChatMessage(record);
        setMessagesBySession((previous) => {
          const current = previous[sessionId] || [];
          const index = current.findIndex((item) => item.$id === message.$id);
          const next = index >= 0 ? current.map((item, itemIndex) => itemIndex === index ? message : item) : [...current, message];
          return { ...previous, [sessionId]: next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) };
        });
        setSessions((previous) => previous.map((session) => session.$id === sessionId ? { ...session, lastMessage: message.content, lastMessageAt: message.createdAt, unreadCount: message.senderId === profile.userId ? session.unreadCount : session.unreadCount + 1 } : session));
        if (message.senderId !== profile.userId && document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
          const session = sessions.find((item) => item.$id === sessionId);
          const notification = new Notification(session ? titleFor(session) : message.senderName || "New AMC MEP message", { body: callSummary(message.content), tag: `chat-${sessionId}` });
          notification.onclick = () => { window.focus(); setSelectedSessionId(sessionId); notification.close(); };
        }
        return;
      }
      if (record.$id && (record.businessId !== undefined || record.clientId !== undefined)) {
        const mapped = toChatSession(record, profile.userId);
        setSessions((previous) => {
          const exists = previous.some((item) => item.$id === mapped.$id);
          return (exists ? previous.map((item) => item.$id === mapped.$id ? { ...item, ...mapped } : item) : [mapped, ...previous]).sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());
        });
      }
    });
    return unsubscribe;
  // titleFor depends on live membership state; resubscribing keeps the notification label accurate.
  }, [profile?.userId, memberBusinessIds, requesterBySession, sessions]);

  const viewerBusinessIds = new Set([...(profile?.businessIds || []), ...memberBusinessIds]);
  const isBusinessViewer = (session: ChatSession) => viewerBusinessIds.has(session.businessId || "");
  const titleFor = (session: ChatSession) => isBusinessViewer(session)
    ? requesterBySession[session.$id]?.name || session.clientName || "Requester"
    : session.businessName || session.participantNames[1] || session.clientName || "Conversation";
  const subtitleFor = (session: ChatSession) => isBusinessViewer(session)
    ? requesterBySession[session.$id]?.phone || session.clientPhone || "Service requester"
    : session.requestId ? "Service request conversation" : "Direct message";
  const filteredSessions = sessions.filter((s) =>
    titleFor(s).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.lastMessage && callSummary(s.lastMessage).toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedSession = sessions.find((s) => s.$id === selectedSessionId);
  const messages = selectedSessionId ? messagesBySession[selectedSessionId] || [] : [];
  const otherParticipant = selectedSession ? titleFor(selectedSession) : "Conversation";

  useEffect(() => {
    if (!profile?.userId) return;
    const identities = new Set([profile.userId, profile.customerId, profile.$id, ...(profile.businessIds || []), ...memberBusinessIds].filter(Boolean));
    const unsubscribe = subscribeToCallRealtime((record) => {
      if (record.status !== "ringing" || !identities.has(String(record.calleeId || "")) || String(record.callerId || "") === profile.userId) return;
      setSelectedSessionId(String(record.chatSessionId || "") || null);
      setActiveCall((current) => current || { mode: record.mode === "video" ? "video" : "voice", incoming: record, outgoing: false });
      if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
        const notice = new Notification(`${record.mode === "video" ? "Video" : "Voice"} call from ${record.callerName || "AMC MEP"}`, { body: "Open AMC MEP to answer", tag: `call-${record.$id}`, requireInteraction: true });
        notice.onclick = () => { window.focus(); notice.close(); };
      }
    });
    return unsubscribe;
  }, [memberBusinessIds, profile]);

  const startCall = (mode: "voice" | "video") => {
    if (!selectedSession) return;
    const businessViewer = isBusinessViewer(selectedSession);
    const otherId = businessViewer ? (selectedSession.clientId || selectedSession.participantIds.find((id) => id !== profile?.userId) || "") : (selectedSession.businessId || selectedSession.participantIds.find((id) => id !== profile?.userId) || "");
    if (!otherId) { toast.error("This conversation is not ready for calls."); return; }
    setActiveCall({ mode, outgoing: true });
  };

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedSessionId) return;
    const text = messageInput.trim();
    setMessageInput("");
    try {
      const created = await sendChatMessage({
        sessionId: selectedSessionId,
        messageText: text,
        senderId: profile?.userId || "",
        senderName: profile?.name || "You",
      });
      setMessagesBySession((prev) => ({
        ...prev,
        [selectedSessionId]: [...(prev[selectedSessionId] || []), toChatMessage(created)],
      }));
      setSessions((prev) => prev.map((session) => session.$id === selectedSessionId ? {
        ...session,
        lastMessage: text,
        lastMessageAt: new Date().toISOString(),
      } : session));
    } catch {
      setMessageInput(text);
      toast.error("Unable to send message");
    }
  };

  return (
    <div className="animate-fade-in h-[calc(100vh-8rem)] -mx-4 lg:-mx-8 -my-4 lg:-my-8">
      <div className="flex h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Session List */}
        <div className={`w-full lg:w-80 border-r border-gray-200 flex flex-col ${mobileChatOpen ? "hidden lg:flex" : "flex"}`}>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold text-gray-900">Chats</h1>
              <span className="text-xs text-gray-400">{sessions.length} conversations</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-gray-500">Loading chats...</div>
            ) : filteredSessions.length === 0 ? (
              <EmptyState icon={<MessageSquare className="h-12 w-12" />} title="No chats found" description={searchQuery ? "Try a different search term" : "Your app conversations will appear here."} />
            ) : (
              filteredSessions.map((session) => (
                <button
                  key={session.$id}
                  onClick={() => { setSelectedSessionId(session.$id); setMobileChatOpen(true); }}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-gray-50 ${selectedSessionId === session.$id ? "bg-brand-50 border-l-3 border-brand-600" : "border-l-3 border-transparent"}`}
                >
                  <Avatar src={session.participantAvatars[1]} name={titleFor(session)} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${session.unreadCount > 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                        {titleFor(session)}
                      </p>
                      {session.lastMessageAt && (
                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{formatRelative(session.lastMessageAt)}</span>
                      )}
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${session.unreadCount > 0 ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                      {session.lastMessage ? callSummary(session.lastMessage) : "No messages yet"}
                    </p>
                  </div>
                  {session.unreadCount > 0 && (
                    <span className="h-5 min-w-[1.25rem] px-1.5 bg-brand-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {session.unreadCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${mobileChatOpen ? "flex" : "hidden lg:flex"}`}>
          {selectedSession ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                <button onClick={() => setMobileChatOpen(false)} className="lg:hidden p-1 text-gray-500 hover:bg-gray-100 rounded">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <Avatar src={selectedSession.participantAvatars[1]} name={otherParticipant} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{otherParticipant}</p>
                  <p className="truncate text-xs text-gray-500">{subtitleFor(selectedSession)}</p>
                </div>
                <button onClick={() => startCall("voice")} className="grid size-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600" title="Start voice call"><Phone className="size-4" /></button>
                <button onClick={() => startCall("video")} className="grid size-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600" title="Start video call"><Video className="size-4" /></button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isMe = msg.senderId === profile?.userId || msg.senderId === "user1";
                  const call = parseCall(msg.content, msg.type);
                  if (call) return <CallHistory key={msg.$id} call={call} isMe={isMe} createdAt={msg.createdAt} />;
                  return (
                    <div key={msg.$id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${isMe ? "bg-brand-600 text-white rounded-br-md" : "bg-gray-100 text-gray-800 rounded-bl-md"}`}>
                        <p>{msg.content}</p>
                        <div className={`flex items-center gap-1 mt-1 text-xs ${isMe ? "text-brand-200" : "text-gray-400"}`}>
                          <span>{formatRelative(msg.createdAt)}</span>
                          {isMe && <CheckCheck className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 h-10 px-4 rounded-full border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                  />
                  <Button size="icon" onClick={handleSend} disabled={!messageInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState icon={<MessageSquare className="h-12 w-12" />} title="Select a chat" description="Choose a conversation from the list to start messaging" />
          )}
        </div>
      </div>
      {activeCall && selectedSession && <WebCallDialog
        sessionId={selectedSession.$id}
        meId={profile?.userId || profile?.customerId || profile?.$id || ""}
        meName={profile?.name || "AMC MEP user"}
        otherId={activeCall.incoming ? String(activeCall.incoming.callerId || "") : (isBusinessViewer(selectedSession) ? selectedSession.clientId || selectedSession.participantIds[0] || "" : selectedSession.businessId || selectedSession.participantIds[1] || "")}
        otherName={activeCall.incoming ? String(activeCall.incoming.callerName || otherParticipant) : otherParticipant}
        businessId={selectedSession.businessId || ""}
        mode={activeCall.mode}
        incoming={activeCall.incoming}
        onClose={async (result) => {
          const wasOutgoing = activeCall.outgoing;
          setActiveCall(null);
          if (wasOutgoing && result) {
            const value = `${result.mode}|${result.outcome}|${result.seconds}`;
            const created = await sendChatCallHistory({ sessionId: selectedSession.$id, value, senderId: profile?.userId || "", senderName: profile?.name || "You" }).catch(() => null);
            if (created) setMessagesBySession((previous) => ({ ...previous, [selectedSession.$id]: [...(previous[selectedSession.$id] || []).filter((item) => item.$id !== created.$id), toChatMessage(created)] }));
          } else if (!wasOutgoing && activeCall.incoming && !result) {
            await updateCallSession(String(activeCall.incoming.$id || ""), { status: "declined", endedAt: new Date().toISOString() }).catch(() => undefined);
          }
        }}
      />}
    </div>
  );
}

type CallInfo = { kind: "voice" | "video"; outcome: string; seconds: number };

function parseCall(content: string, type?: string): CallInfo | null {
  const parts = content.split("|");
  if (parts.length < 2 || !["voice", "video"].includes(parts[0]) || (type && type !== "call" && !content.includes("|"))) return null;
  return { kind: parts[0] as CallInfo["kind"], outcome: parts[1] || "ended", seconds: Number(parts[2]) || 0 };
}

function callSummary(content: string) {
  const call = parseCall(content);
  if (!call) return content;
  const label = call.kind === "video" ? "Video call" : "Voice call";
  if (call.outcome === "completed") return `${label} · ${formatDuration(call.seconds)}`;
  return `${label} ${call.outcome}`;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function CallHistory({ call, isMe, createdAt }: { call: CallInfo; isMe: boolean; createdAt: string }) {
  const Icon = call.kind === "video" ? Video : Phone;
  const label = call.kind === "video" ? "Video call" : "Voice call";
  const detail = call.outcome === "completed" ? formatDuration(call.seconds) : call.outcome.charAt(0).toUpperCase() + call.outcome.slice(1);
  return <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}><div className={`flex max-w-[80%] items-center gap-3 rounded-xl border px-3 py-2.5 ${isMe ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}><span className={`grid size-9 place-items-center rounded-full ${call.outcome === "completed" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}><Icon className="size-4" /></span><span><strong className="block text-sm text-slate-900">{label}</strong><small className="text-slate-500">{detail} · {formatRelative(createdAt)}</small></span></div></div>;
}
