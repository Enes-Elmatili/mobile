// app/support.tsx — Centre d'aide client
// Flow 3 niveaux : sélection mission → catégorisation problème → résolution.
// La mission sélectionnée reste visible en haut dès le level 2 pour que le client
// garde le contexte (et puisse changer sans repartir au début).

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Animated, Easing, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth/AuthContext';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import MissionSelector from '@/components/support/MissionSelector';
import ProblemSelector, { type ProblemOption } from '@/components/support/ProblemSelector';
import ResolutionView from '@/components/support/ResolutionView';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Mission {
  id: number;
  serviceType: string;
  status: string;
  price: number | null;
  createdAt: string;
  address: string;
}

type Level = 1 | 2 | 3;

const LEVEL_META: Record<Level, { label: string; subtitle: string }> = {
  1: { label: 'Mission', subtitle: 'Sélectionnez la mission concernée' },
  2: { label: 'Problème', subtitle: 'Décrivez ce qu\'il se passe' },
  3: { label: 'Résolution', subtitle: 'Voici comment nous allons vous aider' },
};

// ─── Wrappers d'animation ────────────────────────────────────────────────────

function FadeSlide({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Stepper professionnel avec animation ────────────────────────────────────

function Stepper({ level, theme }: { level: Level; theme: ReturnType<typeof useAppTheme> }) {
  const steps: Level[] = [1, 2, 3];
  const progressAnim = useRef(new Animated.Value(level - 1)).current;

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: level - 1,
      useNativeDriver: false,
      damping: 18,
      stiffness: 140,
      mass: 0.6,
    }).start();
  }, [level]);

  return (
    <View style={stepStyles.row}>
      {steps.map((s, idx) => {
        const isDone = s < level;
        const isActive = s === level;
        const meta = LEVEL_META[s];
        return (
          <React.Fragment key={s}>
            {idx > 0 && (
              <View style={[stepStyles.line, { backgroundColor: theme.borderLight }]}>
                <Animated.View
                  style={[
                    stepStyles.lineFill,
                    {
                      backgroundColor: theme.text,
                      opacity: progressAnim.interpolate({
                        inputRange: [idx - 1, idx],
                        outputRange: [0, 1],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
              </View>
            )}
            <View style={stepStyles.item}>
              <View
                style={[
                  stepStyles.dot,
                  {
                    backgroundColor: isDone || isActive ? theme.text : theme.surface,
                    borderColor: isActive ? theme.text : theme.borderLight,
                  },
                ]}
              >
                {isDone ? (
                  <Feather name="check" size={12} color={theme.bg} />
                ) : (
                  <Text
                    style={[
                      stepStyles.dotText,
                      { color: isActive ? theme.bg : theme.textMuted, fontFamily: FONTS.sansMedium },
                    ]}
                  >
                    {s}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  stepStyles.label,
                  {
                    color: isActive ? theme.text : isDone ? theme.textSub : theme.textMuted,
                    fontFamily: isActive ? FONTS.sansMedium : FONTS.sans,
                  },
                ]}
              >
                {meta.label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 18 },
  item: { alignItems: 'center', gap: 7, minWidth: 64 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  dotText: { fontSize: 11 },
  label: { fontSize: 11, letterSpacing: 0.3 },
  line: { flex: 1, height: 2, marginHorizontal: 8, borderRadius: 1, overflow: 'hidden' },
  lineFill: { height: '100%', width: '100%' },
});

// ─── Mini-card mission (contexte persistant levels 2-3) ──────────────────────

function MissionContextCard({ mission, onChange, theme }: {
  mission: Mission | null;
  onChange: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  if (!mission) {
    return (
      <View style={[ctxStyles.card, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
        <View style={[ctxStyles.iconWrap, { backgroundColor: theme.cardBg }]}>
          <Feather name="help-circle" size={16} color={theme.textSub} />
        </View>
        <View style={ctxStyles.body}>
          <Text style={[ctxStyles.title, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
            Question générale
          </Text>
          <Text style={[ctxStyles.sub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
            Pas liée à une mission
          </Text>
        </View>
        <TouchableOpacity onPress={onChange} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="edit-2" size={14} color={theme.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }
  const date = new Date(mission.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return (
    <View style={[ctxStyles.card, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
      <View style={[ctxStyles.iconWrap, { backgroundColor: theme.cardBg }]}>
        <Feather name="tool" size={16} color={theme.textSub} />
      </View>
      <View style={ctxStyles.body}>
        <Text style={[ctxStyles.title, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
          {mission.serviceType}
        </Text>
        <Text style={[ctxStyles.sub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
          #{mission.id} · {date}
        </Text>
      </View>
      <TouchableOpacity onPress={onChange} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="edit-2" size={14} color={theme.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const ctxStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, marginBottom: 16,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 14 },
  sub: { fontSize: 12 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SupportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ missionId?: string }>();
  const { user } = useAuth();
  const theme = useAppTheme();

  const [level, setLevel] = useState<Level>(1);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<ProblemOption | null>(null);
  const [missionStatus, setMissionStatus] = useState<string | null>(null);

  // Charge les missions récentes — auto-sélectionne si missionId en deep-link.
  useEffect(() => {
    (async () => {
      try {
        const res = await api.requests.list();
        const all = (res.data || res || []) as Mission[];
        const sorted = all
          .filter(m => !!m && !!m.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMissions(sorted);

        if (params.missionId) {
          const target = Number(params.missionId);
          const match = sorted.find(m => m.id === target);
          if (match) {
            setSelectedMission(match);
            setMissionStatus(match.status);
            setLevel(2);
          }
        }
      } catch (err) {
        devError('[SUPPORT] Failed to load missions:', err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handlers ──
  const handleMissionSelect = useCallback((mission: Mission) => {
    Haptics.selectionAsync();
    setSelectedMission(mission);
    setMissionStatus(mission.status);
    setLevel(2);
  }, []);

  const handleOther = useCallback(() => {
    Haptics.selectionAsync();
    setSelectedMission(null);
    setMissionStatus(null);
    setLevel(2);
  }, []);

  const handleProblemSelect = useCallback((problem: ProblemOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedProblem(problem);
    setLevel(3);
  }, []);

  const handleBackToMissions = useCallback(() => {
    setSelectedMission(null);
    setMissionStatus(null);
    setSelectedProblem(null);
    setLevel(1);
  }, []);

  const handleBackToProblems = useCallback(() => {
    setSelectedProblem(null);
    setLevel(2);
  }, []);

  const handleDone = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/dashboard');
  }, [router]);

  const subtitle = useMemo(() => LEVEL_META[level].subtitle, [level]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.surface }]}
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.kicker, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
            CENTRE D'AIDE
          </Text>
          <Text style={[s.title, { color: theme.text, fontFamily: FONTS.bebas }]}>
            Support
          </Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <Stepper level={level} theme={theme} />

      <Text style={[s.subtitle, { color: theme.textSub, fontFamily: FONTS.sans }]}>
        {subtitle}
      </Text>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Contexte mission persistant à partir du level 2 */}
        {level >= 2 && (
          <MissionContextCard
            mission={selectedMission}
            onChange={handleBackToMissions}
            theme={theme}
          />
        )}

        {level === 1 && (
          <FadeSlide key="level1">
            <MissionSelector
              missions={missions}
              loading={loading}
              onSelect={handleMissionSelect}
              onOther={handleOther}
            />
          </FadeSlide>
        )}

        {level === 2 && (
          <FadeSlide key="level2">
            <ProblemSelector
              missionStatus={missionStatus}
              onSelect={handleProblemSelect}
            />
          </FadeSlide>
        )}

        {level === 3 && selectedProblem && (
          <FadeSlide key="level3">
            <ResolutionView
              problem={selectedProblem}
              mission={selectedMission}
              userName={user?.name || 'Client'}
              userId={user?.id || ''}
              onBack={handleBackToProblems}
              onDone={handleDone}
            />
          </FadeSlide>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center', gap: 1 },
  kicker: { fontSize: 9.5, letterSpacing: 1.6 },
  title: { fontSize: 20, letterSpacing: 1, lineHeight: 22 },
  subtitle: { fontSize: 13, textAlign: 'center', paddingHorizontal: 32, marginBottom: 18 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
});
