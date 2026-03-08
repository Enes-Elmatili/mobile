// app/onboarding/quiz.tsx — Quiz métier par catégorie (thème sombre unifié)
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { api } from '../../lib/api';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { PROVIDER_FLOW } from '../../constants/onboardingFlows';

function toSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

// ─── Fallback quiz questions (si l'API n'en retourne pas) ───────────────────
const FALLBACK_QUIZ: Record<string, { q: string; options: string[] }[]> = {
  'bricolage': [
    { q: 'Quelle est la section minimale d\'un câble pour une prise 16A ?', options: ['1.5 mm²', '2.5 mm²', '4 mm²', '6 mm²'] },
    { q: 'Comment sécuriser un perçage près d\'une canalisation ?', options: ['Percer rapidement', 'Utiliser un détecteur de canalisations', 'Ignorer', 'Percer en diagonale'] },
    { q: 'Quel outil utiliser pour couper une plinthe en onglet ?', options: ['Scie égoïne', 'Scie sauteuse', 'Onglet + scie à onglets', 'Cutter'] },
  ],
  'menage': [
    { q: 'Quel produit NE PAS utiliser sur du marbre ?', options: ['Eau savonneuse', 'Vinaigre blanc', 'Savon pH neutre', 'Chiffon microfibre'] },
    { q: 'Fréquence recommandée pour nettoyer un réfrigérateur ?', options: ['Chaque jour', 'Chaque semaine', 'Chaque mois', 'Chaque trimestre'] },
  ],
  'urgences-techniques': [
    { q: 'Première action en cas de fuite d\'eau importante ?', options: ['Appeler le client', 'Couper l\'arrivée d\'eau principale', 'Prendre des photos', 'Attendre'] },
    { q: 'Que vérifier avant toute intervention électrique ?', options: ['La météo', 'Couper le disjoncteur + vérifier l\'absence de tension', 'L\'outillage', 'Le planning'] },
    { q: 'Quelle norme régit les installations électriques en Belgique ?', options: ['NFC 15-100', 'RGIE / AREI', 'EN 60439', 'IEC 61439'] },
  ],
};

interface QuizEntry {
  slug: string;
  label: string;
  passMark: number;
  questions: { q: string; options: string[] }[];
}

interface QuizResult {
  passed: boolean;
  score: number;
  total: number;
  passMark: number;
}

type Phase = 'loading' | 'questions' | 'result';

