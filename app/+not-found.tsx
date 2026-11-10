import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { PressScale } from '@/components/ui/PressScale';
import { BookSpread, useSplitPane } from '@/lib/layout';

export default function NotFoundScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const isSplit = useSplitPane();

  const content = (
    <>
      <Feather name="alert-circle" size={80} color={COLORS.red} />
      <Text style={[styles.title, { color: theme.text }]}>{t('ext.not_found_title')}</Text>
      <Text style={[styles.subtitle, isSplit && styles.subtitleSplit, { color: theme.textSub }]}>{t('ext.not_found_sub')}</Text>
      <Link href="/(tabs)/dashboard" asChild>
        <PressScale style={[styles.button, { backgroundColor: theme.accent }]}>
          <Text style={[styles.buttonText, { color: theme.accentText }]}>{t('ext.not_found_back')}</Text>
        </PressScale>
      </Link>
    </>
  );

  if (isSplit) {
    // Duo déplié : centré dans la page gauche — au centre de la scène, le
    // message et le bouton tombaient sur la charnière.
    return (
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <BookSpread left={<View style={styles.container}>{content}</View>} right={null} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bebas, includeFontPadding: false,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  // Page étroite : si le texte passe à la ligne, il reste centré.
  subtitleSplit: { textAlign: 'center' },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 13,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: FONTS.sansMedium,
  },
});
