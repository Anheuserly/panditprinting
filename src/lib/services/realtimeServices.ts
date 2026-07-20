import { ID, Query } from "appwrite";
import { appwrite } from "@/lib/appwrite/client";
import { appwriteConfig } from "@/lib/appwrite/config";

const DB_ID = appwriteConfig.databaseId;
const C = appwriteConfig.collections;

export type RealtimeRecord = Record<string, any> & { $id?: string };

function channels(collectionId: string) {
  return [
    `databases.${DB_ID}.collections.${collectionId}.documents`,
    `databases.${DB_ID}.tables.${collectionId}.rows`,
  ];
}

function payloadOf(event: any): RealtimeRecord {
  const payload = event?.payload ?? {};
  return payload?.data && typeof payload.data === "object" ? payload.data : payload;
}

export function subscribeToChatRealtime(onRecord: (record: RealtimeRecord, events: string[]) => void) {
  return appwrite.client.subscribe(
    [...channels(C.chatSessions), ...channels(C.chatMessages)],
    (event: any) => onRecord(payloadOf(event), event?.events ?? []),
  );
}

export function subscribeToCallRealtime(onRecord: (record: RealtimeRecord, events: string[]) => void) {
  return appwrite.client.subscribe(
    [...channels(C.callSessions), ...channels(C.callCandidates)],
    (event: any) => onRecord(payloadOf(event), event?.events ?? []),
  );
}

export function subscribeToNotificationRealtime(onRecord: (record: RealtimeRecord, events: string[]) => void) {
  return appwrite.client.subscribe(channels(C.notificationInbox), (event: any) => onRecord(payloadOf(event), event?.events ?? []));
}

export async function createCallSession(data: {
  chatSessionId: string; callerId: string; callerName: string; calleeId: string;
  calleeName: string; businessId: string; mode: "voice" | "video"; offerSdp: string;
}) {
  const now = new Date();
  return appwrite.databases.createDocument(DB_ID, C.callSessions, ID.unique(), {
    ...data,
    callerRole: "client",
    calleeRole: "administrator",
    status: "ringing",
    answerSdp: "",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 45_000).toISOString(),
  });
}

export function updateCallSession(callId: string, data: Record<string, any>) {
  return appwrite.databases.updateDocument(DB_ID, C.callSessions, callId, data);
}

export async function addCallCandidate(data: { callId: string; senderId: string; candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null }) {
  return appwrite.databases.createDocument(DB_ID, C.callCandidates, ID.unique(), {
    ...data,
    sdpMid: data.sdpMid ?? "",
    sdpMLineIndex: data.sdpMLineIndex ?? 0,
    createdAt: new Date().toISOString(),
  });
}

export async function fetchCallCandidates(callId: string) {
  const result = await appwrite.databases.listDocuments(DB_ID, C.callCandidates, [Query.equal("callId", callId), Query.orderAsc("$createdAt"), Query.limit(100)]);
  return result.documents;
}
