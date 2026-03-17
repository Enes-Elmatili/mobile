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

import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
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
  const bg = theme.heroBg;

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
          <Text style={[av.initials, { fontSize: size * 0.34, color: theme.heroText }]}>{initials}</Text>
        </View>
      )}
      <TouchableOpacity
        style={[av.badge, { backgroundColor: theme.accent, borderColor: theme.cardBg, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity * 2.5, shadowRadius: 4 }, android: { elevation: 3 } }) }]}
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
  initials: { fontFamily: FONTS.bebas, letterSpacing: 1 },
  badge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'transparent',
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
  value: { fontSize: 16, fontFamily: FONTS.mono, fontWeight: '800' },
  label: { fontSize: 10, fontFamily: FONTS.sansMedium, textAlign: 'center' },
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
      <View style={[ms.card, { backgroundColor: t.cardBg, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: t.shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) }]}>
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
    fontSize: 11, fontFamily: FONTS.sansMedium,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, paddingHorizontal: 4,
  },
  card: {
    borderRadius: 18, overflow: 'hidden',
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
  label: { fontSize: 15, fontFamily: FONTS.sansMedium },
  labelDanger: { color: COLORS.danger },
  sublabel: { fontSize: 12, fontFamily: FONTS.sans, marginTop: 1 },
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
  const [editCity,    setEditCity]    = useState('');
  const [saving,      setSaving]      = useState(false);
  // Password change (email accounts only)
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [pwdSaving,   setPwdSaving]   = useState(false);
  const [avatarUri,   setAvatarUri]   = useState<string | null>(null);
  const [stripeReady, setStripeReady]  = useState(false);
  const [isVerified,  setIsVerified]  = useState(false);
  const [profileStats, setProfileStats] = useState({ rating: '—', missions: '—', earnings: '—', acceptance: '—' });

  const displayName = (user as any)?.name || user?.email?.split('@')[0] || 'Prestataire';
  const email = user?.email || '';
  const roles = user?.roles?.join(' · ') || 'Prestataire';

  // ── Chargement avatar : DB (via /me) → AsyncStorage fallback ────────────
  useEffect(() => {
    if (!user?.id) return;
    // Priorité : avatarUrl depuis l'API (DB), sinon AsyncStorage local
    const apiAvatar = (user as any)?.avatarUrl;
    if (apiAvatar) {
      const serverBase = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');
      const uri = apiAvatar.startsWith('http') ? apiAvatar : `${serverBase}${apiAvatar}`;
      setAvatarUri(uri);
    } else {
      AsyncStorage.getItem(avatarKey(user.id)).then(uri => { if (uri) setAvatarUri(uri); });
    }
  }, [user?.id, (user as any)?.avatarUrl]);

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
    setAvatarUri(asset.uri);
    if (user?.id) await AsyncStorage.setItem(avatarKey(user.id), asset.uri);

    // Upload vers /api/me/avatar → met à jour avatarUrl en DB (User + Provider)
    try {
      const token = await tokenStorage.getToken();
      if (!token) throw new Error('Not authenticated');
      const formData = new FormData();
      // @ts-ignore
      formData.append('avatar', { uri: asset.uri, name: 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = await res.json();
      // Mettre à jour avec l'URL serveur
      if (data.avatarUrl) {
        const sBase = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');
        const serverUri = data.avatarUrl.startsWith('http') ? data.avatarUrl : `${sBase}${data.avatarUrl}`;
        setAvatarUri(serverUri);
        if (user?.id) await AsyncStorage.setItem(avatarKey(user.id), serverUri);
      }
      await refreshMe();
      showSocketToast(t('common.success'), 'success');
    } catch {
      showSocketToast(t('common.error') || 'Échec de l\'upload', 'error');
    }
  }, [t]);

  const isEmailAccount = (user as any)?.authProvider === 'email' || !(user as any)?.authProvider;

  const openEditInfo = () => {
    setEditName((user as any)?.name || '');
    setEditPhone((user as any)?.phone || '');
    setEditCity((user as any)?.city || '');
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setEditVisible(true);
  };

  const saveEditInfo = async () => {
    setSaving(true);
    try {
      await api.patch('/me', {
        name: editName.trim() || null,
        phone: editPhone.trim() || null,
        city: editCity.trim() || null,
      });
      await refreshMe();
      setEditVisible(false);
    } catch (e: any) {
      showSocketToast(e?.message || t('profile.save_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (!currentPwd || !newPwd) {
      showSocketToast('Remplissez tous les champs', 'error');
      return;
    }
    if (newPwd.length < 8) {
      showSocketToast('Le mot de passe doit faire au moins 8 caractères', 'error');
      return;
    }
    if (newPwd !== confirmPwd) {
      showSocketToast('Les mots de passe ne correspondent pas', 'error');
      return;
    }
    setPwdSaving(true);
    try {
      await api.auth.changePassword(currentPwd, newPwd);
      showSocketToast('Mot de passe modifié', 'success');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (e: any) {
      showSocketToast(e?.message || 'Erreur lors du changement de mot de passe', 'error');
    } finally {
      setPwdSaving(false);
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
      icon: 'log-out-outline', iconColor: COLORS.danger, iconBg: theme.surface,
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
        <View style={[s.identityCard, { backgroundColor: theme.cardBg, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 3 } }) }]}>
          <ProviderAvatar name={displayName} size={82} avatarUri={avatarUri} onPickPhoto={handlePickPhoto} />
          <View style={s.identityInfo}>
            <View style={s.nameRow}>
              <Text style={[s.identityName, { color: theme.textAlt }]}>{displayName}</Text>
              {isVerified && (
                <View style={s.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.verified} />
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
                  <Ionicons name="lock-closed" size={9} color={COLORS.stripe} />
                  <Text style={s.stripeBadgeText}>Stripe</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Stats Row — visible uniquement pour les prestataires */}
        {!isClientOnly && (
          <View style={[s.statsCard, { backgroundColor: theme.cardBg, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 3 } }) }]}>
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
          {/* ── Header ── */}
          <View style={[em.header, { borderBottomColor: theme.border }]}>
            <TouchableOpacity
              style={[em.closeBtn, { backgroundColor: theme.surface }]}
              onPress={() => setEditVisible(false)}
              disabled={saving}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={theme.textAlt} />
            </TouchableOpacity>
            <Text style={[em.headerTitle, { color: theme.textAlt }]}>Mon compte</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            contentContainerStyle={em.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Avatar + Name hero ── */}
            <View style={em.heroSection}>
              <ProviderAvatar name={displayName} size={72} avatarUri={avatarUri} onPickPhoto={handlePickPhoto} />
              <Text style={[em.heroName, { color: theme.textAlt }]}>{displayName}</Text>
              {!isEmailAccount && (
                <View style={[em.authBadge, { backgroundColor: theme.surface }]}>
                  <Ionicons
                    name={(user as any)?.authProvider === 'apple' ? 'logo-apple' : 'logo-google'}
                    size={13}
                    color={theme.textSub}
                  />
                  <Text style={[em.authBadgeText, { color: theme.textSub }]}>
                    {(user as any)?.authProvider === 'apple' ? 'Apple' : 'Google'}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Section: Informations ── */}
            <Text style={[em.sectionLabel, { color: theme.textMuted }]}>INFORMATIONS PERSONNELLES</Text>
            <View style={[em.card, { backgroundColor: theme.cardBg, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) }]}>
              {/* Email — read-only */}
              <View style={em.fieldRow}>
                <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                  <Ionicons name="mail-outline" size={16} color={theme.textSub} />
                </View>
                <View style={em.fieldBody}>
                  <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Email</Text>
                  <Text style={[em.fieldValueStatic, { color: theme.textMuted }]} numberOfLines={1}>{email}</Text>
                </View>
                <Ionicons name="lock-closed" size={12} color={theme.textVeryMuted} />
              </View>

              <View style={[em.fieldDivider, { backgroundColor: theme.border }]} />

              {/* Name */}
              <View style={em.fieldRow}>
                <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                  <Ionicons name="person-outline" size={16} color={theme.textSub} />
                </View>
                <View style={em.fieldBody}>
                  <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Nom complet</Text>
                  <TextInput
                    style={[em.fieldInput, { color: theme.textAlt }]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Jean Dupont"
                    placeholderTextColor={theme.textVeryMuted}
                    autoCapitalize="words"
                    editable={!saving}
                  />
                </View>
              </View>

              <View style={[em.fieldDivider, { backgroundColor: theme.border }]} />

              {/* Phone */}
              <View style={em.fieldRow}>
                <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                  <Ionicons name="call-outline" size={16} color={theme.textSub} />
                </View>
                <View style={em.fieldBody}>
                  <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Téléphone</Text>
                  <TextInput
                    style={[em.fieldInput, { color: theme.textAlt }]}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="+33 6 00 00 00 00"
                    placeholderTextColor={theme.textVeryMuted}
                    keyboardType="phone-pad"
                    editable={!saving}
                  />
                </View>
              </View>

              <View style={[em.fieldDivider, { backgroundColor: theme.border }]} />

              {/* City */}
              <View style={em.fieldRow}>
                <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                  <Ionicons name="location-outline" size={16} color={theme.textSub} />
                </View>
                <View style={em.fieldBody}>
                  <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Ville</Text>
                  <TextInput
                    style={[em.fieldInput, { color: theme.textAlt }]}
                    value={editCity}
                    onChangeText={setEditCity}
                    placeholder="Paris"
                    placeholderTextColor={theme.textVeryMuted}
                    autoCapitalize="words"
                    editable={!saving}
                  />
                </View>
              </View>
            </View>

            {/* ── Save button ── */}
            <TouchableOpacity
              style={[em.saveBtn, { backgroundColor: theme.accent }, saving && { opacity: 0.6 }]}
              onPress={saveEditInfo}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={[em.saveBtnText, { color: theme.accentText }]}>
                {saving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
              </Text>
            </TouchableOpacity>

            {/* ── Section: Sécurité (email accounts only) ── */}
            {isEmailAccount && (
              <>
                <Text style={[em.sectionLabel, { color: theme.textMuted, marginTop: 28 }]}>SÉCURITÉ</Text>
                <View style={[em.card, { backgroundColor: theme.cardBg, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) }]}>
                  <View style={em.fieldRow}>
                    <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                      <Ionicons name="key-outline" size={16} color={theme.textSub} />
                    </View>
                    <View style={em.fieldBody}>
                      <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Mot de passe actuel</Text>
                      <TextInput
                        style={[em.fieldInput, { color: theme.textAlt }]}
                        value={currentPwd}
                        onChangeText={setCurrentPwd}
                        placeholder="Saisissez votre mot de passe"
                        placeholderTextColor={theme.textVeryMuted}
                        secureTextEntry
                        editable={!pwdSaving}
                      />
                    </View>
                  </View>

                  <View style={[em.fieldDivider, { backgroundColor: theme.border }]} />

                  <View style={em.fieldRow}>
                    <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                      <Ionicons name="lock-closed-outline" size={16} color={theme.textSub} />
                    </View>
                    <View style={em.fieldBody}>
                      <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Nouveau mot de passe</Text>
                      <TextInput
                        style={[em.fieldInput, { color: theme.textAlt }]}
                        value={newPwd}
                        onChangeText={setNewPwd}
                        placeholder="Min. 8 caractères"
                        placeholderTextColor={theme.textVeryMuted}
                        secureTextEntry
                        editable={!pwdSaving}
                      />
                    </View>
                  </View>

                  <View style={[em.fieldDivider, { backgroundColor: theme.border }]} />

                  <View style={em.fieldRow}>
                    <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                      <Ionicons name="shield-checkmark-outline" size={16} color={theme.textSub} />
                    </View>
                    <View style={em.fieldBody}>
                      <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Confirmer</Text>
                      <TextInput
                        style={[em.fieldInput, { color: theme.textAlt }]}
                        value={confirmPwd}
                        onChangeText={setConfirmPwd}
                        placeholder="Retapez le nouveau mot de passe"
                        placeholderTextColor={theme.textVeryMuted}
                        secureTextEntry
                        editable={!pwdSaving}
                      />
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[em.pwdBtn, { borderColor: theme.border }, pwdSaving && { opacity: 0.6 }]}
                  onPress={savePassword}
                  disabled={pwdSaving || (!currentPwd && !newPwd)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="lock-closed" size={14} color={(!currentPwd && !newPwd) ? theme.textVeryMuted : theme.textAlt} />
                  <Text style={[em.pwdBtnText, { color: (!currentPwd && !newPwd) ? theme.textVeryMuted : theme.textAlt }]}>
                    {pwdSaving ? 'Modification...' : 'Modifier le mot de passe'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Social account info ── */}
            {!isEmailAccount && (
              <>
                <Text style={[em.sectionLabel, { color: theme.textMuted, marginTop: 28 }]}>CONNEXION</Text>
                <View style={[em.card, { backgroundColor: theme.cardBg, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) }]}>
                  <View style={em.fieldRow}>
                    <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                      <Ionicons
                        name={(user as any)?.authProvider === 'apple' ? 'logo-apple' : 'logo-google'}
                        size={16}
                        color={theme.textSub}
                      />
                    </View>
                    <View style={em.fieldBody}>
                      <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Méthode de connexion</Text>
                      <Text style={[em.fieldValueStatic, { color: theme.textAlt }]}>
                        {(user as any)?.authProvider === 'apple' ? 'Apple ID' : 'Google'}
                      </Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
                  </View>
                </View>
              </>
            )}
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
  headerTitle: { fontSize: 26, fontFamily: FONTS.bebas },
  settingsBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },

  identityCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20,
    padding: 20, gap: 16, marginBottom: 12,
  },
  identityInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  identityName: { fontSize: 20, fontFamily: FONTS.bebas },
  verifiedBadge: { marginTop: 1 },
  identityEmail: { fontSize: 13, fontFamily: FONTS.sans },
  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  rolesPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  rolesText: { fontSize: 11, fontFamily: FONTS.sansMedium },
  stripeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  stripeBadgeText: { fontSize: 11, fontFamily: FONTS.sansMedium, color: COLORS.stripe },

  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 16, paddingHorizontal: 12,
    marginBottom: 20,
  },
  statsDivider: { width: 1, height: 40 },

  sections: { gap: 16 },

  version: {
    textAlign: 'center', fontSize: 12,
    marginTop: 24, fontFamily: FONTS.mono,
  },

  sheetContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 22, fontFamily: FONTS.bebas, marginBottom: 16 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  sheetIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetLabel: { flex: 1, fontSize: 15, fontFamily: FONTS.sansMedium },
});

