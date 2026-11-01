// components/onboarding/pending/PendingTimeline.tsx — timeline du dossier (entreprise → activation)
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, darkTokens } from "@/hooks/use-app-theme";
import { alpha } from "@/components/auth";
import { usePulse } from "@/lib/motion/useLoops";
import type { TimelineRowSpec, TimelineState } from "@/lib/onboarding/pendingDossier";
import { C } from "./pendingTheme";

function TimelineRow({ label, state, eta, last }: { label: string; state: TimelineState; eta?: string; last?: boolean }) {
  const pulseStyle = usePulse(state === "active", { duration: 900 });

  return (
    <View style={tl.row}>
      <View style={tl.rail}>
        <View
          style={[
            tl.dot,
            state === "done" && tl.dotDone,
            state === "active" && tl.dotActive,
          ]}
        >
          {state === "done" && <Feather name="check" size={11} color={C.bg} />}
          {state === "active" && <Animated.View style={[tl.dotPulse, pulseStyle]} />}
        </View>
        {!last && <View style={[tl.connector, state === "done" && tl.connectorDone]} />}
      </View>
      <View style={[tl.textWrap, last && { paddingBottom: 0 }]}>
        <Text style={[tl.label, state === "idle" && tl.labelIdle]}>{label}</Text>
        {state === "active" && !!eta && <Text style={tl.eta}>{eta}</Text>}
      </View>
    </View>
  );
}

export function PendingTimeline({ rows }: { rows: TimelineRowSpec[] }) {
  const { t } = useTranslation();
  return (
    <View style={tl.card}>
      {rows.map((r) => (
        <TimelineRow
          key={r.id}
          label={t(r.labelKey)}
          state={r.state}
          eta={r.eta ? t(r.eta.key, r.eta.params) : undefined}
          last={r.last}
        />
      ))}
    </View>
  );
}

const tl = StyleSheet.create({
  card: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 18, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14,
    marginBottom: 18,
  },
  row: { flexDirection: "row", gap: 13 },
  rail: { alignItems: "center" },
  dot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: alpha(darkTokens.text, 0.05),
    borderWidth: 1.5, borderColor: alpha(darkTokens.text, 0.15),
    alignItems: "center", justifyContent: "center",
  },
  dotDone: { backgroundColor: C.white, borderColor: C.white },
  dotActive: { borderColor: alpha(darkTokens.text, 0.6) },
  dotPulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.amber },
  connector: { width: 1.5, flex: 1, minHeight: 14, backgroundColor: alpha(darkTokens.text, 0.12) },
  connectorDone: { backgroundColor: alpha(darkTokens.text, 0.4) },
  textWrap: { flex: 1, paddingTop: 2, paddingBottom: 14, gap: 3 },
  label: { fontFamily: FONTS.sansMedium, fontSize: 13.5, color: C.white },
  labelIdle: { fontFamily: FONTS.sansLight, color: C.grey },
  eta: {
    fontFamily: FONTS.mono, fontSize: 8.5, letterSpacing: 1.4,
    color: C.amber, textTransform: "uppercase",
  },
});
