/**
 * onboardingService.ts — Onboarding prestataire
 *
 * Responsabilités :
 *   1. Persistance de l'état du formulaire multi-étapes via AsyncStorage
 *      → résiste aux interruptions (coup de fil, backgrounding)
 *   2. Appels API pour récupérer la config dynamique (docs + quiz) par catégorie
 *   3. Soumission de l'enregistrement prestataire
 *
 * Les écrans appellent saveState() à chaque changement de champ.
 * Au montage, ils appellent loadState() pour restaurer la saisie.
 *
 * Toutes les erreurs sont des ApiError { message, status, data }.
 * Les appelants (écrans) gèrent l'UX : showSocketToast, navigation…
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';
import type { Provider, CategoryDocConfig, QuizConfig, QuizSubmitResult } from './types';

// ── AsyncStorage key ──────────────────────────────────────────────────────────

const ONBOARDING_KEY = '@fixed:onboarding:state';

// ── State shape ───────────────────────────────────────────────────────────────

export interface OnboardingState {
  /** Étape courante (0-indexed) */
  step: number;
  /** Infos de base */
  name: string;
  description: string;
  phone: string;
  city: string;
  /** Géolocalisation optionnelle */
  lat?: number;
  lng?: number;
  /** Ids des catégories sélectionnées (step 2) */
  selectedCategoryIds: number[];
  /** ISO string : rempli une fois l'enregistrement soumis avec succès */
  completedAt?: string;
}

const DEFAULT_STATE: OnboardingState = {
  step: 0,
  name: '',
  description: '',
  phone: '',
  city: '',
  selectedCategoryIds: [],
};

// ── Service ───────────────────────────────────────────────────────────────────

export const onboardingService = {

  // ── State persistence ────────────────────────────────────────────────────────

  /** Charge l'état persisted. Retourne DEFAULT_STATE si rien n'est stocké. */
  loadState: async (): Promise<OnboardingState> => {
    try {
      const raw = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!raw) return { ...DEFAULT_STATE };
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_STATE };
    }
  },

  /** Fusionne `patch` dans l'état courant et persiste. */
  saveState: async (patch: Partial<OnboardingState>): Promise<void> => {
    try {
      const current = await onboardingService.loadState();
      await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...current, ...patch }));
    } catch {
      // Silent — ne jamais bloquer l'UX sur un échec AsyncStorage
    }
  },

  /** Efface l'état (après completion ou si le user abandonne). */
  clearState: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
    } catch { /* silent */ }
  },

  // ── Registration ─────────────────────────────────────────────────────────────

  /**
   * POST /providers/register — crée le compte prestataire
   *
   * Le backend :
   *  - Crée le Provider lié au User authentifié
   *  - Assigne le rôle PROVIDER
   *  - Retourne le provider créé
   *
   * Appeler refreshMe() côté AuthContext après succès pour mettre à jour les rôles.
   */
  register: async (payload: {
    name: string;
    description?: string;
    phone?: string;
    city?: string;
    lat?: number;
    lng?: number;
    categoryIds?: number[];
  }): Promise<Provider> => {
    const { data } = await apiClient.post<Provider>('/providers/register', payload);
    return data;
  },

  // ── Dynamic config (JSON-driven forms) ───────────────────────────────────────

  /** GET /categories — liste complète des catégories disponibles */
  getCategories: async () => {
    const { data } = await apiClient.get<any>('/categories');
    return Array.isArray(data) ? data : data?.categories ?? [];
  },

  /**
   * GET /providers/doc-config/:slug — config des documents requis pour une catégorie
   *
   * Retourne { slug, label, requiredDocs: [{ key, label, mimeTypes, mandatory }], hasQuiz }
   * Utilisé pour générer dynamiquement les composants DocumentUploader.
   */
  getDocConfig: async (categorySlug: string): Promise<CategoryDocConfig> => {
    const { data } = await apiClient.get<CategoryDocConfig>(
      `/providers/doc-config/${categorySlug}`,
    );
    return data;
  },

  /**
   * GET /providers/quiz-config/:slug — questions du quiz (sans les réponses)
   *
   * Retourne { slug, label, passMark, questions: [{ q, options }] }
   * L'index de la bonne réponse est masqué côté serveur.
   */
  getQuizConfig: async (categorySlug: string): Promise<QuizConfig> => {
    const { data } = await apiClient.get<QuizConfig>(
      `/providers/quiz-config/${categorySlug}`,
    );
    return data;
  },

  /**
   * POST /providers/quiz/:slug — soumettre les réponses du quiz
   *
   * @param categorySlug  Slug de la catégorie (ex: "electricite")
   * @param answers       Tableau des index sélectionnés, un par question (0-based)
   * @returns             { passed, score, total, passMark, detail? }
   */
  submitQuiz: async (categorySlug: string, answers: number[]): Promise<QuizSubmitResult> => {
    const { data } = await apiClient.post<QuizSubmitResult>(
      `/providers/quiz/${categorySlug}`,
      { answers },
    );
    return data;
  },
};