const em = StyleSheet.create({
  root: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 16 : 20, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: FONTS.sansMedium },

  // ── Body ──
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },

  // ── Hero (avatar + name) ──
  heroSection: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  heroName: { fontSize: 24, fontFamily: FONTS.bebas, letterSpacing: 0.5 },
  authBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  authBadgeText: { fontSize: 12, fontFamily: FONTS.sansMedium },

  // ── Section labels ──
  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.sansMedium, letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 8, paddingHorizontal: 4,
  },

  // ── Grouped card ──
  card: { borderRadius: 18, overflow: 'hidden', marginBottom: 4 },

  // ── Field row (icon + label/input) ──
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  fieldIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  fieldBody: { flex: 1 },
  fieldLabel: { fontSize: 11, fontFamily: FONTS.sansMedium, letterSpacing: 0.3, marginBottom: 2 },
  fieldInput: { fontSize: 15, fontFamily: FONTS.sans, paddingVertical: 0, margin: 0 },
  fieldValueStatic: { fontSize: 15, fontFamily: FONTS.sans },
  fieldDivider: { height: 1, marginLeft: 62 },

  // ── Save button ──
  saveBtn: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16, marginBottom: 8,
  },
  saveBtnText: { fontSize: 15, fontFamily: FONTS.sansMedium, letterSpacing: 0.3 },

  // ── Password button ──
  pwdBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5,
    paddingVertical: 14, marginTop: 12, marginBottom: 8,
  },
  pwdBtnText: { fontSize: 14, fontFamily: FONTS.sansMedium },
});