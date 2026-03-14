// app/(tabs)/profile.tsx — Provider Profile Hub
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  Platform,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Image,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/AuthContext';
import { showSocketToast } from '../../lib/SocketContext';
import { api } from '../../lib/api';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '@/hooks/use-app-theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokenStorage } from '../../lib/storage';
import BottomSheet, { BottomSheetView, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const avatarKey = (userId: string) => `@fixed:profile:avatarUri:${userId}`;

// ============================================================================
// AVATAR WITH INITIALS + CAMERA BADGE
// ============================================================================

function ProviderAvatar({
  name,
  size = 80,
  avatarUri,
  onPickPhoto,
}: {
  name: string;
  size?: number;
  avatarUri?: string | null;
  onPickPhoto?: () => void;
}) {
  const theme = useAppTheme();
  const initials = name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const palette = ['#1A1A1A', '#2D2D2D', '#404040', '#555', '#333', '#666'];
  const bg = palette[name.charCodeAt(0) % palette.length];

  return (
    <View style={[av.wrapper, { width: size, height: size, borderRadius: size / 2 }]}>
      {avatarUri ? (
        <Image
          source={{ uri: avatarUri }}
          style={[av.circle, { borderRadius: size / 2 }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[av.circle, { backgroundColor: bg, borderRadius: size / 2 }]}>
          <Text style={[av.initials, { fontSize: size * 0.34 }]}>{initials}</Text>
        </View>
      )}
      <TouchableOpacity
        style={[av.badge, { backgroundColor: theme.accent, borderColor: theme.cardBg }]}
        activeOpacity={0.8}
        onPress={onPickPhoto}
      >
        <Ionicons name="camera" size={11} color={theme.accentText} />
      </TouchableOpacity>
    </View>
  );
}

const av = StyleSheet.create({
  wrapper: { position: 'relative' },
  circle: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFF', fontWeight: '800', letterSpacing: 1 },
  badge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'transparent',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
});

// ============================================================================
// STAT BADGE
// ============================================================================

function StatBadge({
  icon, iconColor, iconBg, value, label,
}: {
  icon: string; iconColor: string; iconBg: string; value: string; label: string;
}) {
  const t = useAppTheme();
  return (
    <View style={sb.wrap}>
      <View style={[sb.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={16} color={iconColor} />
      </View>
      <Text style={[sb.value, { color: t.textAlt }]}>{value}</Text>
      <Text style={[sb.label, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 4 },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  value: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 10, fontWeight: '500', textAlign: 'center' },
});

// ============================================================================
// MENU SECTION
// ============================================================================

type MenuItem = {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
};

function MenuSection({ title, items }: { title?: string; items: MenuItem[] }) {
  const t = useAppTheme();
  return (
    <View style={ms.wrap}>
      {!!title && <Text style={[ms.title, { color: t.textMuted }]}>{title}</Text>}
      <View style={[ms.card, { backgroundColor: t.cardBg }]}>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            <TouchableOpacity style={ms.row} onPress={item.onPress} activeOpacity={0.7}>
              <View style={[ms.iconBox, { backgroundColor: t.surface }]}>
                <Ionicons name={item.icon as any} size={18} color={item.iconColor} />
              </View>
              <View style={ms.content}>
                <Text style={[ms.label, item.danger ? ms.labelDanger : { color: t.textAlt }]}>{item.label}</Text>
                {item.sublabel ? <Text style={[ms.sublabel, { color: t.textMuted }]}>{item.sublabel}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={t.textMuted} />
            </TouchableOpacity>
            {i < items.length - 1 && <View style={[ms.divider, { backgroundColor: t.border }]} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  wrap: { marginBottom: 8 },
  title: {
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, paddingHorizontal: 4,
  },
  card: {
    borderRadius: 18, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, gap: 12,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  content: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600' },
  labelDanger: { color: '#DC2626' },
  sublabel: { fontSize: 12, marginTop: 1 },
  divider: { height: 1, marginLeft: 64 },
});

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function Profile() {
  const { user, signOut, refreshMe } = useAuth();
  const { t }                        = useTranslation();
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 70 : 54;

  const bottomSheetRef = useRef<BottomSheet>(null);
  // Dynamic sizing — sheet wraps its content

  const [editVisible, setEditVisible] = useState(false);
  const [editName,    setEditName]    = useState('');
  const [editPhone,   setEditPhone]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [avatarUri,   setAvatarUri]   = useState<string | null>(null);
  const [stripeReady, setStripeReady]  = useState(false);
  const [isVerified,  setIsVerified]  = useState(false);
  const [profileStats, setProfileStats] = useState({ rating: '—', missions: '—', earnings: '—', acceptance: '—' });

  const displayName = (user as any)?.name || user?.email?.split('@')[0] || 'Prestataire';
  const email = user?.email || '';
  const roles = user?.roles?.join(' · ') || 'Prestataire';

  // ── Chargement avatar + stats + statut bancaire ──────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    AsyncStorage.getItem(avatarKey(user.id)).then(uri => { if (uri) setAvatarUri(uri); });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.roles?.includes('PROVIDER')) return;
    (async () => {
      try {
        const [provResult, walletResult] = await Promise.allSettled([
          api.get<any>('/providers/me'),
          api.wallet.balance(),
        ]);
        if (provResult.status === 'fulfilled') {
          const prov = provResult.value?.data ?? provResult.value;
          const provider = prov?.provider ?? prov;
          setIsVerified(provider?.validationStatus === 'ACTIVE');
          const avgRating: number = provider?.avgRating ?? 0;
          const jobsCompleted: number = provider?.jobsCompleted ?? 0;
          const totalRequests: number = provider?.totalRequests ?? 0;
          const acceptedRequests: number = provider?.acceptedRequests ?? 0;
          const acceptanceRate = totalRequests > 0
            ? Math.round((acceptedRequests / totalRequests) * 100)
            : 0;
          setProfileStats(prev => ({
            ...prev,
            rating: avgRating > 0 ? avgRating.toFixed(1).replace('.', ',') : '—',
            missions: String(jobsCompleted),
            acceptance: totalRequests > 0 ? `${acceptanceRate}%` : '—',
          }));
        }
        if (walletResult.status === 'fulfilled') {
          const wallet = walletResult.value?.data ?? walletResult.value;
          const balanceCents: number = wallet?.balance ?? 0;
          setProfileStats(prev => ({
            ...prev,
            earnings: `${Math.floor(balanceCents / 100).toLocaleString('fr-FR')} €`,
          }));
        }
      } catch {
        // Garde les placeholders en cas d'erreur réseau
      }
    })();
  }, [user?.id, user?.roles?.join(',')]);

  useEffect(() => {
    if (!user?.roles?.includes('PROVIDER')) return;
    api.connect.status()
      .then((res: any) => {
        setStripeReady(!!(res?.isStripeReady || res?.isConnected));
      })
      .catch(() => setStripeReady(false));
  }, [user?.id, user?.roles?.join(',')]);

  // ── Photo upload ──────────────────────────────────────────────────────────
  const handlePickPhoto = useCallback(async () => {
    let ImagePicker: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ImagePicker = require('expo-image-picker');
    } catch {
      showSocketToast(t('profile.edit_photo_error'), 'error');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showSocketToast('Accès à la galerie refusé.', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    // Sauvegarder localement (pas de champ avatar en DB → AsyncStorage pour le MVP)
    if (user?.id) await AsyncStorage.setItem(avatarKey(user.id), asset.uri);
    setAvatarUri(asset.uri);

    // Upload en arrière-plan (optionnel — pour avoir l'URL sur le serveur)
    try {
      const token = await tokenStorage.getToken();
      if (!token) throw new Error('Not authenticated');
      const formData = new FormData();
      // @ts-ignore
      formData.append('file', { uri: asset.uri, name: 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      showSocketToast(t('common.success'), 'success');
    } catch {
      showSocketToast(t('common.error') || 'Échec de l\'upload', 'error');
    }
  }, [t]);

  const openEditInfo = () => {
    setEditName((user as any)?.name || '');
    setEditPhone((user as any)?.phone || '');
    setEditVisible(true);
  };

  const saveEditInfo = async () => {
    setSaving(true);
    try {
      await api.patch('/me', { name: editName.trim() || null, phone: editPhone.trim() || null });
      await refreshMe();
      setEditVisible(false);
    } catch (e: any) {
      showSocketToast(e?.message || t('profile.save_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('auth.logout'), t('auth.logout_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout_destructive'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.45} />
    ),
    []
  );

  const isClientOnly =
    user?.roles?.includes('CLIENT') && !user?.roles?.includes('PROVIDER');

  const accountItems: MenuItem[] = [
    {
      icon: 'person-outline', iconColor: theme.textSub, iconBg: theme.surface,
      label: t('profile.personal_info'), sublabel: t('profile.personal_info_sub'),
      onPress: openEditInfo,
    },
    // Messages & Abonnement visibles uniquement pour les prestataires
    ...(!isClientOnly
      ? [
          {
            icon: 'chatbubbles-outline' as string, iconColor: theme.textSub, iconBg: theme.surface,
            label: t('profile.messages'), sublabel: t('profile.messages_sub'),
            onPress: () => router.push('/messages'),
          },
          {
            icon: 'wallet-outline' as string, iconColor: theme.textSub, iconBg: theme.surface,
            label: t('profile.subscription'), sublabel: t('profile.subscription_sub'),
            onPress: () => router.push('/subscription'),
          },
        ]
      : []),
    ...(isClientOnly
      ? [{
          icon: 'briefcase-outline' as string, iconColor: theme.textSub, iconBg: theme.surface,
          label: t('profile.become_provider'), sublabel: t('profile.become_provider_sub'),
          onPress: () => router.push('/onboarding'),
        }]
      : []),
  ];

  const prefItems: MenuItem[] = [
    {
      icon: 'notifications-outline', iconColor: theme.textSub, iconBg: theme.surface,
      label: t('profile.notifications'), sublabel: t('profile.notifications_sub'),
      onPress: () => router.push('/settings/notifications'),
    },
    {
      icon: 'lock-closed-outline', iconColor: theme.textMuted, iconBg: theme.surface,
      label: t('profile.privacy'),
      onPress: () => router.push('/settings/privacy'),
    },
  ];

  const supportItems: MenuItem[] = [
    {
      icon: 'help-circle-outline', iconColor: theme.textSub, iconBg: theme.surface,
      label: t('profile.help'),
      onPress: () => router.push('/settings/help'),
    },
    {
      icon: 'document-text-outline', iconColor: theme.textMuted, iconBg: theme.surface,
      label: t('profile.terms'),
      onPress: () => router.push('/settings/cgu'),
    },
  ];

  const dangerItems: MenuItem[] = [
    {
      icon: 'log-out-outline', iconColor: '#DC2626', iconBg: theme.surface,
      label: t('auth.logout'),
      danger: true,
      onPress: handleLogout,
    },
  ];

  const sheetItems = [
    { icon: 'person-outline', iconColor: theme.textSub, iconBg: theme.surface, label: t('profile.personal_info'), onPress: openEditInfo },
    { icon: 'notifications-outline', iconColor: theme.textSub, iconBg: theme.surface, label: t('profile.notifications'), onPress: () => { bottomSheetRef.current?.close(); router.push('/settings/notifications'); } },
    { icon: 'lock-closed-outline', iconColor: theme.textMuted, iconBg: theme.surface, label: t('profile.privacy'), onPress: () => { bottomSheetRef.current?.close(); router.push('/settings/privacy'); } },
    { icon: 'help-circle-outline', iconColor: theme.textSub, iconBg: theme.surface, label: t('profile.help'), onPress: () => { bottomSheetRef.current?.close(); router.push('/settings/help'); } },
  ];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <Text style={[s.headerTitle, { color: theme.textAlt }]}>Profil</Text>
        <TouchableOpacity
          style={[s.settingsBtn, { backgroundColor: theme.surface }]}
          onPress={() => bottomSheetRef.current?.expand()}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={20} color={theme.textAlt} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Identity Card */}
        <View style={[s.identityCard, { backgroundColor: theme.cardBg }]}>
          <ProviderAvatar name={displayName} size={82} avatarUri={avatarUri} onPickPhoto={handlePickPhoto} />
          <View style={s.identityInfo}>
            <View style={s.nameRow}>
              <Text style={[s.identityName, { color: theme.textAlt }]}>{displayName}</Text>
              {isVerified && (
                <View style={s.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#1D9BF0" />
                </View>
              )}
            </View>
            <Text style={[s.identityEmail, { color: theme.textMuted }]}>{email}</Text>
            <View style={s.pillsRow}>
              <View style={[s.rolesPill, { backgroundColor: theme.surface }]}>
                <Ionicons name="briefcase-outline" size={11} color={theme.textSub} />
                <Text style={[s.rolesText, { color: theme.textSub }]}>{roles}</Text>
              </View>
              {stripeReady && user?.roles?.includes('PROVIDER') && (
                <View style={[s.stripeBadge, { backgroundColor: theme.stripeBadgeBg }]}>
                  <Ionicons name="lock-closed" size={9} color="#635BFF" />
                  <Text style={s.stripeBadgeText}>Stripe</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Stats Row — visible uniquement pour les prestataires */}
        {!isClientOnly && (
          <View style={[s.statsCard, { backgroundColor: theme.cardBg }]}>
            <StatBadge icon="star" iconColor={theme.textSub} iconBg={theme.surface} value={profileStats.rating} label="Note" />
            <View style={[s.statsDivider, { backgroundColor: theme.border }]} />
            <StatBadge icon="checkmark-circle-outline" iconColor={theme.textSub} iconBg={theme.surface} value={profileStats.missions} label="Missions" />
            <View style={[s.statsDivider, { backgroundColor: theme.border }]} />
            <StatBadge icon="cash-outline" iconColor={theme.textSub} iconBg={theme.surface} value={profileStats.earnings} label="Wallet" />
            <View style={[s.statsDivider, { backgroundColor: theme.border }]} />
            <StatBadge icon="trending-up-outline" iconColor={theme.textSub} iconBg={theme.surface} value={profileStats.acceptance} label="Taux accept." />
          </View>
        )}

        {/* Menus */}
        <View style={s.sections}>
          <MenuSection title="Mon compte" items={accountItems} />
          <MenuSection title="Préférences" items={prefItems} />
          <MenuSection title="Support" items={supportItems} />
          <MenuSection items={dangerItems} />
        </View>

        <Text style={[s.version, { color: theme.textMuted }]}>Version 1.0.0</Text>
      </ScrollView>

      {/* Modal — Édition informations personnelles */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[em.root, { backgroundColor: theme.bg }]}>
          <View style={[em.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setEditVisible(false)} disabled={saving}>
              <Text style={[em.cancel, { color: theme.textMuted }]}>Annuler</Text>
            </TouchableOpacity>
            <Text style={[em.title, { color: theme.textAlt }]}>Mes informations</Text>
            <TouchableOpacity onPress={saveEditInfo} disabled={saving}>
              <Text style={[em.save, saving && em.saveDisabled]}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={em.body}>
            <Text style={[em.label, { color: theme.textMuted }]}>NOM COMPLET</Text>
            <TextInput
              style={[em.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textAlt }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Jean Dupont"
              autoCapitalize="words"
              editable={!saving}
            />
            <Text style={[em.label, { color: theme.textMuted }]}>TÉLÉPHONE</Text>
            <TextInput
              style={[em.input, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.textAlt }]}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+33 6 00 00 00 00"
              keyboardType="phone-pad"
              editable={!saving}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.cardBg }}
        handleIndicatorStyle={{ backgroundColor: theme.border }}
        maxDynamicContentSize={Dimensions.get('window').height * 0.7}
      >
        <BottomSheetScrollView contentContainerStyle={[s.sheetContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={[s.sheetHandle, { backgroundColor: theme.border }]} />
          <Text style={[s.sheetTitle, { color: theme.textAlt }]}>Paramètres</Text>
          {sheetItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[s.sheetRow, { borderBottomColor: theme.border }]}
              activeOpacity={0.7}
              onPress={item.onPress}
            >
              <View style={[s.sheetIcon, { backgroundColor: theme.surface }]}>
                <Ionicons name={item.icon as any} size={18} color={item.iconColor} />
              </View>
              <Text style={[s.sheetLabel, { color: theme.textAlt }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </BottomSheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  settingsBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },

  identityCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20,
    padding: 20, gap: 16, marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  identityInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  identityName: { fontSize: 20, fontWeight: '800' },
  verifiedBadge: { marginTop: 1 },
  identityEmail: { fontSize: 13, fontWeight: '500' },
  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  rolesPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  rolesText: { fontSize: 11, fontWeight: '700' },
  stripeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  stripeBadgeText: { fontSize: 11, fontWeight: '700', color: '#635BFF' },

  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 16, paddingHorizontal: 12,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  statsDivider: { width: 1, height: 40 },

  sections: { gap: 16 },

  version: {
    textAlign: 'center', fontSize: 12,
    marginTop: 24, fontWeight: '500',
  },

  sheetContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  sheetIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
});

const em = StyleSheet.create({
  root:  { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title:        { fontSize: 17, fontWeight: '700' },
  cancel:       { fontSize: 16 },
  save:         { fontSize: 16, fontWeight: '700' },
  saveDisabled: { color: '#ADADAD' },
  body:  { padding: 20, gap: 4 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: 16 },
  input: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 16,
  },
});