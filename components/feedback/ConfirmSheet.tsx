import React, { useCallback, useRef } from 'react';
import { Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkTokens, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useFeedbackStore } from '@/lib/feedback/store';

export function ConfirmSheet() {
  const confirm = useFeedbackStore((s) => s.confirm);
  const clear = useFeedbackStore((s) => s.clearConfirm);
  const ref = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  // resolve(false) if dismissed without an explicit choice.
  // Reads the live store: once settled, clear() nulls confirm, so a
  // subsequent onClose finds no current confirm and won't double-resolve.
  const settle = useCallback((ok: boolean) => {
    const current = useFeedbackStore.getState().confirm;
    if (current) current.resolve(ok);
    clear();
  }, [clear]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  );

  if (!confirm) return null;

  return (
    <BottomSheet
      ref={ref}
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      maxDynamicContentSize={Dimensions.get('window').height * 0.6}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: darkTokens.border }}
      backgroundStyle={{ backgroundColor: darkTokens.surface }}
      onClose={() => settle(false)}
    >
      <BottomSheetView style={[s.body, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={s.title}>{confirm.title}</Text>
        {!!confirm.message && <Text style={s.message}>{confirm.message}</Text>}
        <TouchableOpacity
          style={[s.btn, { backgroundColor: confirm.destructive ? COLORS.danger : darkTokens.accent }]}
          onPress={() => settle(true)}
        >
          <Text style={[s.btnText, { color: confirm.destructive ? COLORS.alwaysWhite : darkTokens.accentText }]}>
            {confirm.confirmLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.cancelBtn} onPress={() => settle(false)}>
          <Text style={s.cancelText}>{confirm.cancelLabel}</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  title: { color: darkTokens.text, fontFamily: FONTS.bebas, fontSize: 26, letterSpacing: 0.5 },
  message: { color: darkTokens.textSub, fontFamily: FONTS.sans, fontSize: 15, lineHeight: 21 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnText: { fontFamily: FONTS.sansMedium, fontSize: 16 },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: darkTokens.textMuted, fontFamily: FONTS.sansMedium, fontSize: 15 },
});
