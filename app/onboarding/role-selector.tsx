import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOnboardingStore } from '../../stores/onboardingStore';

const ROLES = [
  {
    id: 'CLIENT' as const,
    label: 'Client',
    sub: "J'ai besoin d'un professionnel",
    icon: 'home-outline' as const,
    perks: ['Demande en 60 secondes', 'Prestataire en 30 min', 'Paiement sécurisé'],
  },
  {
    id: 'PROVIDER' as const,
    label: 'Prestataire',
    sub: 'Je cherche des missions',
    icon: 'construct-outline' as const,
    perks: ['Missions près de chez vous', 'Paiements directs', 'Badge de confiance'],
  },
];

export default function RoleSelector() {
  const [selected, setSelected] = useState<string | null>(null);
  const setRole = useOnboardingStore((s) => s.setRole);

  function handleContinue() {
    if (!selected) return;
    setRole(selected as 'CLIENT' | 'PROVIDER');

    if (selected === 'CLIENT') {
      router.push('/onboarding/client/register');
    } else {
      router.push('/onboarding/provider/signup-id');
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.logo}>FIXED</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Vous êtes…</Text>
        <Text style={styles.subtitle}>Choisissez votre profil.</Text>

        <View style={styles.cards}>
          {ROLES.map((role) => {
            const isSelected = selected === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                style={[styles.card, isSelected && styles.cardActive]}
                onPress={() => setSelected(role.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={role.label}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.iconBox, isSelected && styles.iconBoxActive]}>
                    <Ionicons
                      name={role.icon}
                      size={22}
                      color={isSelected ? '#fff' : 'rgba(255,255,255,0.6)'}
                    />
                  </View>
                  <View style={styles.cardTitleBlock}>
                    <Text style={[styles.cardTitle, isSelected && styles.cardTitleActive]}>
                      {role.label}
                    </Text>
                    <Text style={[styles.cardSub, isSelected && styles.cardSubActive]}>
                      {role.sub}
                    </Text>
                  </View>
                  <View style={[styles.check, isSelected && styles.checkActive]}>
                    {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                </View>

                <View style={styles.perks}>
                  {role.perks.map((p) => (
                    <View key={p} style={styles.perkRow}>
                      <View style={[styles.dot, isSelected && styles.dotActive]} />
                      <Text style={[styles.perkText, isSelected && styles.perkTextActive]}>{p}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, !selected && styles.ctaOff]}
          onPress={handleContinue}
          disabled={!selected}
          accessibilityRole="button"
        >
          <Text style={[styles.ctaText, !selected && styles.ctaTextOff]}>Continuer</Text>
          {selected && <Ionicons name="arrow-forward" size={16} color="#000" />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginText}>
            Déjà un compte ? <Text style={styles.loginLink}>Se connecter</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  logo: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -1, marginBottom: 6 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.4)', marginBottom: 28 },
  cards: { gap: 12 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20, padding: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  cardActive: { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'transparent' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  iconBoxActive: { backgroundColor: '#0a0a0a' },
  cardTitleBlock: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  cardTitleActive: { color: '#0a0a0a' },
  cardSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  cardSubActive: { color: 'rgba(0,0,0,0.45)' },
  check: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkActive: { backgroundColor: '#0a0a0a', borderColor: '#0a0a0a' },
  perks: { gap: 6 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: 'rgba(0,0,0,0.25)' },
  perkText: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  perkTextActive: { color: 'rgba(0,0,0,0.55)' },
  footer: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  cta: {
    backgroundColor: '#fff', borderRadius: 16, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ctaOff: { backgroundColor: 'rgba(255,255,255,0.08)' },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#000' },
  ctaTextOff: { color: 'rgba(255,255,255,0.2)' },
  loginText: { textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.3)' },
  loginLink: { color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});
