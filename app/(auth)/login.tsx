import React, { useState } from 'react';
import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../../lib/auth/AuthContext';
import { api } from '../../lib/api';

export default function Login() {
  const { signIn, isBooting } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email || !password) {
      return Alert.alert('Erreur', 'Remplissez tous les champs');
    }

    setLoading(true);
    try {
      console.log('📤 LOGIN REQUEST:', { email });
      const res = await api.auth.login(email, password);
      console.log('📥 LOGIN RESPONSE:', res);

      const token = res?.token;
      if (!token) {
        throw new Error('Token manquant dans la réponse');
      }

      console.log('🔐 Token reçu, appel signIn...');
      await signIn(token);
      console.log('✅ SIGNIN COMPLETE - Attendre navigation auto...');

      // ✅ Pas de router.replace ! La navigation est automatique via _layout
    } catch (err: any) {
      console.error('❌ LOGIN ERROR:', err.message || err);
      Alert.alert('Erreur de connexion', err.message || 'Échec de la connexion');
    } finally {
      setLoading(false);
    }
  };

  if (isBooting) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#172247" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Connexion</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Mot de passe"
        secureTextEntry
        style={styles.input}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
    color: '#111827',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#172247',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
