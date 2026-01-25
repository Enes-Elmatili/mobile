import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function RequestCompletedView({ finalPrice, onRate }: { finalPrice: number, onRate: () => void }) {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.5);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true })
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Ionicons name="checkmark-circle" size={100} color="#34C759" />
      </Animated.View>

      <Text style={styles.title}>Mission Terminée !</Text>
      <Text style={styles.subtitle}>Le prestataire a indiqué avoir fini le travail.</Text>

      <View style={styles.billCard}>
        <Text style={styles.billLabel}>Montant final</Text>
        <Text style={styles.billAmount}>{finalPrice}€</Text>
      </View>

      <TouchableOpacity onPress={onRate} style={styles.btn}>
        <Text style={styles.btnText}>Noter la prestation</Text>
        <Ionicons name="star" size={18} color="white" style={{marginLeft: 8}} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'white' },
  iconContainer: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 40 },
  billCard: { backgroundColor: '#F5F5F5', padding: 30, borderRadius: 20, width: '100%', alignItems: 'center', marginBottom: 40 },
  billLabel: { fontSize: 14, color: '#666', textTransform: 'uppercase' },
  billAmount: { fontSize: 40, fontWeight: 'bold', color: '#000', marginTop: 5 },
  btn: { flexDirection: 'row', backgroundColor: 'black', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 30, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});