export default function OnboardingQuiz() {
  const router = useRouter();

  const [quizzes, setQuizzes]       = useState<QuizEntry[]>([]);
  const [phase, setPhase]           = useState<Phase>('loading');
  const [quizIndex, setQuizIndex]   = useState(0);
  const [selected, setSelected]     = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<QuizResult | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem('onboarding_data');
      const data = raw ? JSON.parse(raw) : {};
      const categories: { id: number; name: string }[] = data.categories ?? [];

      if (categories.length === 0) {
        router.replace('/onboarding/stripe');
        return;
      }

      const loaded: QuizEntry[] = [];
      await Promise.allSettled(
        categories.map(async (cat) => {
          const slug = toSlug(cat.name);
          try {
            const res: any = await api.providerQuiz.getQuestions(slug);
            const questions: { q: string; options: string[] }[] = res?.questions ?? [];
            const passMark: number = res?.passMark ?? 1;
            if (questions.length > 0) {
              loaded.push({ slug, label: cat.name, passMark, questions });
            }
          } catch {
            // Fallback : utiliser les questions locales
            const fallback = FALLBACK_QUIZ[slug];
            if (fallback) {
              loaded.push({ slug, label: cat.name, passMark: Math.ceil(fallback.length * 0.6), questions: fallback });
            }
          }
        })
      );

      if (loaded.length === 0) {
        router.replace('/onboarding/stripe');
        return;
      }

      setQuizzes(loaded);
      setSelected(new Array(loaded[0].questions.length).fill(null));
      setPhase('questions');
    })();
  }, []);

  const currentQuiz = quizzes[quizIndex] ?? null;
  const allAnswered = selected.length > 0 && selected.every(v => v !== null);
  const totalQuizzes = quizzes.length;

  const fadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 250, useNativeDriver: true,
    }).start();
  };

  const fadeOut = (cb: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 180, useNativeDriver: true,
    }).start(cb);
  };

  const handleSubmit = async () => {
    if (!currentQuiz || !allAnswered) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      const answers = selected as number[];
      const res: any = await api.providerQuiz.submit(currentQuiz.slug, answers);
      setResult({
        passed:   res.passed   ?? false,
        score:    res.score    ?? 0,
        total:    res.total    ?? currentQuiz.questions.length,
        passMark: res.passMark ?? currentQuiz.passMark,
      });
      Haptics.notificationAsync(res.passed
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
      );
      fadeOut(() => { setPhase('result'); fadeIn(); });
    } catch {
      setResult({ passed: false, score: 0, total: currentQuiz.questions.length, passMark: currentQuiz.passMark });
      fadeOut(() => { setPhase('result'); fadeIn(); });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    fadeOut(() => {
      setResult(null);
      setSelected(new Array(currentQuiz!.questions.length).fill(null));
      setPhase('questions');
      fadeIn();
    });
  };

  const advanceOrFinish = () => {
    const next = quizIndex + 1;
    if (next < totalQuizzes) {
      fadeOut(() => {
        setQuizIndex(next);
        setSelected(new Array(quizzes[next].questions.length).fill(null));
        setResult(null);
        setPhase('questions');
        fadeIn();
      });
    } else {
      router.replace('/onboarding/stripe');
    }
  };

  // ─── Loading ───
  if (phase === 'loading') {
    return (
      <OnboardingLayout
        currentStep={PROVIDER_FLOW.steps.QUIZ}
        totalSteps={PROVIDER_FLOW.totalSteps}
        title="Quiz métier."
        subtitle="Chargement du quiz…"
      >
        <View style={s.centered}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.4)" />
        </View>
      </OnboardingLayout>
    );
  }

  // ─── Result ───
  if (phase === 'result' && result && currentQuiz) {
    return (
      <OnboardingLayout
        currentStep={PROVIDER_FLOW.steps.QUIZ}
        totalSteps={PROVIDER_FLOW.totalSteps}
        showBack={false}
        title={result.passed ? 'Quiz réussi !' : 'Quiz échoué'}
        subtitle={result.passed
          ? (totalQuizzes > 1 && quizIndex + 1 < totalQuizzes
              ? `Passez au quiz suivant : ${quizzes[quizIndex + 1].label}.`
              : 'Excellent ! Finalisez votre inscription en configurant votre compte Stripe.')
          : `Il vous fallait ${result.passMark} bonne${result.passMark > 1 ? 's' : ''} réponse${result.passMark > 1 ? 's' : ''} pour valider.`
        }
        cta={{
          label: result.passed
            ? (totalQuizzes > 1 && quizIndex + 1 < totalQuizzes ? 'Quiz suivant' : 'Continuer')
            : 'Réessayer',
          onPress: result.passed ? advanceOrFinish : handleRetry,
        }}
        secondaryCta={!result.passed ? { label: 'Passer quand même', onPress: advanceOrFinish } : undefined}
      >
        <Animated.View style={[s.resultWrap, { opacity: fadeAnim }]}>
          <View style={[s.resultIcon, result.passed ? s.resultIconPass : s.resultIconFail]}>
            <Ionicons
              name={result.passed ? 'checkmark' : 'close'}
              size={40}
              color={result.passed ? '#22C55E' : '#FF453A'}
            />
          </View>

          <View style={s.scorePill}>
            <Text style={s.scoreText}>
              {result.score} / {result.total} bonne{result.score > 1 ? 's' : ''} réponse{result.score > 1 ? 's' : ''}
            </Text>
          </View>

          <View style={s.categoryPill}>
            <Text style={s.categoryPillText}>{currentQuiz.label}</Text>
          </View>
        </Animated.View>
      </OnboardingLayout>
    );
  }

  // ─── Questions ───
  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.QUIZ}
      totalSteps={PROVIDER_FLOW.totalSteps}
      title="Quiz métier."
      subtitle={currentQuiz
        ? `${currentQuiz.label} — ${currentQuiz.questions.length} question${currentQuiz.questions.length > 1 ? 's' : ''}. Note minimale : ${currentQuiz.passMark} / ${currentQuiz.questions.length}.${totalQuizzes > 1 ? `  ·  Quiz ${quizIndex + 1} / ${totalQuizzes}` : ''}`
        : undefined
      }
      cta={{
        label: submitting ? 'Chargement…' : 'Soumettre',
        onPress: handleSubmit,
        disabled: !allAnswered || submitting,
        loading: submitting,
      }}
      secondaryCta={{ label: 'Passer cette étape', onPress: advanceOrFinish }}
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Quiz counter */}
        {totalQuizzes > 1 && (
          <View style={s.quizMeta}>
            <View style={s.quizCounter}>
              <Text style={s.quizCounterText}>Quiz {quizIndex + 1} / {totalQuizzes}</Text>
            </View>
            <View style={s.categoryPill}>
              <Text style={s.categoryPillText}>{currentQuiz?.label}</Text>
            </View>
          </View>
        )}

        {/* Questions */}
        {currentQuiz?.questions.map((q, qi) => (
          <View key={qi} style={s.quizQ}>
            <Text style={s.quizQNum}>Question {qi + 1}</Text>
            <Text style={s.quizQText}>{q.q}</Text>
            {q.options.map((opt, oi) => {
              const isSel = selected[qi] === oi;
              return (
                <Pressable
                  key={oi}
                  style={[s.quizOpt, isSel && s.quizOptSel]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelected(prev => prev.map((a, i) => i === qi ? oi : a));
                  }}
                >
                  <View style={[s.quizRadio, isSel && s.quizRadioSel]}>
                    {isSel && <View style={s.quizRadioDot} />}
                  </View>
                  <Text style={[s.quizOptText, isSel && s.quizOptTextSel]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* Answered counter */}
        <Text style={s.answeredText}>
          {selected.filter(v => v !== null).length} / {currentQuiz?.questions.length ?? 0} répondue(s)
        </Text>
      </Animated.View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: 40 },

  // Quiz meta
  quizMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  quizCounter: {
    backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  quizCounterText: { fontSize: 11, fontWeight: '700', color: '#000' },
  categoryPill: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  categoryPillText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },

  // Questions
  quizQ: { marginBottom: 24 },
  quizQNum: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.3)',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  quizQText: { fontSize: 15, fontWeight: '600', color: '#FFF', marginBottom: 12, lineHeight: 22 },
  quizOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  quizOptSel: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.25)' },
  quizRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  quizRadioSel: { borderColor: '#FFF' },
  quizRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF' },
  quizOptText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', flex: 1 },
  quizOptTextSel: { color: '#FFF', fontWeight: '600' },

  answeredText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: 8 },

  // Result
  resultWrap: { alignItems: 'center', paddingVertical: 24, gap: 16 },
  resultIcon: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  resultIconPass: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  resultIconFail: {
    backgroundColor: 'rgba(255,69,58,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.3)',
  },
  scorePill: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  scoreText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
