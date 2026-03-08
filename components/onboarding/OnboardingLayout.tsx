// components/onboarding/OnboardingLayout.tsx — Wrapper unifié pour TOUS les écrans d'onboarding
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';

interface Props {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  /** Show back button. Defaults to true but auto-hides if there's no screen to go back to. */
  showBack?: boolean;
  title: string;
  subtitle?: string;
  cta?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  secondaryCta?: {
    label: string;
    onPress: () => void;
  };
}

export function OnboardingLayout({
  children,
  currentStep,
  totalSteps,
  onBack,
  showBack = true,
  title,
  subtitle,
  cta,
  secondaryCta,
}: Props) {
  // Only show the back button if there's actually a screen to go back to
  const canGoBack = router.canGoBack();
  const shouldShowBack = showBack && (!!onBack || canGoBack);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        {shouldShowBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
        ) : <View style={styles.backPlaceholder} />}

        <Text style={styles.logo}>FIXED</Text>

        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>
            {String(currentStep).padStart(2, '0')} / {totalSteps}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSegment,
              i < currentStep && styles.progressSegmentActive,
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          <View style={styles.content}>{children}</View>
        </ScrollView>

        {/* CTA fixe en bas */}
        {cta && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.ctaButton, cta.disabled && styles.ctaDisabled]}
              onPress={cta.onPress}
              disabled={cta.disabled || cta.loading}
              accessibilityRole="button"
              accessibilityLabel={cta.label}
              accessibilityState={{ disabled: cta.disabled }}
            >
              <Text style={[styles.ctaText, cta.disabled && styles.ctaTextDisabled]}>
                {cta.loading ? 'Chargement…' : cta.label}
              </Text>
              {!cta.loading && !cta.disabled && (
                <Ionicons name="arrow-forward" size={16} color="#000" />
              )}
            </TouchableOpacity>
            {secondaryCta && (
              <TouchableOpacity onPress={secondaryCta.onPress} style={styles.secondaryCta}>
                <Text style={styles.secondaryCtaText}>{secondaryCta.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 16,
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  backPlaceholder: { width: 36 },
  logo: {
    fontSize: 16, fontWeight: '900', color: '#fff',
    letterSpacing: 3,
  },
  stepBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  stepText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  progressBar: {
    flexDirection: 'row', gap: 4,
    paddingHorizontal: 20, marginBottom: 8,
  },
  progressSegment: {
    flex: 1, height: 2, borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  progressSegmentActive: { backgroundColor: '#fff' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  title: {
    fontSize: 30, fontWeight: '800', color: '#fff',
    lineHeight: 36, marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.4)',
    lineHeight: 22, marginBottom: 32,
  },
  content: { flex: 1 },
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 12, gap: 12 },
  ctaButton: {
    backgroundColor: '#fff', borderRadius: 16, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ctaDisabled: { backgroundColor: 'rgba(255,255,255,0.1)' },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#000' },
  ctaTextDisabled: { color: 'rgba(255,255,255,0.2)' },
  secondaryCta: { alignItems: 'center', paddingVertical: 4 },
  secondaryCtaText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
});
