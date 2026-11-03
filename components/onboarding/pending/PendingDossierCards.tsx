// components/onboarding/pending/PendingDossierCards.tsx — cartes « dossier incomplet » et « documents refusés »
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS } from "@/hooks/use-app-theme";
import { PressScale } from '@/components/ui/PressScale';
import { docLabelFallback, type PendingDoc } from "@/lib/onboarding/pendingDossier";
import { C, ps } from "./pendingTheme";

/** Dossier incomplet — la raison n°1 des refus : le prestataire quittait
 *  l'app pendant le KYC et cet écran lui annonçait « dossier reçu » sans
 *  jamais lui reproposer les pièces. */
export function PendingIncompleteCard({ reason, onResume }: {
  reason: { key: string; missingKeys?: string[] };
  onResume: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={ps.docsCard}>
      <View style={ps.docRow}>
        <Feather name="alert-circle" size={16} color={C.amber} />
        <View style={{ flex: 1 }}>
          <Text style={ps.docsTitle}>{t('onboarding.pending_incomplete_title')}</Text>
          <Text style={ps.docReason}>
            {reason.missingKeys
              ? t(reason.key, {
                  count: reason.missingKeys.length,
                  list: reason.missingKeys
                    .map((k) => t(`kyc.${k}_label`, { defaultValue: docLabelFallback(k) }))
                    .join(" · "),
                })
              : t(reason.key)}
          </Text>
        </View>
      </View>
      <PressScale
        style={ps.docsFixBtn}
        onPress={onResume}
        accessibilityRole="button"
      >
        <Feather name="upload" size={13} color={C.white} />
        <Text style={ps.docsFixText}>{t('onboarding.pending_incomplete_cta')}</Text>
      </PressScale>
    </View>
  );
}

/** Documents refusés — visibles uniquement si action requise. */
export function PendingRejectedDocs({ docs, onFix }: { docs: PendingDoc[]; onFix: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={ps.docsCard}>
      <Text style={ps.docsTitle}>{t('onboarding.pending_docs_title')}</Text>
      {docs.map(doc => (
        <View key={doc.id} style={ps.docRow}>
          <Feather name="x-circle" size={16} color={C.red} />
          <View style={{ flex: 1 }}>
            <Text style={s.docLabel}>{t(`kyc.${doc.docKey}_label`, { defaultValue: docLabelFallback(doc.docKey) })}</Text>
            {!!doc.rejectionReason && <Text style={ps.docReason}>{doc.rejectionReason}</Text>}
          </View>
          <Text style={[s.docStatus, { color: C.red }]}>{t('onboarding.pending_doc_refused')}</Text>
        </View>
      ))}
      <PressScale accessibilityRole="button"
        style={ps.docsFixBtn}
        onPress={onFix}
      >
        <Feather name="upload" size={13} color={C.white} />
        <Text style={ps.docsFixText}>{t('onboarding.rejected_cta')}</Text>
      </PressScale>
    </View>
  );
}

const s = StyleSheet.create({
  docLabel: {
    fontFamily: FONTS.sansMedium, fontSize: 13, color: C.white,
  },
  docStatus: { fontFamily: FONTS.sansMedium, fontSize: 12, color: C.grey },
});
