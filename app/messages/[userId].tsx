// app/messages/[userId].tsx — Conversation screen
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth/AuthContext';
import { api } from '../../lib/api';
import { devLog, devError } from '../../lib/logger';
import { feedback } from '@/lib/feedback/feedback';
import {
  useSocket,
  onIncomingMessage,
  onUserTyping,
  onUserStopTyping,
  onMessageRead,
  onMessageReadAll,
  setActiveConversationUser,
} from '../../lib/SocketContext';
import { useAppTheme, FONTS, COLORS } from '../../hooks/use-app-theme';
import { contactNameCacheGet, contactNameCacheSet } from './index';

// DTO backend: { id, senderId, recipientId, text, createdAt, readAt }
// `status` est purement local : présent uniquement sur les messages optimistes
// (en cours d'envoi ou échoués), jamais sur les messages venant du serveur.
interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
  readAt: string | null;
  status?: 'pending' | 'failed';
}

function fmtTime(isoString: string): string {
  const d = new Date(isoString);
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= startOfToday) return time;
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (d >= startOfYesterday) return `Hier ${time}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString('fr-FR', sameYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
  return `${date} ${time}`;
}

function displayLabel(userId: string): string {
  return `Contact #${userId.slice(0, 6).toUpperCase()}`;
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ConversationScreen() {
  const { userId, name, requestId } = useLocalSearchParams<{ userId: string; name?: string; requestId?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { socket, refreshUnreadMessages } = useSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const messageIdsRef = useRef(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const flatListRef = useRef<FlatList<Message>>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitTypingRef = useRef(false);
  // Auto-scroll uniquement si l'utilisateur est déjà proche du bas de la liste
  const isNearBottomRef = useRef(true);

  const [contactName, setContactName] = useState<string | null>(name || null);
  const headerName = contactName || displayLabel(userId ?? '');

  // ── Conversation open/closed state (tied to an active Request between users)
  // null = loading, true = open, false = closed
  const [canChat, setCanChat] = useState<boolean | null>(null);

  // ── Fetch contact name if not provided ─────────────────────────────────────

  // Contact name — use module-level cache shared with inbox
  useEffect(() => {
    if (contactName || !userId) return;
    // Check inbox's module-level cache first (imported from index)
    const cached = contactNameCacheGet(userId);
    if (cached) { setContactName(cached); return; }
    api.messages.contactInfo(userId).then((res: any) => {
      const n = res?.data?.name;
      if (n) { setContactName(n); contactNameCacheSet(userId, n); }
    }).catch((e: any) => devError('[Chat] contactInfo failed:', e?.message));
  }, [userId, contactName]);

  // ── Load conversation ─────────────────────────────────────────────────────

  const loadConversation = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await api.messages.conversation(userId);
      const msgs: Message[] = res?.data ?? res ?? [];
      messageIdsRef.current = new Set(msgs.map(m => m.id));
      // Conserver les messages optimistes locaux (pending/failed) non encore
      // confirmés par le serveur pour ne pas perdre un envoi en cours/échoué.
      setMessages(prev => {
        const locals = prev.filter(m => m.status && !messageIdsRef.current.has(m.id));
        return [...msgs, ...locals];
      });
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Refetch à la reconnexion du socket : les messages arrivés pendant une
  // coupure (app en background, socket down) sont récupérés via l'API.
  useEffect(() => {
    if (!socket) return;
    const handler = () => { loadConversation(); };
    socket.on('connect', handler);
    return () => { socket.off('connect', handler); };
  }, [socket, loadConversation]);

  // ── Conversation active : le badge global n'incrémente pas pour elle ───────
  useFocusEffect(useCallback(() => {
    setActiveConversationUser(userId ?? null);
    return () => { setActiveConversationUser(null); };
  }, [userId]));

  // ── Mark all messages as read when opening conversation ────────────────────

  useEffect(() => {
    if (!userId || loading) return;
    api.messages.markAllRead(userId)
      .then(() => refreshUnreadMessages())
      .catch(() => {});
  }, [userId, loading, refreshUnreadMessages]);

  // ── Can-chat probe: is there an active request between us? ─────────────────
  const refreshCanChat = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await api.messages.canChat(userId);
      const value = res?.data?.canChat ?? false;
      devLog('[Chat] can-chat probe', { userId, ...res?.data });
      setCanChat(value);
    } catch (e: any) {
      // 404 means backend wasn't restarted after the gating was added — fail
      // closed in that case so the banner still shows. For other transient
      // network errors, fail open to avoid locking the UI unnecessarily.
      devError('[Chat] can-chat probe failed', e?.status, e?.message);
      if (e?.status === 404) setCanChat(false);
      else setCanChat(true);
    }
  }, [userId]);

  useEffect(() => { refreshCanChat(); }, [refreshCanChat]);

  // Re-probe + refetch de la conversation à chaque focus de l'écran
  // (revient depuis le dashboard, etc.)
  useFocusEffect(useCallback(() => {
    refreshCanChat();
    loadConversation();
  }, [refreshCanChat, loadConversation]));

  // Re-check when any related request status changes.
  // Backend emits différents events selon la transition : `request:statusUpdated`
  // pour les devis, `request:cancelled` à l'annulation, `request:completed` à la
  // fin de mission. Sans écouter les trois, le banner reste invisible jusqu'à un
  // refocus de l'écran et le client peut continuer à chatter sur une demande clôturée.
  useEffect(() => {
    if (!socket) return;
    const handler = () => { refreshCanChat(); };
    socket.on('request:statusUpdated', handler);
    socket.on('request:cancelled', handler);
    socket.on('request:completed', handler);
    return () => {
      socket.off('request:statusUpdated', handler);
      socket.off('request:cancelled', handler);
      socket.off('request:completed', handler);
    };
  }, [socket, refreshCanChat]);

  // ── Real-time: append incoming messages ────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    const unsub = onIncomingMessage((msg) => {
      // Only show messages relevant to this conversation
      // Only show messages that belong to THIS conversation: either sent by
      // the partner to us, or sent by us to the partner. Without the
      // recipientId check, a `message:sent` socket echo for a message we sent
      // to a different person would also show up here.
      const isFromPartner = msg.senderId === userId && msg.recipientId === user?.id;
      const isToPartner   = msg.senderId === user?.id && msg.recipientId === userId;
      if (!isFromPartner && !isToPartner) return;
      if (messageIdsRef.current.has(msg.id)) return;
      messageIdsRef.current.add(msg.id);
      setMessages(prev => [...prev, msg]);
      // Ne pas interrompre la lecture de l'historique : scroll auto uniquement
      // si l'utilisateur est déjà proche du bas.
      if (isNearBottomRef.current) {
        setTimeout(() => { if (mounted) flatListRef.current?.scrollToEnd({ animated: true }); }, 80);
      }

      // Auto-mark as read if it's from the other person
      if (msg.senderId === userId) {
        api.messages.markAllRead(userId)
          .then(() => refreshUnreadMessages())
          .catch(() => {});
      }
    });
    return () => { mounted = false; unsub(); };
  }, [userId, user?.id, refreshUnreadMessages]);

  // ── Typing indicators ─────────────────────────────────────────────────────

  useEffect(() => {
    const unsubTyping = onUserTyping((e) => {
      if (e.userId === userId) setIsTyping(true);
    });
    const unsubStop = onUserStopTyping((e) => {
      if (e.userId === userId) setIsTyping(false);
    });
    return () => { unsubTyping(); unsubStop(); };
  }, [userId]);

  // Auto-clear typing after 4s (safety net)
  useEffect(() => {
    if (!isTyping) return;
    const t = setTimeout(() => setIsTyping(false), 4000);
    return () => clearTimeout(t);
  }, [isTyping]);

  // Emit typing events
  const handleTextChange = (text: string) => {
    setInputText(text);
    if (!socket || !userId) return;

    if (text.trim() && !emitTypingRef.current) {
      emitTypingRef.current = true;
      socket.emit('message:typing', { recipientId: userId });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingRef.current = false;
      socket.emit('message:stop_typing', { recipientId: userId });
    }, 2000);

    if (!text.trim()) {
      emitTypingRef.current = false;
      socket.emit('message:stop_typing', { recipientId: userId });
    }
  };

  // ── Read receipts ──────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubRead = onMessageRead((e) => {
      if (e.readBy === userId) {
        setMessages(prev => prev.map(m =>
          m.id === e.messageId ? { ...m, readAt: e.readAt } : m
        ));
      }
    });
    const unsubReadAll = onMessageReadAll((e) => {
      if (e.readBy === userId) {
        setMessages(prev => prev.map(m =>
          m.senderId === user?.id && !m.readAt ? { ...m, readAt: e.readAt } : m
        ));
      }
    });
    return () => { unsubRead(); unsubReadAll(); };
  }, [userId, user?.id]);

  // ── Send (optimiste : pending → sent / failed avec retry) ─────────────────

  const deliverMessage = useCallback(async (localId: string, content: string) => {
    if (!userId) return;
    try {
      const res = await api.messages.send(userId, content);
      const msg: Message = res?.data ?? res;
      if (messageIdsRef.current.has(msg.id)) {
        // L'écho socket `message:sent` est déjà arrivé : retirer le doublon optimiste.
        setMessages(prev => prev.filter(m => m.id !== localId));
      } else {
        messageIdsRef.current.add(msg.id);
        setMessages(prev => prev.map(m => (m.id === localId ? { ...msg, status: undefined } : m)));
      }
    } catch (e: any) {
      // Le brouillon reste visible dans la bulle "échec" — jamais perdu.
      setMessages(prev => prev.map(m => (m.id === localId ? { ...m, status: 'failed' as const } : m)));
      const serverCode = e?.data?.error?.code ?? e?.data?.code;
      if (serverCode === 'CONVERSATION_CLOSED' || e?.status === 403) {
        // Server closed the conversation between probe and send: lock UI.
        setCanChat(false);
        feedback.error('Message non envoyé — la conversation est fermée.');
      } else {
        feedback.error('Message non envoyé. Appuyez sur le message pour réessayer.');
      }
    }
  }, [userId]);

  const sendMessage = () => {
    const content = inputText.trim();
    if (!content || !userId) return;
    setInputText('');
    // Stop typing indicator
    if (emitTypingRef.current) {
      emitTypingRef.current = false;
      socket?.emit('message:stop_typing', { recipientId: userId });
    }
    // Insertion optimiste immédiate avec statut "pending"
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: Message = {
      id: localId,
      senderId: user?.id ?? '',
      recipientId: userId,
      text: content,
      createdAt: new Date().toISOString(),
      readAt: null,
      status: 'pending',
    };
    setMessages(prev => [...prev, optimistic]);
    isNearBottomRef.current = true;
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    deliverMessage(localId, content);
  };

  const retryMessage = useCallback((msg: Message) => {
    if (msg.status !== 'failed') return;
    setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, status: 'pending' as const } : m)));
    deliverMessage(msg.id, msg.text);
  }, [deliverMessage]);

  // ── Status icon for own messages ───────────────────────────────────────────

  const MessageStatus = ({ msg }: { msg: Message }) => {
    if (msg.senderId !== user?.id) return null;
    if (msg.status === 'pending') {
      return (
        <View style={b.statusRow}>
          <Feather name="clock" size={12} color={theme.textMuted as string} />
        </View>
      );
    }
    if (msg.status === 'failed') {
      return (
        <View style={b.statusRow}>
          <Feather name="alert-circle" size={13} color={COLORS.red} />
        </View>
      );
    }
    const color = msg.readAt ? COLORS.blue : (theme.textMuted as string);
    return (
      <View style={b.statusRow}>
        <Feather
          name="check"
          size={14}
          color={color}
        />
      </View>
    );
  };

  // ── Render message bubble ─────────────────────────────────────────────────

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === user?.id;
    const isFailed = item.status === 'failed';
    const isPending = item.status === 'pending';
    const prev = messages[index - 1];
    const showTime =
      !prev ||
      new Date(item.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;

    return (
      <View>
        {showTime && (
          <Text style={[b.timestamp, { color: theme.textMuted }]}>{fmtTime(item.createdAt)}</Text>
        )}
        <View style={[b.row, isMine ? b.rowRight : b.rowLeft]}>
          <TouchableOpacity
            disabled={!isFailed}
            onPress={() => retryMessage(item)}
            activeOpacity={isFailed ? 0.7 : 1}
            accessibilityLabel={isFailed ? 'Message non envoyé — réessayer' : undefined}
            style={[
              b.bubble,
              isMine
                ? [b.bubbleMine, { backgroundColor: theme.accent }]
                : [b.bubbleOther, { backgroundColor: theme.surface },
                   Platform.OS === 'ios' && { shadowColor: theme.text, shadowOpacity: theme.shadowOpacity * 0.7, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }],
              isPending && { opacity: 0.65 },
              isFailed && { opacity: 0.85, borderWidth: 1, borderColor: COLORS.red },
            ]}
          >
            <Text style={[b.text, isMine ? { color: theme.accentText } : { color: theme.textAlt }]}>{item.text}</Text>
          </TouchableOpacity>
          {isMine && <MessageStatus msg={item} />}
        </View>
        {isFailed && (
          <Text style={[b.failedHint, { color: COLORS.red }]}>
            Échec de l’envoi — appuyez sur le message pour réessayer
          </Text>
        )}
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View
        style={[s.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <TouchableOpacity
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
          style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Feather name="arrow-left" size={18} color={theme.textAlt} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[s.headerTitle, { color: theme.textAlt }]} numberOfLines={1}>{headerName}</Text>
          {isTyping && (
            <Text style={[s.typingLabel, { color: theme.textMuted }]}>écrit…</Text>
          )}
        </View>
        {requestId ? (
          <View style={[s.headerBadge, { backgroundColor: theme.surfaceAlt }]}>
            <Text style={[s.headerBadgeText, { color: theme.textMuted }]}>#{String(requestId).slice(-6).toUpperCase()}</Text>
          </View>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + headerHeight : 0}
      >
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : loadError && messages.length === 0 ? (
          <View style={s.emptyWrap}>
            <Feather name="wifi-off" size={44} color={theme.textMuted} />
            <Text style={[s.emptyText, { color: theme.textMuted }]}>
              Impossible de charger la conversation.
            </Text>
            <TouchableOpacity
              style={[s.retryBtn, { backgroundColor: theme.accent }]}
              onPress={() => { setLoading(true); loadConversation(); }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Réessayer"
            >
              <Feather name="refresh-cw" size={15} color={theme.accentText} />
              <Text style={[s.retryBtnText, { color: theme.accentText }]}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={s.list}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              isNearBottomRef.current =
                contentOffset.y + layoutMeasurement.height >= contentSize.height - 120;
            }}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (isNearBottomRef.current) flatListRef.current?.scrollToEnd({ animated: false });
            }}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Feather name="message-circle" size={44} color={theme.textMuted} />
                <Text style={[s.emptyText, { color: theme.textMuted }]}>Démarrez la conversation</Text>
              </View>
            }
            ListFooterComponent={
              isTyping ? (
                <View style={[b.row, b.rowLeft]}>
                  <View style={[b.bubble, b.bubbleOther, { backgroundColor: theme.surface }]}>
                    <Text style={[b.typingDots, { color: theme.textMuted }]}>•••</Text>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {/* Input bar — replaced by a locked banner when the conversation is
            closed (no active Request between the two users). */}
        {canChat === false ? (
          <View style={[s.lockedBar, { backgroundColor: theme.headerBg, borderTopColor: theme.border }]}>
            <Feather name="lock" size={16} color={theme.textMuted} />
            <Text style={[s.lockedText, { color: theme.textMuted }]} numberOfLines={2}>
              Conversation fermée — la demande associée est clôturée.
            </Text>
          </View>
        ) : (
          <View style={[s.inputBar, { backgroundColor: theme.headerBg, borderTopColor: theme.border }]}>
            <TextInput
              style={[s.input, { backgroundColor: theme.surface, color: theme.textAlt }]}
              value={inputText}
              onChangeText={handleTextChange}
              placeholder="Votre message…"
              placeholderTextColor={theme.textMuted}
              multiline
              maxLength={2000}
              blurOnSubmit={false}
              accessibilityLabel="Votre message"
            />
            <TouchableOpacity
              style={[s.sendBtn, { backgroundColor: theme.accent }, !inputText.trim() && s.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim()}
              accessibilityRole="button"
              accessibilityLabel="Envoyer le message"
              accessibilityState={{ disabled: !inputText.trim() }}
            >
              <Feather name="send" size={18} color={theme.accentText} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: 17, fontFamily: FONTS.bebas, letterSpacing: 0.5,
  },
  typingLabel: {
    fontSize: 11, fontFamily: FONTS.sans, marginTop: 1,
  },
  headerBadge: {
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  headerBadgeText: {
    fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 0.5,
  },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 12, paddingVertical: 16 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: FONTS.sans },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 100, paddingHorizontal: 20, paddingVertical: 11,
    marginTop: 10,
  },
  retryBtnText: { fontSize: 13, fontFamily: FONTS.sansMedium, letterSpacing: 0.5 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15, fontFamily: FONTS.sans, maxHeight: 120,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    marginBottom: 1,
  },
  sendBtnDisabled: { opacity: 0.4 },

  lockedBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1,
  },
  lockedText: { flex: 1, fontSize: 13, fontFamily: FONTS.sans },
});

const b = StyleSheet.create({
  timestamp: {
    textAlign: 'center', fontSize: 11, fontFamily: FONTS.mono,
    marginVertical: 8,
  },
  row: { marginVertical: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowLeft: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '78%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  bubbleMine: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    borderBottomLeftRadius: 4,
    ...Platform.select({
      android: { elevation: 1 },
    }),
  },
  text: { fontSize: 15, lineHeight: 21, fontFamily: FONTS.sans },
  statusRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    marginTop: 1, marginRight: 4,
  },
  typingDots: {
    fontSize: 18, fontWeight: '700', letterSpacing: 2,
  },
  failedHint: {
    textAlign: 'right', fontSize: 11, fontFamily: FONTS.sans,
    marginTop: 2, marginRight: 4,
  },
});
