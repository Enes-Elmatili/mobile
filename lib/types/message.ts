// lib/types/message.ts
// Messagerie client ↔ prestataire (REST ; le temps réel passe par le socket).
import type { ISODateString, Enveloped } from './common';

/** DTO serveur : { id, senderId, recipientId, text, createdAt, readAt }. */
export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: ISODateString;
  readAt: ISODateString | null;
}

/** GET /messages/inbox et /messages/conversation/:userId. */
export type ChatMessagesResponse = Enveloped<ChatMessage[]>;

/** POST /messages — le message créé. */
export type SendMessageResponse = Enveloped<ChatMessage>;

/** GET /messages/unread — `{ unread }` (anciennes versions : sous `data`). */
export type UnreadCountResponse = { unread?: number; data?: { unread?: number } };

/** GET /messages/contact/:recipientId */
export type ContactInfoResponse = { data?: { name?: string | null; [k: string]: unknown } };

/** GET /messages/can-chat/:recipientId — `reason` journalisé en dev. */
export type CanChatResponse = { data?: { canChat?: boolean; reason?: string; [k: string]: unknown } };
