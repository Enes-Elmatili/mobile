// app/onboarding/quiz.tsx — Quiz metier (dark design)
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { api } from "../../lib/api";
import { OnboardingLayout } from "../../components/onboarding/OnboardingLayout";
import { PROVIDER_FLOW } from "../../constants/onboardingFlows";
import { FONTS } from "@/hooks/use-app-theme";

const C = {
  white: "#FAFAFA",
  grey: "#888888",
  border: "rgba(255,255,255,0.08)",
  cardBg: "#141414",
  green: "#3D8B3D",
  red: "#E53935",
};

function toSlug(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

const FALLBACK_QUIZ: Record<string, { q: string; options: string[] }[]> = {
  bricolage: [
    { q: "Quelle est la section minimale d'un cable pour une prise 16A ?", options: ["1.5 mm²", "2.5 mm²", "4 mm²", "6 mm²"] },
    { q: "Comment securiser un percage pres d'une canalisation ?", options: ["Percer rapidement", "Utiliser un detecteur de canalisations", "Ignorer", "Percer en diagonale"] },
    { q: "Quel outil utiliser pour couper une plinthe en onglet ?", options: ["Scie egoine", "Scie sauteuse", "Onglet + scie a onglets", "Cutter"] },
  ],
  menage: [
    { q: "Quel produit NE PAS utiliser sur du marbre ?", options: ["Eau savonneuse", "Vinaigre blanc", "Savon pH neutre", "Chiffon microfibre"] },
    { q: "Frequence recommandee pour nettoyer un refrigerateur ?", options: ["Chaque jour", "Chaque semaine", "Chaque mois", "Chaque trimestre"] },
  ],
  "urgences-techniques": [
    { q: "Premiere action en cas de fuite d'eau importante ?", options: ["Appeler le client", "Couper l'arrivee d'eau principale", "Prendre des photos", "Attendre"] },
    { q: "Que verifier avant toute intervention electrique ?", options: ["La meteo", "Couper le disjoncteur + verifier l'absence de tension", "L'outillage", "Le planning"] },
    { q: "Quelle norme regit les installations electriques en Belgique ?", options: ["NFC 15-100", "RGIE / AREI", "EN 60439", "IEC 61439"] },
  ],
};

interface QuizEntry { slug: string; label: string; passMark: number; questions: { q: string; options: string[] }[] }
interface QuizResult { passed: boolean; score: number; total: number; passMark: number }
type Phase = "loading" | "questions" | "result";

export default function OnboardingQuiz() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [quizIndex, setQuizIndex] = useState(0);
  const [selected, setSelected] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("onboarding_data");
      const data = raw ? JSON.parse(raw) : {};
      const categories: { id: number; name: string }[] = data.categories ?? [];
      if (categories.length === 0) { router.replace("/onboarding/stripe"); return; }

      const loaded: QuizEntry[] = [];
      await Promise.allSettled(
        categories.map(async (cat) => {
          const slug = toSlug(cat.name);
          try {
            const res: any = await api.providerQuiz.getQuestions(slug);
            const questions = res?.questions ?? [];
            if (questions.length > 0) loaded.push({ slug, label: cat.name, passMark: res?.passMark ?? 1, questions });
          } catch {
            const fallback = FALLBACK_QUIZ[slug];
            if (fallback) loaded.push({ slug, label: cat.name, passMark: Math.ceil(fallback.length * 0.6), questions: fallback });
          }
        })
      );

      if (loaded.length === 0) { router.replace("/onboarding/stripe"); return; }
      setQuizzes(loaded);
      setSelected(new Array(loaded[0].questions.length).fill(null));
      setPhase("questions");
    })();
  }, []);

  const currentQuiz = quizzes[quizIndex] ?? null;
  const allAnswered = selected.length > 0 && selected.every(v => v !== null);
  const totalQuizzes = quizzes.length;

  const fadeIn = () => Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  const fadeOut = (cb: () => void) => Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(cb);

  const handleSubmit = async () => {
    if (!currentQuiz || !allAnswered) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      const answers = selected as number[];
      const res: any = await api.providerQuiz.submit(currentQuiz.slug, answers);
      setResult({ passed: res.passed ?? false, score: res.score ?? 0, total: res.total ?? currentQuiz.questions.length, passMark: res.passMark ?? currentQuiz.passMark });
      Haptics.notificationAsync(res.passed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      fadeOut(() => { setPhase("result"); fadeIn(); });
    } catch {
      setResult({ passed: false, score: 0, total: currentQuiz.questions.length, passMark: currentQuiz.passMark });
      fadeOut(() => { setPhase("result"); fadeIn(); });
    } finally { setSubmitting(false); }
  };

  const handleRetry = () => {
    fadeOut(() => {
      setResult(null);
      setSelected(new Array(currentQuiz!.questions.length).fill(null));
      setPhase("questions");
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
        setPhase("questions");
        fadeIn();
      });
    } else {
      router.replace("/onboarding/stripe");
    }
  };

  if (phase === "loading") {
    return (
      <OnboardingLayout currentStep={PROVIDER_FLOW.steps.QUIZ} totalSteps={PROVIDER_FLOW.totalSteps} title="Quiz metier." subtitle="Chargement du quiz...">
        <View style={s.centered}><ActivityIndicator size="large" color={C.grey} /></View>
      </OnboardingLayout>
    );
  }

  if (phase === "result" && result && currentQuiz) {
    return (
      <OnboardingLayout
        currentStep={PROVIDER_FLOW.steps.QUIZ}
        totalSteps={PROVIDER_FLOW.totalSteps}
        showBack={false}
        title={result.passed ? "Quiz reussi !" : "Quiz echoue"}
        subtitle={result.passed
          ? (totalQuizzes > 1 && quizIndex + 1 < totalQuizzes
            ? `Passez au quiz suivant : ${quizzes[quizIndex + 1].label}.`
            : "Excellent ! Finalisez votre inscription en configurant votre compte Stripe.")
          : `Il vous fallait ${result.passMark} bonne${result.passMark > 1 ? "s" : ""} reponse${result.passMark > 1 ? "s" : ""} pour valider.`
        }
        cta={{
          label: result.passed
            ? (totalQuizzes > 1 && quizIndex + 1 < totalQuizzes ? "Quiz suivant" : "Continuer")
            : "Reessayer",
          onPress: result.passed ? advanceOrFinish : handleRetry,
        }}
        secondaryCta={!result.passed ? { label: "Passer quand meme", onPress: advanceOrFinish } : undefined}
      >
        <Animated.View style={[s.resultWrap, { opacity: fadeAnim }]}>
          <View style={[s.resultIcon, result.passed ? s.resultIconPass : s.resultIconFail]}>
            <Ionicons name={result.passed ? "checkmark" : "close"} size={40} color={result.passed ? C.green : C.red} />
          </View>
          <View style={s.scorePill}>
            <Text style={s.scoreText}>{result.score} / {result.total} bonne{result.score > 1 ? "s" : ""} reponse{result.score > 1 ? "s" : ""}</Text>
          </View>
          <View style={s.categoryPill}>
            <Text style={s.categoryPillText}>{currentQuiz.label}</Text>
          </View>
        </Animated.View>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.QUIZ}
      totalSteps={PROVIDER_FLOW.totalSteps}
      title="Quiz metier."
      subtitle={currentQuiz
        ? `${currentQuiz.label} — ${currentQuiz.questions.length} question${currentQuiz.questions.length > 1 ? "s" : ""}. Note minimale : ${currentQuiz.passMark} / ${currentQuiz.questions.length}.${totalQuizzes > 1 ? `  ·  Quiz ${quizIndex + 1} / ${totalQuizzes}` : ""}`
        : undefined
      }
      cta={{ label: submitting ? "Chargement..." : "Soumettre", onPress: handleSubmit, disabled: !allAnswered || submitting, loading: submitting }}
      secondaryCta={{ label: "Passer cette etape", onPress: advanceOrFinish }}
    >
      <Animated.View style={{ opacity: fadeAnim }}>
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
                  onPress={() => { Haptics.selectionAsync(); setSelected(prev => prev.map((a, i) => i === qi ? oi : a)); }}
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

        <Text style={s.answeredText}>
          {selected.filter(v => v !== null).length} / {currentQuiz?.questions.length ?? 0} repondue(s)
        </Text>
      </Animated.View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  centered: { alignItems: "center", paddingVertical: 40 },

  quizMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  quizCounter: { backgroundColor: C.white, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  quizCounterText: { fontFamily: FONTS.sansMedium, fontSize: 11, color: "#0A0A0A" },
  categoryPill: { backgroundColor: C.cardBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  categoryPillText: { fontFamily: FONTS.sansMedium, fontSize: 11, color: "rgba(255,255,255,0.5)" },

  quizQ: { marginBottom: 24 },
  quizQNum: { fontFamily: FONTS.mono, fontSize: 11, color: C.grey, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  quizQText: { fontFamily: FONTS.sansMedium, fontSize: 15, color: C.white, marginBottom: 12, lineHeight: 22 },
  quizOpt: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, marginBottom: 8,
  },
  quizOptSel: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.2)" },
  quizRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  quizRadioSel: { borderColor: C.white },
  quizRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.white },
  quizOptText: { fontFamily: FONTS.sansLight, fontSize: 14, color: "rgba(255,255,255,0.5)", flex: 1 },
  quizOptTextSel: { fontFamily: FONTS.sansMedium, color: C.white },

  answeredText: { fontFamily: FONTS.mono, fontSize: 12, color: C.grey, textAlign: "right", marginTop: 8 },

  resultWrap: { alignItems: "center", paddingVertical: 24, gap: 16 },
  resultIcon: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  resultIconPass: { backgroundColor: "rgba(61,139,61,0.1)", borderWidth: 1, borderColor: "rgba(61,139,61,0.3)" },
  resultIconFail: { backgroundColor: "rgba(229,57,53,0.1)", borderWidth: 1, borderColor: "rgba(229,57,53,0.3)" },
  scorePill: { backgroundColor: C.cardBg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  scoreText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: C.white },
});
