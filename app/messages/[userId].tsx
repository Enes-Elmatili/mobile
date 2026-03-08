// app/messages/[userId].tsx — Conversation screen
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/AuthContext';
import { api } from '../../lib/api';
import { onIncomingMessage } from '../../lib/SocketContext';

// DTO backend: { id, senderId, recipientId, text, createdAt, readAt }
interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
  readAt: string | null;
}

function fmtTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayLabel(userId: string): string {
  return `Contact #${userId.slice(0, 6).toUpperCase()}`;
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ConversationScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const messageIdsRef = useRef(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  const headerName = displayLabel(userId ?? '');

  // ── Load conversation ─────────────────────────────────────────────────────

  const loadConversation = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await api.messages.conversation(userId);
      const msgs: Message[] = res?.data ?? res ?? [];
      messageIdsRef.current = new Set(msgs.map(m => m.id));
      setMessages(msgs);
    } catch {
      // keep empty state
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // ── Real-time: append messages from this user only ────────────────────────

  useEffect(() => {
    let mounted = true;
    const unsub = onIncomingMessage((msg) => {
      if (msg.senderId !== userId) return;
      if (messageIdsRef.current.has(msg.id)) return;
      messageIdsRef.current.add(msg.id);
      setMessages(prev => [...prev, msg]);
      setTimeout(() => { if (mounted) flatListRef.current?.scrollToEnd({ animated: true }); }, 80);
    });
    return () => { mounted = false; unsub(); };
  }, [userId]);

  // ── Send ──────────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    const content = inputText.trim();
    if (!content || sending || !userId) return;
    setSending(true);
    setInputText('');
    try {
      const res = await api.messages.send(userId, content);
      const msg: Message = res?.data ?? res;
      if (!messageIdsRef.current.has(msg.id)) {
        messageIdsRef.current.add(msg.id);
        setMessages(prev => [...prev, msg]);
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      setInputText(content); // restore on network error
    } finally {
      setSending(false);
    }
  };

  // ── Render message bubble ─────────────────────────────────────────────────

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === user?.id;
    const prev = messages[index - 1];
    const showTime =
      !prev ||
      new Date(item.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;

    return (
      <View>
        {showTime && (
          <Text style={b.timestamp}>{fmtTime(item.createdAt)}</Text>
        )}
        <View style={[b.row, isMine ? b.rowRight : b.rowLeft]}>
          <View style={[b.bubble, isMine ? b.bubbleMine : b.bubbleOther]}>
            <Text style={[b.text, isMine ? b.textMine : b.textOther]}>{item.text}</Text>
          </View>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{headerName}</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color="#111" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={s.list}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Ionicons name="chatbubble-outline" size={44} color="#ADADAD" />
                <Text style={s.emptyText}>Démarrez la conversation</Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Votre message…"
            placeholderTextColor="#ADADAD"
            multiline
            maxLength={2000}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!inputText.trim() || sending) && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Ionicons name="send" size={18} color="#FFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '700', color: '#111', marginHorizontal: 8,
  },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 12, paddingVertical: 16 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 14, color: '#ADADAD' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#FFF',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: -2 } },
      android: { elevation: 4 },
    }),
  },
  input: {
    flex: 1, backgroundColor: '#F5F5F5', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15, color: '#111', maxHeight: 120,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    marginBottom: 1,
  },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },
});

const b = StyleSheet.create({
  timestamp: {
    textAlign: 'center', fontSize: 11, color: '#ADADAD',
    marginVertical: 8, fontWeight: '500',
  },
  row: { marginVertical: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowLeft: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '78%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  bubbleMine: {
    backgroundColor: '#111',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 1 },
    }),
  },
  text: { fontSize: 15, lineHeight: 21 },
  textMine: { color: '#FFF' },
  textOther: { color: '#111' },
});
