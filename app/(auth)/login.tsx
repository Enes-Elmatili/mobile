import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router'; // Ajout du router
import { useAuth } from '../../lib/auth/AuthContext';
import { api } from '../../lib/api';

export default function Login() {
  const router = useRouter(); // Hook router
  const { signIn, isBooting } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email || !password) return Alert.alert('Erreur', 'Remplissez tous les champs');

    setLoading(true);
    try {
      console.log('📤 LOGIN REQUEST:', { email });
      const res = await api.auth.login(email, password);
      
      const token = res?.token;
      if (!token) throw new Error('Token manquant dans la réponse');

      await signIn(token);
      // Navigation auto via AuthContext/_layout, pas besoin de push ici
    } catch (err: any) {
      console.error('❌ LOGIN ERROR:', err.message || err);
      Alert.alert('Erreur', 'Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  if (isBooting) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#172247" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Connexion</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Se connecter</Text>
          )}
        </TouchableOpacity>

        {/* --- AJOUT BOUTON SIGNUP --- */}
        <TouchableOpacity 
          style={styles.linkButton} 
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.linkText}>Pas encore de compte ? Créer un compte</Text>
        </TouchableOpacity>
        
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', padding: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 30, color: '#111827', textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  button: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  linkButton: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#000', fontSize: 14, textDecorationLine: 'underline' },
});
