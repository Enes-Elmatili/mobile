// components/request/stepper/dialogStyles.ts
// Styles partagés des fenêtres du stepper (DevisInfoModal, PromoSheet).
import { StyleSheet } from 'react-native';
import { FONTS } from '@/hooks/use-app-theme';

export const dim = StyleSheet.create({
  header:       { paddingHorizontal: 24, gap: 8, marginBottom: 24 },
  sheet:        { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36, paddingTop: 14 },
  titleRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(200,130,10,0.15)', borderWidth: 1, borderColor: 'rgba(200,130,10,0.3)' },
  title:        { fontSize: 18, fontFamily: FONTS.sansMedium, letterSpacing: -0.2 },
  subtitle:     { fontSize: 13, fontFamily: FONTS.sans, lineHeight: 19, opacity: 0.7 },
  divider:      { height: 1, marginHorizontal: 24, marginBottom: 24 },
  steps:        { paddingHorizontal: 24, marginBottom: 32 },
  stepRow:      { flexDirection: 'row', gap: 14 },
  stepLeft:     { alignItems: 'center', width: 28 },
  connector:    { flex: 1, width: 1, marginTop: 6 },
  numCircle:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderWidth: 1 },
  numText:      { fontSize: 12, fontFamily: FONTS.mono },
  stepContent:  { flex: 1, gap: 3, paddingTop: 4 },
  stepTitle:    { fontSize: 15, fontFamily: FONTS.sansMedium },
  stepSub:      { fontSize: 13, fontFamily: FONTS.sans, lineHeight: 18 },
  closeBtn:     { marginHorizontal: 24, borderRadius: 55, height: 54, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 16, fontFamily: FONTS.sansMedium },
  // legacy
  stepText:     { fontSize: 14, fontFamily: FONTS.sans, lineHeight: 20, paddingTop: 2 },
});
