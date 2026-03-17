// app/request/[id]/scheduled.tsx — Confirmation requête planifiée
// Le client voit un récapitulatif après paiement d'une requête future

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  Animated, Easing, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import * as Haptics from 'expo-haptics';

export default function ScheduledConfirmation() {
  const { id, serviceName, address, price, scheduledLabel } = useLocalSearchParams<{
    id: string; serviceName: string; address: string; price: string; scheduledLabel: string;
  }>();
  const router = useRouter();
  const theme  = useAppTheme();

  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={[st.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      <View style={st.center}>
        {/* Animated check icon */}
        <Animated.View style={[st.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[st.iconCircle, { backgroundColor: theme.surface }]}>
            <Ionicons name="calendar-outline" size={48} color={theme.text} />
          </View>
        </Animated.View>

        <Animated.View style={[st.content, { opacity: fadeAnim }]}>
          <Text style={[st.title, { color: theme.text, fontFamily: FONTS.bebas }]}>Demande planifiée</Text>
          <Text style={[st.subtitle, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            Votre demande a bien été enregistrée. Les prestataires qualifiés pourront la consulter et l'accepter.
          </Text>

          {/* Recap card */}
          <View style={[st.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={st.row}>
              <Ionicons name="construct-outline" size={16} color={theme.textSub} />
              <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{serviceName}</Text>
            </View>
            <View style={[st.sep, { backgroundColor: theme.border }]} />
            <View style={st.row}>
              <Ionicons name="calendar-outline" size={16} color={theme.textSub} />
              <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{scheduledLabel}</Text>
            </View>
            <View style={[st.sep, { backgroundColor: theme.border }]} />
            <View style={st.row}>
              <Ionicons name="location-outline" size={16} color={theme.textSub} />
              <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.sans }]} numberOfLines={1}>{address}</Text>
            </View>
            {price && (
              <>
                <View style={[st.sep, { backgroundColor: theme.border }]} />
                <View style={st.row}>
                  <Ionicons name="card-outline" size={16} color={theme.textSub} />
                  <Text style={[st.rowText, { color: theme.text, fontFamily: FONTS.monoMedium }]}>{price} €</Text>
                </View>
              </>
            )}
          </View>

          <View style={[st.infoBadge, { backgroundColor: theme.surface }]}>
            <Ionicons name="information-circle-outline" size={16} color={theme.textSub} />
            <Text style={[st.infoText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
              Vous recevrez une notification dès qu'un prestataire accepte votre demande.
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom CTA */}
      <View style={st.bottom}>
        <TouchableOpacity
          style={[st.btn, { backgroundColor: theme.accent }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace('/(tabs)/dashboard');
          }}
          activeOpacity={0.85}
        >
          <Text style={[st.btnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Retour à l'accueil</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[st.btnSecondary, { borderColor: theme.border }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace({ pathname: '/request/[id]/tracking', params: { id } });
          }}
          activeOpacity={0.85}
        >
          <Text style={[st.btnSecondaryText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>Suivre la demande</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },

  iconWrap:   { marginBottom: 24 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },

  content:  { alignItems: 'center', width: '100%' },
  title:    { fontSize: 28, marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 },

  card:     { width: '100%', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rowText:  { fontSize: 15, flex: 1 },
  sep:      { height: 1, marginVertical: 8 },

  infoBadge:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14, borderRadius: 12, width: '100%' },
  infoText:   { fontSize: 13, lineHeight: 18, flex: 1 },

  bottom:          { paddingHorizontal: 20, paddingBottom: 36, gap: 10 },
  btn:             { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText:         { fontSize: 16 },
  btnSecondary:    { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5 },
  btnSecondaryText:{ fontSize: 15 },
});
