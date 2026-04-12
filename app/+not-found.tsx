import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

export default function NotFoundScreen() {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Feather name="alert-circle" size={80} color={COLORS.red} />
      <Text style={[styles.title, { color: theme.text }]}>Page introuvable</Text>
      <Text style={[styles.subtitle, { color: theme.textSub }]}>Cette page n&apos;existe pas</Text>
      <Link href="/(tabs)/dashboard" asChild>
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.accent }]}>
          <Text style={[styles.buttonText, { color: theme.accentText }]}>Retour à l&apos;accueil</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bebas,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: FONTS.sansMedium,
  },
});
