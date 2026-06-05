import React, { useCallback, useRef } from 'react';
import { Text, StyleSheet, TouchableOpacity, Dimensions, View } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkTokens, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useFeedbackStore } from '@/lib/feedback/store';

export function ActionSheet() {
  const sheet = useFeedbackStore((s) => s.actionSheet);
  const clear = useFeedbackStore((s) => s.clearActionSheet);
  const ref = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  const settle = useCallback((index: number | null) => {
    const current = useFeedbackStore.getState().actionSheet;
    if (current) current.resolve(index);
    clear();
  }, [clear]);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />,
    [],
  );

  if (!sheet) return null;

  return (
    <BottomSheet
      ref={ref}
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      maxDynamicContentSize={Dimensions.get('window').height * 0.7}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: darkTokens.border }}
      backgroundStyle={{ backgroundColor: darkTokens.surface }}
      onClose={() => settle(null)}
    >
      <BottomSheetView style={[s.body, { paddingBottom: insets.bottom + 16 }]}>
        {!!sheet.title && <Text style={s.title}>{sheet.title}</Text>}
        {sheet.options.map((opt, i) => (
          <TouchableOpacity key={i} style={s.optionBtn} onPress={() => settle(i)}>
            <Text style={[s.optionText, opt.destructive && { color: COLORS.danger }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={s.divider} />
        <TouchableOpacity style={s.cancelBtn} onPress={() => settle(null)}>
          <Text style={s.cancelText}>{sheet.cancelLabel}</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 4 },
  title: { color: darkTokens.textMuted, fontFamily: FONTS.sansMedium, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  optionBtn: { paddingVertical: 16, alignItems: 'center' },
  optionText: { color: darkTokens.text, fontFamily: FONTS.sansMedium, fontSize: 16 },
  divider: { height: 1, backgroundColor: darkTokens.border, marginVertical: 4 },
  cancelBtn: { paddingVertical: 16, alignItems: 'center' },
  cancelText: { color: darkTokens.textMuted, fontFamily: FONTS.sansMedium, fontSize: 16 },
});
