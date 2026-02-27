// app/(tabs)/profile.tsx — Provider Profile Hub
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/AuthContext';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

// ============================================================================
// AVATAR WITH INITIALS + CAMERA BADGE
// ============================================================================

function ProviderAvatar({ name, size = 80 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const palette = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
  const bg = palette[name.charCodeAt(0) % palette.length];

  return (
    <View style={[av.wrapper, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[av.circle, { backgroundColor: bg, borderRadius: size / 2 }]}>
        <Text style={[av.initials, { fontSize: size * 0.34 }]}>{initials}</Text>
      </View>
      <TouchableOpacity
        style={av.badge}
        activeOpacity={0.8}
        onPress={() => Alert.alert('Info', 'Modification de photo en développement')}
      >
        <Ionicons name="camera" size={11} color="#FFF" />
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
    backgroundColor: '#172247',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#FFF',
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
  return (
    <View style={sb.wrap}>
      <View style={[sb.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={16} color={iconColor} />
      </View>
      <Text style={sb.value}>{value}</Text>
      <Text style={sb.label}>{label}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 4 },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  value: { fontSize: 16, fontWeight: '800', color: '#111' },
  label: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', textAlign: 'center' },
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
  return (
    <View style={ms.wrap}>
      {!!title && <Text style={ms.title}>{title}</Text>}
      <View style={ms.card}>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            <TouchableOpacity style={ms.row} onPress={item.onPress} activeOpacity={0.7}>
              <View style={[ms.iconBox, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon as any} size={18} color={item.iconColor} />
              </View>
              <View style={ms.content}>
                <Text style={[ms.label, item.danger && ms.labelDanger]}>{item.label}</Text>
                {item.sublabel ? <Text style={ms.sublabel}>{item.sublabel}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={item.danger ? '#FCA5A5' : '#D1D5DB'} />
            </TouchableOpacity>
            {i < items.length - 1 && <View style={ms.divider} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  wrap: { marginBottom: 8 },
  title: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#FFF', borderRadius: 18, overflow: 'hidden',
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
  label: { fontSize: 15, fontWeight: '600', color: '#111' },
  labelDanger: { color: '#DC2626' },
  sublabel: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  divider: { height: 1, backgroundColor: '#F9FAFB', marginLeft: 64 },
});

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function Profile() {
  const { user, signOut, refreshMe } = useAuth();
  const router = useRouter();

  const bottomSheetRef = useRef<BottomSheet>(null);
  const editSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['40%', '70%'], []);
  const editSnapPoints = useMemo(() => ['65%'], []);

  const displayName = (user as any)?.name || user?.email?.split('@')[0] || 'Prestataire';
  const email = user?.email || '';
  const roles = user?.roles?.join(' · ') || 'Prestataire';

  // ── Real stats from API ──
  const [stats, setStats] = useState({ rating: '—', missions: '—', earnings: '—', acceptance: '—' });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const isProvider = user.roles?.includes('PROVIDER');
    const fetchStats = isProvider ? api.dashboard.provider : api.dashboard.client;

    fetchStats()
      .then((res: any) => {
        const d = res.data || res;
        setStats({
          rating: d.avgRating != null ? Number(d.avgRating).toFixed(1).replace('.', ',') : '—',
          missions: String(d.totalMissions ?? d.totalRequests ?? '—'),
          earnings: d.totalEarnings != null
            ? Number(d.totalEarnings).toLocaleString('fr-FR') + ' €'
            : '—',
          acceptance: d.acceptanceRate != null ? d.acceptanceRate + '%' : '—',
        });
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [user]);

  // ── Profile edit state ──
  const [editName, setEditName] = useState(displayName);
  const [editPhone, setEditPhone] = useState((user as any)?.phone || '');
  const [saving, setSaving] = useState(false);

  const wip = (label: string) => () =>
    Alert.alert(label, 'Fonctionnalité en développement');

  const handleOpenEditProfile = () => {
    setEditName(displayName);
    setEditPhone((user as any)?.phone || '');
    editSheetRef.current?.expand();
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    if (!editName.trim()) {
      Alert.alert('Erreur', 'Le nom ne peut pas être vide');
      return;
    }

    try {
      setSaving(true);
      await api.user.update(user.id, {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
      });
      await refreshMe();
      editSheetRef.current?.close();
      Alert.alert('Profil mis à jour', 'Vos informations ont été enregistrées.');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le profil');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
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

  const accountItems: MenuItem[] = [
    {
      icon: 'person-outline', iconColor: '#3B82F6', iconBg: '#EFF6FF',
      label: 'Informations personnelles', sublabel: 'Nom, téléphone, adresse',
      onPress: handleOpenEditProfile,
    },
    {
      icon: 'card-outline', iconColor: '#8B5CF6', iconBg: '#EDE9FE',
      label: 'Coordonnées bancaires', sublabel: 'IBAN pour recevoir vos gains',
      onPress: wip('Coordonnées bancaires'),
    },
    {
      icon: 'shield-checkmark-outline', iconColor: '#059669', iconBg: '#ECFDF5',
      label: 'Documents légaux', sublabel: 'Assurance, immatriculation',
      onPress: wip('Documents légaux'),
    },
  ];

  const prefItems: MenuItem[] = [
    {
      icon: 'notifications-outline', iconColor: '#F59E0B', iconBg: '#FFFBEB',
      label: 'Notifications', sublabel: 'Alertes missions, rappels',
      onPress: wip('Notifications'),
    },
    {
      icon: 'lock-closed-outline', iconColor: '#6B7280', iconBg: '#F3F4F6',
      label: 'Confidentialité',
      onPress: wip('Confidentialité'),
    },
  ];

  const supportItems: MenuItem[] = [
    {
      icon: 'help-circle-outline', iconColor: '#3B82F6', iconBg: '#EFF6FF',
      label: 'Aide et support',
      onPress: wip('Aide et support'),
    },
    {
      icon: 'chatbubble-ellipses-outline', iconColor: '#10B981', iconBg: '#ECFDF5',
      label: 'Nous contacter',
      onPress: wip('Nous contacter'),
    },
    {
      icon: 'document-text-outline', iconColor: '#9CA3AF', iconBg: '#F3F4F6',
      label: 'Conditions générales',
      onPress: wip('CGU'),
    },
  ];

  const dangerItems: MenuItem[] = [
    {
      icon: 'log-out-outline', iconColor: '#DC2626', iconBg: '#FEF2F2',
      label: 'Déconnexion',
      danger: true,
      onPress: handleLogout,
    },
  ];

  const sheetItems = [
    { icon: 'person-outline', iconColor: '#3B82F6', iconBg: '#EFF6FF', label: 'Modifier le profil', onPress: handleOpenEditProfile },
    { icon: 'notifications-outline', iconColor: '#F59E0B', iconBg: '#FFFBEB', label: 'Notifications', onPress: wip('Notifications') },
    { icon: 'lock-closed-outline', iconColor: '#6B7280', iconBg: '#F3F4F6', label: 'Confidentialité', onPress: wip('Confidentialité') },
    { icon: 'help-circle-outline', iconColor: '#3B82F6', iconBg: '#EFF6FF', label: 'Aide et support', onPress: wip('Aide et support') },
  ];

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Profil</Text>
        <TouchableOpacity
          style={s.settingsBtn}
          onPress={() => bottomSheetRef.current?.expand()}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={20} color="#172247" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Identity Card */}
        <View style={s.identityCard}>
          <ProviderAvatar name={displayName} size={82} />
          <View style={s.identityInfo}>
            <Text style={s.identityName}>{displayName}</Text>
            <Text style={s.identityEmail}>{email}</Text>
            <View style={s.rolesPill}>
              <Ionicons name="briefcase-outline" size={11} color="#172247" />
              <Text style={s.rolesText}>{roles}</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={s.statsCard}>
          {statsLoading ? (
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
              <ActivityIndicator size="small" color="#172247" />
            </View>
          ) : (
            <>
              <StatBadge icon="star" iconColor="#F59E0B" iconBg="#FFFBEB" value={stats.rating} label="Note" />
              <View style={s.statsDivider} />
              <StatBadge icon="checkmark-circle-outline" iconColor="#059669" iconBg="#ECFDF5" value={stats.missions} label="Missions" />
              <View style={s.statsDivider} />
              <StatBadge icon="cash-outline" iconColor="#8B5CF6" iconBg="#EDE9FE" value={stats.earnings} label="Ce mois" />
              <View style={s.statsDivider} />
              <StatBadge icon="trending-up-outline" iconColor="#3B82F6" iconBg="#EFF6FF" value={stats.acceptance} label="Taux accept." />
            </>
          )}
        </View>

        {/* Menus */}
        <View style={s.sections}>
          <MenuSection title="Mon compte" items={accountItems} />
          <MenuSection title="Préférences" items={prefItems} />
          <MenuSection title="Support" items={supportItems} />
          <MenuSection items={dangerItems} />
        </View>

        <Text style={s.version}>Version 1.0.0</Text>
      </ScrollView>

      {/* Settings Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={s.sheetContent}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Paramètres</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {sheetItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={s.sheetRow}
                activeOpacity={0.7}
                onPress={() => {
                  bottomSheetRef.current?.close();
                  item.onPress();
                }}
              >
                <View style={[s.sheetIcon, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.iconColor} />
                </View>
                <Text style={s.sheetLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </BottomSheetView>
      </BottomSheet>

      {/* Profile Edit Bottom Sheet */}
      <BottomSheet
        ref={editSheetRef}
        index={-1}
        snapPoints={editSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={s.sheetContent}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Informations personnelles</Text>

          <Text style={s.editLabel}>Nom complet</Text>
          <TextInput
            style={s.editInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="Votre nom"
            placeholderTextColor="#ADADAD"
            autoCapitalize="words"
          />

          <Text style={s.editLabel}>Téléphone</Text>
          <TextInput
            style={s.editInput}
            value={editPhone}
            onChangeText={setEditPhone}
            placeholder="+32 470 00 00 00"
            placeholderTextColor="#ADADAD"
            keyboardType="phone-pad"
          />

          <Text style={s.editLabel}>Email</Text>
          <TextInput
            style={[s.editInput, { color: '#9CA3AF' }]}
            value={email}
            editable={false}
          />

          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSaveProfile}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={s.saveBtnText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#111' },
  settingsBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },

  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },

  identityCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 20,
    padding: 20, gap: 16, marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  identityInfo: { flex: 1, gap: 3 },
  identityName: { fontSize: 20, fontWeight: '800', color: '#111' },
  identityEmail: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  rolesPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EEF2FF', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    alignSelf: 'flex-start', marginTop: 4,
  },
  rolesText: { fontSize: 11, fontWeight: '700', color: '#172247' },

  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 20,
    paddingVertical: 16, paddingHorizontal: 12,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  statsDivider: { width: 1, height: 40, backgroundColor: '#F3F4F6' },

  sections: { gap: 16 },

  version: {
    textAlign: 'center', fontSize: 12, color: '#D1D5DB',
    marginTop: 24, fontWeight: '500',
  },

  sheetContent: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 16 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  sheetIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111' },

  // Profile edit sheet
  editLabel: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 6, marginTop: 12,
  },
  editInput: {
    backgroundColor: '#F8F9FB', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#111',
    borderWidth: 1.5, borderColor: '#F3F4F6',
  },
  saveBtn: {
    backgroundColor: '#172247', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
