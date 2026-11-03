// components/request/stepper/accessStyles.ts
// Styles des puces et champs de l'étape 3 (TVA, infos d'accès).
import { StyleSheet } from 'react-native';
import { FONTS } from '@/hooks/use-app-theme';

// ─── AccessInfo styles ──────────────────────────────────────────────────────
export const ai = StyleSheet.create({
  body:        { marginTop: 12, gap: 14 },
  label:       { fontSize: 10, fontFamily: FONTS.sansMedium, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  chipText:    { fontSize: 13, fontFamily: FONTS.sansMedium },
  inlineRow:   { flexDirection: 'row', gap: 14 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  input:       { flex: 1, fontSize: 15, fontFamily: FONTS.sans, paddingVertical: 0 },
  textareaWrap: { borderWidth: 1.5, borderRadius: 12, padding: 12 },
  textarea:    { fontSize: 14, fontFamily: FONTS.sans, minHeight: 60 },
});
