// app/messages/[userId].tsx — Conversation screen (le fil vit dans
// components/messages/ConversationThread, partagé avec l'inbox dépliée).
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ConversationThread } from '@/components/messages/ConversationThread';

export default function ConversationScreen() {
  const { userId, name, requestId } = useLocalSearchParams<{ userId: string; name?: string; requestId?: string }>();
  return <ConversationThread userId={userId} name={name} requestId={requestId} />;
}
