// app/support.tsx — QCM Support Client
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthContext';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import MissionSelector from '@/components/support/MissionSelector';
import ProblemSelector, { type ProblemOption } from '@/components/support/ProblemSelector';
import ResolutionView from '@/components/support/ResolutionView';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Mission {
  id: number;
  serviceType: string;
  status: string;
  price: number | null;
  createdAt: string;
  address: string;
}

type Level = 1 | 2 | 3;

// ─── Animated wrapper for level transitions ──────────────────────────────────

function FadeSlide({ children, key: animKey }: { children: React.ReactNode; key: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateX.setValue(24);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [animKey]);

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateX }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

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

  // Load recent missions
  useEffect(() => {
    (async () => {
      try {
        const res = await api.requests.list();
        const all = (res.data || res || []) as Mission[];
        // Take 3 most recent
        const recent = all
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 3);
        setMissions(recent);

        // If missionId passed as param, auto-select it
        if (params.missionId) {
          const match = recent.find(m => m.id === Number(params.missionId));
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
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleMissionSelect = (mission: Mission) => {
    setSelectedMission(mission);
    setMissionStatus(mission.status);
    setLevel(2);
  };

  const handleOther = () => {
    setSelectedMission(null);
    setMissionStatus(null);
    setLevel(2);
  };

  const handleProblemSelect = (problem: ProblemOption) => {
    setSelectedProblem(problem);
    setLevel(3);
  };

  const handleBackToMissions = () => {
    setSelectedMission(null);
    setMissionStatus(null);
    setLevel(1);
  };

  const handleBackToProblems = () => {
    setSelectedProblem(null);
    setLevel(2);
  };

  const handleDone = () => {
    router.back();
  };

  // ─── Level labels for progress ───────────────────────────────────────────────

  const levelLabels = ['Mission', 'Problème', 'Résolution'];

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.bg }]}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text, fontFamily: FONTS.bebas }]}>Support</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Progress dots */}
      <View style={s.progressRow}>
        {levelLabels.map((label, i) => {
          const step = i + 1;
          const isDone = step < level;
          const isActive = step === level;
          return (
            <React.Fragment key={step}>
              {i > 0 && <View style={[s.progressLine, { backgroundColor: isDone ? theme.accent : theme.border }]} />}
              <View style={s.progressItem}>
                <View style={[
                  s.progressDot,
                  { backgroundColor: theme.surface },
                  isDone && { backgroundColor: theme.accent },
                  isActive && { backgroundColor: theme.accent },
                ]}>
                  {isDone ? (
                    <Ionicons name="checkmark" size={10} color={theme.accentText} />
                  ) : (
                    <Text style={[s.progressDotText, {
                      fontFamily: FONTS.sansMedium,
                      color: isActive ? theme.accentText : theme.textMuted,
                    }]}>{step}</Text>
                  )}
                </View>
                <Text style={[s.progressLabel, {
                  fontFamily: FONTS.sans,
                  color: isActive ? theme.text : theme.textMuted,
                }]}>{label}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      {/* Content */}
      <View style={s.content}>
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
              onBack={handleBackToMissions}
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
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, letterSpacing: 1 },

  // Progress indicator
  progressRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20, paddingHorizontal: 32,
  },
  progressLine: { width: 40, height: 2, marginHorizontal: 6 },
  progressItem: { alignItems: 'center', gap: 6 },
  progressDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  progressDotText: { fontSize: 12 },
  progressLabel: { fontSize: 11, letterSpacing: 0.3 },

  // Content area
  content: {
    flex: 1, paddingHorizontal: 16, paddingTop: 12,
  },
});
