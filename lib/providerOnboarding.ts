// lib/providerOnboarding.ts — état réel de l'onboarding prestataire.
//
// Pourquoi ce module : jusqu'ici l'app déduisait l'avancement du seul
// `Provider.validationStatus`, qui vaut "PENDING" DÈS LA CRÉATION de la ligne
// prestataire — c'est-à-dire avant le premier document. Un redémarrage à froid
// pendant l'étape KYC envoyait donc le prestataire sur l'écran terminal
// « dossier en validation », dont le seul CTA est Stripe : dossier vide, refus
// mécanique.
//
// La source de vérité, c'est la liste des pièces réellement déposées, croisée
// avec les métiers exercés. Ce module la calcule, et il est partagé par l'écran
// documents et l'écran d'attente pour qu'ils ne puissent pas diverger.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { getRequiredDocuments } from "../constants/kycRequirements";

export const ONBOARDING_DATA_KEY = "onboarding_data";

export interface ServerDoc {
  docKey: string;
  status: string;
  rejectionReason?: string | null;
}

/**
 * Une pièce compte comme fournie tant qu'elle n'a pas été refusée.
 * REJECTED → à refaire, donc manquante.
 */
export function isDocSubmitted(status?: string | null): boolean {
  return status === "PENDING" || status === "APPROVED";
}

/** Clés des pièces OBLIGATOIRES pour ces métiers (miroir de requiredDocTypesFor côté backend). */
export function requiredDocKeys(categoryNames: string[]): string[] {
  return getRequiredDocuments(categoryNames)
    .filter((d) => d.required)
    .map((d) => d.type);
}

/** Pièces obligatoires encore à fournir. */
export function missingDocKeys(docs: ServerDoc[], categoryNames: string[]): string[] {
  const submitted = new Set(
    docs.filter((d) => isDocSubmitted(d.status)).map((d) => d.docKey)
  );
  return requiredDocKeys(categoryNames).filter((k) => !submitted.has(k));
}

export interface ProviderTrades {
  /** Noms des catégories exercées (ex. ["Plomberie"]). */
  names: string[];
  /** Ville de la zone d'intervention, si connue. */
  city: string | null;
  /**
   * true si la réponse est fiable. false = on n'a PAS pu établir les métiers :
   * on retombe alors sur les 7 documents, exactement comme le backend, parce
   * qu'un doute doit bloquer une activation, jamais en laisser passer une.
   */
  known: boolean;
}

/**
 * Métiers du prestataire : serveur d'abord, cache d'inscription en repli.
 *
 * Le repli existe parce que `GET /providers/me` ne renvoie `categories` que
 * depuis la mise à jour du 25/08/2026 — tant qu'elle n'est pas déployée, le
 * cache écrit par l'inscription e-mail fait foi.
 */
export async function fetchProviderTrades(): Promise<ProviderTrades> {
  let city: string | null = null;

  try {
    const res: any = await api.providers.me();
    const provider = res?.provider;
    if (provider?.city) city = String(provider.city);
    const cats = provider?.categories;
    if (Array.isArray(cats)) {
      return {
        names: cats.map((c: any) => c?.name).filter(Boolean),
        city,
        known: true,
      };
    }
  } catch {
    // 404 (pas encore prestataire) ou réseau : on tente le cache local
  }

  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const cats = data?.categories;
    if (!city && data?.city) city = String(data.city);
    if (Array.isArray(cats) && cats.length > 0) {
      return { names: cats.map((c: any) => c?.name).filter(Boolean), city, known: true };
    }
  } catch {}

  return { names: [], city, known: false };
}

export type OnboardingStep = "activity" | "documents" | "stripe" | "review";

/**
 * Première étape non terminée du parcours prestataire.
 * `review` = tout est fourni, il ne reste que la validation humaine.
 */
export function firstIncompleteStep(input: {
  trades: ProviderTrades;
  docs: ServerDoc[];
  stripeReady: boolean;
}): OnboardingStep {
  const { trades, docs, stripeReady } = input;
  if (trades.known && trades.names.length === 0) return "activity";
  if (missingDocKeys(docs, trades.names).length > 0) return "documents";
  if (!stripeReady) return "stripe";
  return "review";
}

/** Route de l'étape, pour un router.push/replace direct. */
export const STEP_ROUTES: Record<OnboardingStep, string> = {
  activity: "/onboarding/activity",
  documents: "/onboarding/documents",
  stripe: "/onboarding/stripe",
  review: "/onboarding/provider/pending",
};
