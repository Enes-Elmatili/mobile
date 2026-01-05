import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/AuthContext';
import { useRouter } from 'expo-router';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

export default function Profile() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['40%', '70%'], []);

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

  const handleSettingsPress = () => {
    bottomSheetRef.current?.expand();
  };

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const settingsOptions = [
    {
      icon: 'person-outline',
      label: 'Modifier le profil',
      onPress: () => {
        bottomSheetRef.current?.close();
        // router.push('/edit-profile');
        Alert.alert('Info', 'Fonctionnalité en développement');
      },
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      onPress: () => {
        bottomSheetRef.current?.close();
        Alert.alert('Info', 'Fonctionnalité en développement');
      },
    },
    {
      icon: 'lock-closed-outline',
      label: 'Confidentialité',
      onPress: () => {
        bottomSheetRef.current?.close();
        Alert.alert('Info', 'Fonctionnalité en développement');
      },
    },
    {
      icon: 'help-circle-outline',
      label: 'Aide et support',
      onPress: () => {
        bottomSheetRef.current?.close();
        Alert.alert('Info', 'Fonctionnalité en développement');
      },
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profil</Text>
        <TouchableOpacity onPress={handleSettingsPress}>
          <Ionicons name="settings-outline" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={48} color="#9CA3AF" />
        </View>
        <Text style={styles.name}>{user?.email}</Text>
        <Text style={styles.roles}>{user?.roles?.join(' • ') || 'Client'}</Text>
      </View>

      <TouchableOpacity style={styles.logout} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#DC2626" />
        <Text style={styles.logoutText}>Déconnexion</Text>
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <Text style={styles.sheetTitle}>Paramètres</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {settingsOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.settingItem}
                onPress={option.onPress}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name={option.icon as any} size={24} color="#111827" />
                  <Text style={styles.settingLabel}>{option.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  card: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  roles: { fontSize: 16, color: '#6B7280' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 20,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: { color: '#DC2626', fontSize: 16, fontWeight: '600', marginLeft: 12 },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 16,
    fontWeight: '500',
  },
});
