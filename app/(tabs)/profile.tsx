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
  InteractionManager,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/AuthContext';
import { showSocketToast } from '../../lib/SocketContext';
import { api } from '../../lib/api';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { toFeatherName } from '@/lib/iconMapper';
import { formatEURInt } from '@/lib/format';
import { resolveAvatarUrl } from '@/lib/avatarUrl';
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
  const [imgFailed, setImgFailed] = React.useState(false);
  const initials = name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const bg = theme.heroBg;

  // Reset le state d'erreur quand l'URL change (nouvelle tentative)
  React.useEffect(() => { setImgFailed(false); }, [avatarUri]);

  const showImage = !!avatarUri && !imgFailed;

  return (
    <View style={[av.wrapper, { width: size, height: size, borderRadius: size / 2 }]}>
      {showImage ? (
        <Image
          source={{ uri: avatarUri! }}
          style={[av.circle, { borderRadius: size / 2 }]}
          resizeMode="cover"
          onError={(e) => {
            // eslint-disable-next-line no-console
            console.warn('[Avatar] Image failed to load:', avatarUri, e?.nativeEvent?.error);
            setImgFailed(true);
          }}
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
        <Feather name="camera" size={11} color={theme.accentText} />
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
        <Feather name={icon as any} size={16} color={iconColor} />
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
  label: { fontSize: 10, fontFamily: FONTS.mono, textAlign: 'center' },
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
      <View style={[ms.card, { backgroundColor: t.cardBg, borderColor: t.borderLight, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: t.shadowOpacity, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }, android: { elevation: 2 } }) }]}>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            <TouchableOpacity style={ms.row} onPress={item.onPress} activeOpacity={0.7}>
              <View style={[ms.iconBox, { backgroundColor: t.surface }]}>
                <Feather name={item.icon as any} size={18} color={item.iconColor} />
              </View>
              <View style={ms.content}>
                <Text style={[ms.label, item.danger ? ms.labelDanger : { color: t.textAlt }]}>{item.label}</Text>
                {item.sublabel ? <Text style={[ms.sublabel, { color: t.textMuted }]}>{item.sublabel}</Text> : null}
              </View>
              <Feather name="chevron-right" size={16} color={t.textMuted} />
            </TouchableOpacity>
            {i < items.length - 1 && <View style={[ms.divider, { backgroundColor: t.border }]} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  wrap: { marginBottom: 16 },
  title: {
    fontSize: 11, fontFamily: FONTS.mono,
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginBottom: 10, paddingHorizontal: 2,
  },
  card: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 15, gap: 14,
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
  // Provider-only : description ("À propos") visible par les clients + numéro TVA
  const [editProviderBio, setEditProviderBio] = useState('');
  const [editVatNumber,   setEditVatNumber]   = useState('');
  const [saving,      setSaving]      = useState(false);
  // Password change (email accounts only)
  const [pwdSheetOpen, setPwdSheetOpen] = useState(false);
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [pwdSaving,   setPwdSaving]   = useState(false);
  const [avatarUri,   setAvatarUri]   = useState<string | null>(null);
  const [stripeReady, setStripeReady]  = useState(false);
  const [isVerified,  setIsVerified]  = useState(false);
  // Category management
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [profileStats, setProfileStats] = useState({ rating: '—', missions: '—', earnings: '—', acceptance: '—' });
  const [tickets, setTickets] = useState<any[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);

  const displayName = (user as any)?.name || user?.email?.split('@')[0] || 'Prestataire';
  const email = user?.email || '';
  const roles = user?.roles?.join(' · ') || 'Prestataire';

  // ── Chargement avatar : URL serveur en priorité (source de vérité) ──
  // Stratégie : on privilégie l'URL serveur car les `file://` locaux cachés peuvent
  // devenir invalides entre sessions (réinstall, simulateur reset). La cache locale
  // n'est utilisée qu'en fallback offline si aucune URL serveur n'est encore connue.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const rawApiUrl = (user as any)?.avatarUrl;
      const apiUri = resolveAvatarUrl(rawApiUrl);
      console.log('[Avatar] Init useEffect — user.avatarUrl:', rawApiUrl, '→ resolved:', apiUri);
      if (apiUri) {
        setAvatarUri(apiUri);
        return;
      }
      // Pas d'URL serveur (jamais uploadé OU /me en échec) → tente la cache
      const cached = await AsyncStorage.getItem(avatarKey(user.id));
      console.log('[Avatar] No API URL, cache value:', cached);
      if (cached) setAvatarUri(cached);
    })();
  }, [user?.id, (user as any)?.avatarUrl]);

  // ── Chargement consolidé : provider stats + stripe + tickets en 1 seul useEffect ──
  useEffect(() => {
    if (!user?.id) return;
    const task = InteractionManager.runAfterInteractions(() => {
    const isProvider = user?.roles?.includes('PROVIDER');

    const promises: Promise<any>[] = [
      api.tickets.list().catch(() => null),
    ];
    if (isProvider) {
      promises.push(
        api.get<any>('/providers/me').catch(() => null),
        api.wallet.balance().catch(() => null),
        api.connect.status().catch(() => null),
      );
    }

    Promise.all(promises).then(([ticketsRes, provRes, walletRes, stripeRes]) => {
      // Tickets — on garde tout (la card filtre les ouverts pour l'affichage)
      const tickets = ticketsRes?.data || ticketsRes?.tickets || ticketsRes;
      if (Array.isArray(tickets)) setTickets(tickets);

      // Saved addresses
      api.addresses.list().then((res: any) => {
        setSavedAddresses(Array.isArray(res) ? res : res?.data || []);
      }).catch(() => {});

      if (!isProvider) return;

      // Provider stats
      if (provRes) {
        const prov = provRes?.data ?? provRes;
        const provider = prov?.provider ?? prov;
        setIsVerified(provider?.validationStatus === 'ACTIVE');
        const avgRating: number = provider?.avgRating ?? 0;
        const jobsCompleted: number = provider?.jobsCompleted ?? 0;
        const totalRequests: number = provider?.totalRequests ?? 0;
        const acceptedRequests: number = provider?.acceptedRequests ?? 0;
        const acceptanceRate = totalRequests > 0 ? Math.round((acceptedRequests / totalRequests) * 100) : 0;
        setProfileStats(prev => ({
          ...prev,
          rating: avgRating > 0 ? avgRating.toFixed(1).replace('.', ',') : '—',
          missions: String(jobsCompleted),
          acceptance: totalRequests > 0 ? `${acceptanceRate}%` : '—',
        }));
      }
      // Wallet
      if (walletRes) {
        const wallet = walletRes?.data ?? walletRes;
        const balanceCents: number = wallet?.balance ?? 0;
        setProfileStats(prev => ({
          ...prev,
          earnings: formatEURInt(balanceCents / 100),
        }));
      }
      // Stripe
      setStripeReady(!!(stripeRes?.isStripeReady || stripeRes?.isConnected));
    });
    });
    return () => task.cancel();
  }, [user?.id]);

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
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    // Store base64 locally — survives Railway restarts and network issues
    const localUri = asset.base64
      ? `data:image/jpeg;base64,${asset.base64}`
      : asset.uri;
    setAvatarUri(localUri);
    if (user?.id) await AsyncStorage.setItem(avatarKey(user.id), localUri);

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
        headers: { Authorization: `Bearer ${token}`, ...(__DEV__ ? { 'ngrok-skip-browser-warning': 'true' } : {}) },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = await res.json();
      // Cache la server URL résolue (au lieu du file:// local qui devient invalide
      // entre sessions). Ainsi le démarrage suivant trouve une URL stable.
      // Cache-bust : timestamp en query pour forcer Image à recharger même si
      // l'URI est déjà en cache (cas upload sur le même nom de fichier — rare
      // mais possible avec collision ou retry).
      const baseUri = resolveAvatarUrl(data?.avatarUrl);
      const serverUri = baseUri ? `${baseUri}?t=${Date.now()}` : null;
      console.log('[Avatar] Upload OK — server URL:', baseUri, '→ display URI:', serverUri);
      if (serverUri && user?.id) {
        await AsyncStorage.setItem(avatarKey(user.id), serverUri).catch(() => {});
        setAvatarUri(serverUri);
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
    // Provider info pré-remplie via api.providers.me() ci-dessous (gardée vide
    // par défaut côté client puisque l'écran cache la section)
    setEditProviderBio('');
    setEditVatNumber('');
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setEditVisible(true);

    if (!isClientOnly) {
      setCatsLoading(true);
      // Taxonomies: cache in AsyncStorage (rarely changes)
      const loadCats = async (): Promise<any[]> => {
        try {
          const cached = await AsyncStorage.getItem('taxonomies_cache');
          if (cached) {
            const { data, ts } = JSON.parse(cached);
            if (Date.now() - ts < 24 * 60 * 60 * 1000) return data; // 24h TTL
          }
        } catch {}
        const res = await api.taxonomies.list();
        const cats = res?.data ?? res ?? [];
        const arr = Array.isArray(cats) ? cats : [];
        AsyncStorage.setItem('taxonomies_cache', JSON.stringify({ data: arr, ts: Date.now() })).catch(() => {});
        return arr;
      };
      Promise.all([
        loadCats(),
        api.providers.me(),
      ]).then(([cats, provRes]) => {
        setAllCategories(cats);
        const prov = provRes?.provider ?? provRes?.data?.provider ?? provRes?.data ?? provRes;
        const currentIds = (prov?.categories || []).map((c: any) => c.id);
        setSelectedCatIds(currentIds);
        setEditProviderBio(prov?.description || '');
        setEditVatNumber(prov?.vatNumber || '');
      }).catch(() => {
        showSocketToast('Erreur chargement des catégories', 'error');
      }).finally(() => setCatsLoading(false));
    }
  };

  const toggleCategory = useCallback((id: number) => {
    setSelectedCatIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }, []);

  const saveEditInfo = async () => {
    if (!isClientOnly && selectedCatIds.length === 0) {
      showSocketToast('Sélectionnez au moins un service', 'error');
      return;
    }
    setSaving(true);
    try {
      // Payload commun (User)
      const userPayload: any = {
        name: editName.trim() || null,
        phone: editPhone.trim() || null,
        city: editCity.trim() || null,
      };
      if (!isClientOnly) {
        // Provider : description + vatNumber + categories vont sur Provider table
        const providerPayload: any = {
          ...userPayload,
          description: editProviderBio.trim() || null,
          vatNumber: editVatNumber.trim().toUpperCase() || null,
          categoryIds: selectedCatIds,
        };
        await api.providers.updateMe(providerPayload);
      } else {
        await api.patch('/me', userPayload);
      }
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

  const handleDeleteAddress = (id: number) => {
    Alert.alert(t('addresses.delete_confirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try {
            await api.addresses.remove(id);
            setSavedAddresses(prev => prev.filter(a => a.id !== id));
          } catch {}
        },
      },
    ]);
  };

  const accountItems: MenuItem[] = [
    {
      icon: 'user', iconColor: theme.textSub, iconBg: theme.surface,
      label: t('profile.personal_info'), sublabel: t('profile.personal_info_sub'),
      onPress: openEditInfo,
    },
    // Messages & Abonnement visibles uniquement pour les prestataires
    ...(!isClientOnly
      ? [
          {
            icon: 'message-circle' as string, iconColor: theme.textSub, iconBg: theme.surface,
            label: t('profile.messages'), sublabel: t('profile.messages_sub'),
            onPress: () => router.push('/messages'),
          },
          {
            icon: 'credit-card' as string, iconColor: theme.textSub, iconBg: theme.surface,
            label: t('profile.subscription'), sublabel: t('profile.subscription_sub'),
            onPress: () => router.push('/subscription'),
          },
        ]
      : []),
  ];

  const prefItems: MenuItem[] = [
    {
      icon: 'bell', iconColor: theme.textSub, iconBg: theme.surface,
      label: t('profile.notifications'), sublabel: t('profile.notifications_sub'),
      onPress: () => router.push('/settings/notifications'),
    },
    {
      icon: 'lock', iconColor: theme.textMuted, iconBg: theme.surface,
      label: t('profile.privacy'),
      onPress: () => router.push('/settings/privacy'),
    },
  ];

  const supportItems: MenuItem[] = [
    {
      icon: 'help-circle', iconColor: theme.textSub, iconBg: theme.surface,
      label: t('profile.help'),
      onPress: () => router.push('/settings/help'),
    },
    {
      icon: 'file-text', iconColor: theme.textMuted, iconBg: theme.surface,
      label: t('profile.terms'),
      onPress: () => router.push('/settings/cgu'),
    },
  ];

  const dangerItems: MenuItem[] = [
    {
      icon: 'log-out', iconColor: COLORS.danger, iconBg: theme.surface,
      label: t('auth.logout'),
      danger: true,
      onPress: handleLogout,
    },
  ];

  const sheetItems = [
    { icon: 'user', iconColor: theme.textSub, iconBg: theme.surface, label: t('profile.personal_info'), onPress: openEditInfo },
    { icon: 'bell', iconColor: theme.textSub, iconBg: theme.surface, label: t('profile.notifications'), onPress: () => { bottomSheetRef.current?.close(); router.push('/settings/notifications'); } },
    { icon: 'lock', iconColor: theme.textMuted, iconBg: theme.surface, label: t('profile.privacy'), onPress: () => { bottomSheetRef.current?.close(); router.push('/settings/privacy'); } },
    { icon: 'help-circle', iconColor: theme.textSub, iconBg: theme.surface, label: t('profile.help'), onPress: () => { bottomSheetRef.current?.close(); router.push('/settings/help'); } },
  ];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.bg }]}>
        <View>
          <Text style={[s.headerGreeting, { color: theme.textMuted }]}>
            MEMBRE FIXED DEPUIS {new Date((user as any)?.createdAt || Date.now()).getFullYear()}
          </Text>
          <Text style={[s.headerTitle, { color: theme.text }]}>PROFIL</Text>
        </View>
        <TouchableOpacity
          style={[s.settingsBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
          onPress={() => bottomSheetRef.current?.expand()}
          activeOpacity={0.7}
        >
          <Feather name="settings" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero Card — dark premium */}
        <View style={[s.heroCard, { backgroundColor: theme.heroBg }]}>
          <View style={s.heroTop}>
            <ProviderAvatar name={displayName} size={60} avatarUri={avatarUri} onPickPhoto={handlePickPhoto} />
            <View style={s.heroIdentity}>
              <Text style={[s.heroName, { color: theme.heroText }]}>{displayName.toUpperCase()}</Text>
              <Text style={s.heroEmail}>{email}</Text>
              <View style={s.heroBadges}>
                <View style={s.roleBadge}>
                  <Feather name="briefcase" size={9} color="rgba(255,255,255,0.4)" />
                  <Text style={s.roleBadgeText}>{roles}</Text>
                </View>
                {isVerified && (
                  <View style={s.verifiedBadge}>
                    <Feather name="check" size={9} color={COLORS.greenBrand} />
                    <Text style={s.verifiedBadgeText}>Vérifié</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Stats strip */}
          <View style={s.heroStrip}>
            <View style={s.stripItem}>
              <View style={s.stripIcon}><Feather name="calendar" size={13} color="rgba(255,255,255,0.4)" /></View>
              <Text style={s.stripValue}>{new Date((user as any)?.createdAt || Date.now()).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</Text>
              <Text style={s.stripLabel}>Membre</Text>
            </View>
            <View style={s.stripItem}>
              <View style={s.stripIcon}><Feather name="credit-card" size={13} color="rgba(255,255,255,0.4)" /></View>
              <Text style={s.stripValue}>•••• 4242</Text>
              <Text style={s.stripLabel}>Paiement</Text>
            </View>
            <View style={s.stripItem}>
              <View style={s.stripIcon}><Feather name="map-pin" size={13} color="rgba(255,255,255,0.4)" /></View>
              <Text style={s.stripValue}>{(user as any)?.city || 'Bruxelles'}</Text>
              <Text style={s.stripLabel}>Adresse</Text>
            </View>
            <View style={s.stripItem}>
              <View style={[s.stripIcon, s.stripIconGreen]}><Feather name="shield" size={13} color={COLORS.green} /></View>
              <Text style={[s.stripValue, { color: COLORS.green }]}>Actif</Text>
              <Text style={s.stripLabel}>Statut</Text>
            </View>
          </View>
        </View>

        {/* Menus */}
        <View style={s.sections}>
          <MenuSection title="Mon compte" items={accountItems} />

          {/* Mes adresses */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 8 }}>
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1, color: theme.textMuted, textTransform: 'uppercase' }}>
                {t('addresses.my_addresses')}
              </Text>
            </View>
            <View style={{ backgroundColor: theme.cardBg, borderRadius: 18, borderWidth: 1, borderColor: theme.borderLight, overflow: 'hidden' }}>
              {savedAddresses.length > 0 ? (
                savedAddresses.map((addr: any, i: number) => (
                  <View key={addr.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Feather name="bookmark" size={16} color={theme.textMuted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: theme.text }}>{addr.label}</Text>
                        <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: theme.textMuted, marginTop: 2 }} numberOfLines={1}>{addr.address}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteAddress(addr.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Feather name="trash-2" size={16} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>
                    {i < savedAddresses.length - 1 && <View style={{ height: 1, backgroundColor: theme.border, marginLeft: 64 }} />}
                  </View>
                ))
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Feather name="map-pin" size={24} color={theme.textMuted} />
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: theme.textMuted, marginTop: 8 }}>{t('addresses.empty')}</Text>
                </View>
              )}
            </View>
          </View>

          <MenuSection title="Préférences" items={prefItems} />

          {/* Support tickets — affiche les ouverts + CTA "Créer un ticket" toujours visible */}
          {(() => {
            const openTickets = tickets.filter((tk: any) => tk.status === 'OPEN' || tk.status === 'IN_PROGRESS').slice(0, 3);
            const hasMoreThanShown = tickets.length > openTickets.length;
            return (
              <View style={tk.wrap}>
                <View style={tk.header}>
                  <Text style={[tk.sectionLabel, { color: theme.textMuted }]}>Support</Text>
                  {openTickets.length > 0 && (
                    <View style={[tk.countBadge, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                      <Text style={[tk.countBadgeText, { color: COLORS.amber }]}>
                        {openTickets.length} ouvert{openTickets.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[tk.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
                  {openTickets.map((ticket: any, i: number) => {
                    const statusLabel = ticket.status === 'OPEN' ? 'Ouvert' : 'En cours';
                    const date = new Date(ticket.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                    return (
                      <TouchableOpacity
                        key={ticket.id}
                        style={[tk.row, { borderBottomWidth: 1, borderBottomColor: theme.borderLight }]}
                        onPress={() => router.push({ pathname: '/tickets/[id]', params: { id: ticket.id } })}
                        activeOpacity={0.7}
                      >
                        <View style={[tk.dot, { backgroundColor: COLORS.amber }]} />
                        <View style={tk.info}>
                          <Text style={[tk.title, { color: theme.text }]} numberOfLines={1}>{ticket.title}</Text>
                          <Text style={[tk.meta, { color: theme.textMuted }]}>
                            {ticket.requestId ? `Mission #${ticket.requestId} · ` : ''}{date}
                          </Text>
                        </View>
                        <View style={tk.pillOrange}>
                          <Text style={[tk.pillText, { color: COLORS.amber }]}>{statusLabel}</Text>
                        </View>
                        <Feather name="chevron-right" size={12} color={theme.textDisabled} />
                      </TouchableOpacity>
                    );
                  })}

                  {/* CTA "Créer un ticket" — toujours visible */}
                  <TouchableOpacity
                    style={tk.row}
                    onPress={() => router.push('/support')}
                    activeOpacity={0.7}
                  >
                    <View style={[tk.emptyIcon, { backgroundColor: theme.surface, width: 28, height: 28, borderRadius: 14 }]}>
                      <Feather name="plus" size={14} color={theme.textSub} />
                    </View>
                    <View style={tk.info}>
                      <Text style={[tk.title, { color: theme.text }]}>Créer un ticket</Text>
                      <Text style={[tk.meta, { color: theme.textMuted }]}>Diagnostic guidé · réponse en moins de 2h</Text>
                    </View>
                    <Feather name="chevron-right" size={12} color={theme.textDisabled} />
                  </TouchableOpacity>

                  {hasMoreThanShown && (
                    <TouchableOpacity style={[tk.viewAll, { borderTopColor: theme.borderLight }]} onPress={() => router.push('/settings/help')} activeOpacity={0.6}>
                      <Text style={[tk.viewAllText, { color: theme.textMuted }]}>Voir tous les tickets (résolus inclus)</Text>
                      <Feather name="chevron-right" size={11} color={theme.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })()}

          <MenuSection items={supportItems} />
          <MenuSection items={dangerItems} />
        </View>

        <Text style={[s.version, { color: theme.textDisabled }]}>FIXED v1.0.0 · Brussels</Text>
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
              <Feather name="x" size={18} color={theme.textAlt} />
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
                  <Feather name="mail" size={16} color={theme.textSub} />
                </View>
                <View style={em.fieldBody}>
                  <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Email</Text>
                  <Text style={[em.fieldValueStatic, { color: theme.textMuted }]} numberOfLines={1}>{email}</Text>
                </View>
                <Feather name="lock" size={12} color={theme.textVeryMuted} />
              </View>

              <View style={[em.fieldDivider, { backgroundColor: theme.border }]} />

              {/* Name */}
              <View style={em.fieldRow}>
                <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                  <Feather name="user" size={16} color={theme.textSub} />
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
                  <Feather name="phone" size={16} color={theme.textSub} />
                </View>
                <View style={em.fieldBody}>
                  <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Téléphone</Text>
                  <TextInput
                    style={[em.fieldInput, { color: theme.textAlt }]}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="+32 4XX XX XX XX"
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
                  <Feather name="map-pin" size={16} color={theme.textSub} />
                </View>
                <View style={em.fieldBody}>
                  <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Ville</Text>
                  <TextInput
                    style={[em.fieldInput, { color: theme.textAlt }]}
                    value={editCity}
                    onChangeText={setEditCity}
                    placeholder="Ixelles, Bruxelles…"
                    placeholderTextColor={theme.textVeryMuted}
                    autoCapitalize="words"
                    editable={!saving}
                  />
                </View>
              </View>
            </View>

            {/* ── Section: À propos (providers only) ──
                Description visible par les clients sur la fiche publique.
                Plus le numéro de TVA pour la facturation officielle. */}
            {!isClientOnly && (
              <>
                <Text style={[em.sectionLabel, { color: theme.textMuted, marginTop: 20 }]}>À PROPOS</Text>
                <View style={[em.card, { backgroundColor: theme.cardBg, padding: 16, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Feather name="eye" size={12} color={theme.textMuted} />
                    <Text style={{ fontSize: 11, fontFamily: FONTS.sans, color: theme.textMuted }}>
                      Visible sur votre fiche publique consultée par les clients
                    </Text>
                  </View>
                  <TextInput
                    style={{
                      fontSize: 14, fontFamily: FONTS.sans, color: theme.textAlt,
                      minHeight: 90, maxHeight: 160,
                      textAlignVertical: 'top',
                      paddingVertical: 4,
                    }}
                    value={editProviderBio}
                    onChangeText={setEditProviderBio}
                    placeholder="Présentez votre activité — ex : Plombier-chauffagiste agréé depuis 2018, intervention rapide à Ixelles et alentours. Spécialiste fuites, débouchage, installation chauffe-eau."
                    placeholderTextColor={theme.textVeryMuted}
                    multiline
                    maxLength={2000}
                    editable={!saving}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                    <Text style={{ fontSize: 10, fontFamily: FONTS.mono, color: theme.textVeryMuted }}>
                      {editProviderBio.length}/2000
                    </Text>
                  </View>
                </View>

                <Text style={[em.sectionLabel, { color: theme.textMuted, marginTop: 20 }]}>FACTURATION</Text>
                <View style={[em.card, { backgroundColor: theme.cardBg, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) }]}>
                  <View style={em.fieldRow}>
                    <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                      <Feather name="file-text" size={16} color={theme.textSub} />
                    </View>
                    <View style={em.fieldBody}>
                      <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Numéro de TVA</Text>
                      <TextInput
                        style={[em.fieldInput, { color: theme.textAlt }]}
                        value={editVatNumber}
                        onChangeText={setEditVatNumber}
                        placeholder="BE0123456789"
                        placeholderTextColor={theme.textVeryMuted}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={20}
                        editable={!saving}
                      />
                    </View>
                  </View>
                  <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontFamily: FONTS.sans, color: theme.textMuted, lineHeight: 15 }}>
                      Format BE + 10 chiffres. Apparaît sur les factures émises au client.
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* ── Section: Mes services (providers only) ── */}
            {!isClientOnly && (
              <>
                <Text style={[em.sectionLabel, { color: theme.textMuted, marginTop: 20 }]}>MES SERVICES</Text>
                <View style={[em.card, { backgroundColor: theme.cardBg, padding: 16, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) }]}>
                  {catsLoading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                      <ActivityIndicator color={theme.textMuted} />
                    </View>
                  ) : allCategories.length === 0 ? (
                    // Empty state propre : pas de catégories chargées (échec API ou aucune dispo)
                    <View style={{ alignItems: 'center', paddingVertical: 18, gap: 8 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name="briefcase" size={18} color={theme.textMuted} />
                      </View>
                      <Text style={{ fontSize: 13, color: theme.textSub, fontFamily: FONTS.sans, textAlign: 'center' }}>
                        Aucun service disponible pour le moment.
                      </Text>
                      <TouchableOpacity
                        onPress={openEditInfo}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight }}
                      >
                        <Text style={{ fontSize: 12, color: theme.text, fontFamily: FONTS.sansMedium }}>Réessayer</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <View style={catStyles.grid}>
                        {[...allCategories].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(cat => {
                          const sel = selectedCatIds.includes(cat.id);
                          return (
                            <TouchableOpacity
                              key={cat.id}
                              style={[
                                catStyles.chip,
                                { borderColor: sel ? theme.accent : theme.border },
                                sel && { backgroundColor: theme.accent },
                              ]}
                              onPress={() => toggleCategory(cat.id)}
                              activeOpacity={0.7}
                              disabled={saving}
                            >
                              <Feather
                                name={toFeatherName(cat.icon, 'briefcase') as any}
                                size={14}
                                color={sel ? theme.accentText : theme.textMuted}
                              />
                              <Text
                                numberOfLines={1}
                                style={[
                                  catStyles.chipText,
                                  { color: sel ? theme.accentText : theme.textSub },
                                ]}
                              >
                                {cat.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {selectedCatIds.length > 0 && (
                        <Text style={[catStyles.count, { color: theme.textMuted }]}>
                          {selectedCatIds.length} service{selectedCatIds.length > 1 ? 's' : ''} sélectionné{selectedCatIds.length > 1 ? 's' : ''}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              </>
            )}

            {/* ── Save button (contraste brutal disabled vs active) ── */}
            {(() => {
              const u = user as any;
              const baseDirty =
                editName.trim() !== ((u?.name || '').trim()) ||
                editPhone.trim() !== ((u?.phone || '').trim()) ||
                editCity.trim() !== ((u?.city || '').trim());
              // Pour les providers, on accepte aussi les modifs sur description / vatNumber
              // (mais on ne peut pas comparer à l'état d'origine simplement, donc on laisse
              // le bouton actif tant qu'au moins une cat est sélectionnée).
              const noProviderCats = !isClientOnly && selectedCatIds.length === 0;
              const disabled = saving || noProviderCats || (!baseDirty && isClientOnly);
              return (
                <TouchableOpacity
                  style={[
                    em.saveBtn,
                    disabled
                      ? { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderLight }
                      : { backgroundColor: theme.accent },
                  ]}
                  onPress={saveEditInfo}
                  disabled={disabled}
                  activeOpacity={0.85}
                >
                  <Text style={[em.saveBtnText, { color: disabled ? theme.textMuted : theme.accentText }]}>
                    {saving
                      ? 'Sauvegarde…'
                      : noProviderCats
                        ? 'Sélectionnez au moins un service'
                        : !baseDirty && isClientOnly
                          ? 'Aucune modification'
                          : 'Enregistrer les modifications'}
                  </Text>
                </TouchableOpacity>
              );
            })()}

            {/* ── Section: Sécurité (email accounts only) ── */}
            {isEmailAccount && (
              <>
                <Text style={[em.sectionLabel, { color: theme.textMuted, marginTop: 28 }]}>SÉCURITÉ</Text>
                {!pwdSheetOpen ? (
                  // État replié : un seul row "Changer mon mot de passe"
                  <TouchableOpacity
                    style={[em.card, { backgroundColor: theme.cardBg }]}
                    onPress={() => { setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); setPwdSheetOpen(true); }}
                    activeOpacity={0.7}
                  >
                    <View style={em.fieldRow}>
                      <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                        <Feather name="lock" size={16} color={theme.textSub} />
                      </View>
                      <View style={em.fieldBody}>
                        <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Mot de passe</Text>
                        <Text style={[em.fieldValueStatic, { color: theme.textAlt }]}>••••••••</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: FONTS.sansMedium, color: theme.text }}>Modifier</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  // État déployé : 3 champs + 2 boutons (annuler / valider)
                  <View style={[em.card, { backgroundColor: theme.cardBg }]}>
                    <View style={em.fieldRow}>
                      <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                        <Feather name="key" size={16} color={theme.textSub} />
                      </View>
                      <View style={em.fieldBody}>
                        <Text style={[em.fieldLabel, { color: theme.textMuted }]}>Mot de passe actuel</Text>
                        <TextInput
                          style={[em.fieldInput, { color: theme.textAlt }]}
                          value={currentPwd}
                          onChangeText={setCurrentPwd}
                          placeholder="Saisissez votre mot de passe"
                          placeholderTextColor={theme.textVeryMuted}
                          secureTextEntry autoFocus
                          editable={!pwdSaving}
                        />
                      </View>
                    </View>

                    <View style={[em.fieldDivider, { backgroundColor: theme.border }]} />

                    <View style={em.fieldRow}>
                      <View style={[em.fieldIcon, { backgroundColor: theme.surface }]}>
                        <Feather name="lock" size={16} color={theme.textSub} />
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
                        <Feather name="shield" size={16} color={theme.textSub} />
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

                    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}
                        onPress={() => { setPwdSheetOpen(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); }}
                        disabled={pwdSaving}
                      >
                        <Text style={{ fontSize: 13, fontFamily: FONTS.sansMedium, color: theme.text }}>Annuler</Text>
                      </TouchableOpacity>
                      {(() => {
                        const canSubmit = currentPwd.length > 0 && newPwd.length >= 8 && newPwd === confirmPwd;
                        return (
                          <TouchableOpacity
                            style={{
                              flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
                              backgroundColor: canSubmit && !pwdSaving ? theme.accent : theme.surface,
                              borderWidth: canSubmit ? 0 : 1, borderColor: theme.borderLight,
                            }}
                            onPress={async () => { await savePassword(); if (!pwdSaving) setPwdSheetOpen(false); }}
                            disabled={!canSubmit || pwdSaving}
                          >
                            <Text style={{ fontSize: 13, fontFamily: FONTS.sansMedium, color: canSubmit && !pwdSaving ? theme.accentText : theme.textMuted }}>
                              {pwdSaving ? 'Modification…' : 'Confirmer'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })()}
                    </View>
                  </View>
                )}
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
                    <Feather name="check-circle" size={18} color={COLORS.green} />
                  </View>
                </View>
              </>
            )}

            {/* ── Suppression de compte (RGPD) — discret en bas ── */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Supprimer mon compte',
                  'Cette action est irréversible. Vos données personnelles seront supprimées sous 30 jours, à l\'exception des justificatifs comptables conservés 7 ans (obligation légale).\n\nConfirmer la suppression ?',
                  [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Supprimer', style: 'destructive', onPress: () => {
                        // TODO : appeler api.account.delete() quand l'endpoint existe
                        showSocketToast('Demande envoyée — un email de confirmation suit.', 'info');
                      },
                    },
                  ],
                  { cancelable: true },
                );
              }}
              style={{ marginTop: 28, marginBottom: 8, paddingVertical: 12, alignItems: 'center' }}
              activeOpacity={0.6}
            >
              <Text style={{ fontSize: 12, fontFamily: FONTS.sansMedium, color: '#EF4444' }}>
                Supprimer mon compte
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 10, fontFamily: FONTS.sans, color: theme.textVeryMuted, textAlign: 'center', marginBottom: 12 }}>
              Conformément au RGPD · Conservation 7 ans des données comptables
            </Text>
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
                <Feather name={item.icon as any} size={18} color={item.iconColor} />
              </View>
              <Text style={[s.sheetLabel, { color: theme.textAlt }]}>{item.label}</Text>
              <Feather name="chevron-right" size={16} color={theme.textMuted} />
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
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12,
  },
  headerGreeting: {
    fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.9,
    textTransform: 'uppercase', marginBottom: 6,
  },
  headerTitle: { fontSize: 44, fontFamily: FONTS.bebas, letterSpacing: 0.5 },
  settingsBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },

  // Hero card — dark premium
  heroCard: {
    borderRadius: 24,
    paddingHorizontal: 20, paddingTop: 22,
    marginBottom: 28,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 16, paddingBottom: 20,
  },
  heroIdentity: { flex: 1, paddingTop: 2 },
  heroName: {
    fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 0.8,
    lineHeight: 22, marginBottom: 5,
  },
  heroEmail: {
    fontFamily: FONTS.sans, fontSize: 11,
    color: 'rgba(255,255,255,0.3)', marginBottom: 10,
  },
  heroBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4,
  },
  roleBadgeText: {
    fontFamily: FONTS.sansMedium, fontSize: 9, letterSpacing: 1,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
  },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(61,139,61,0.12)',
    borderWidth: 1, borderColor: 'rgba(61,139,61,0.22)',
    borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4,
  },
  verifiedBadgeText: {
    fontFamily: FONTS.sansMedium, fontSize: 9, letterSpacing: 1,
    textTransform: 'uppercase', color: COLORS.green,
  },

  // Strip stats
  heroStrip: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: -20,
  },
  stripItem: {
    flex: 1, alignItems: 'center', gap: 5,
    paddingVertical: 14,
  },
  stripIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  stripIconGreen: { backgroundColor: 'rgba(61,139,61,0.1)' },
  stripValue: {
    fontFamily: FONTS.mono, fontSize: 11,
    color: 'rgba(255,255,255,0.75)', textAlign: 'center',
  },
  stripLabel: {
    fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.8,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', textAlign: 'center',
  },

  sections: { gap: 8 },

  version: {
    textAlign: 'center', fontSize: 10, letterSpacing: 1,
    marginTop: 16, marginBottom: 8, fontFamily: FONTS.mono,
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

// ── Ticket section styles ──
const tk = StyleSheet.create({
  wrap: { marginBottom: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10, paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.mono,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  newTicket: {
    fontSize: 10, fontFamily: FONTS.sansMedium,
    letterSpacing: 0.4,
  },
  countBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 10, fontFamily: FONTS.monoMedium, letterSpacing: 0.6,
  },
  card: {
    borderRadius: 18, overflow: 'hidden', borderWidth: 1.5,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  info: { flex: 1 },
  title: { fontSize: 13, fontFamily: FONTS.sansMedium, marginBottom: 2 },
  meta: { fontSize: 11, fontFamily: FONTS.sans },
  pillOrange: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  pillGray: {
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  pillText: {
    fontSize: 9, fontFamily: FONTS.sansMedium, fontWeight: '700',
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  viewAll: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 12, borderTopWidth: 1,
  },
  viewAllText: {
    fontSize: 11, fontFamily: FONTS.sansMedium, letterSpacing: 0.4,
  },
  empty: {
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16,
    padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  emptyIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  emptyText: { fontSize: 12, fontFamily: FONTS.sans, lineHeight: 18, flex: 1 },
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
    fontSize: 11, fontFamily: FONTS.mono, letterSpacing: 1.2,
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

const catStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  chipText: { fontSize: 13, fontFamily: FONTS.sansMedium },
  count: {
    fontSize: 11, fontFamily: FONTS.sansMedium, letterSpacing: 0.3,
    marginTop: 12, textAlign: 'center',
  },
});