import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  provider: any;
  onSubmit: (rating: number, comment: string) => void;
}

export function RequestRatingView({ provider, onSubmit }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatarContainer}>
           {/* Placeholder Avatar */}
           <View style={styles.avatar}><Text style={{fontSize: 24}}>👤</Text></View>
        </View>
        
        <Text style={styles.title}>Notez {provider?.name || 'le prestataire'}</Text>
        <Text style={styles.subtitle}>Comment s'est passée votre expérience ?</Text>

        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <Ionicons 
                name={star <= rating ? "star" : "star-outline"} 
                size={40} 
                color="#FFD700" 
                style={{ marginHorizontal: 5 }}
              />
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Laissez un commentaire (optionnel)..."
          multiline
          value={comment}
          onChangeText={setComment}
        />

        <TouchableOpacity 
           onPress={() => onSubmit(rating, comment)} 
           style={[styles.btn, { opacity: rating === 0 ? 0.5 : 1 }]}
           disabled={rating === 0}
        >
          <Text style={styles.btnText}>Envoyer l'avis</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  avatarContainer: { marginBottom: 20, shadowColor: 'black', shadowOpacity: 0.1, shadowRadius: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eee', justifyContent:'center', alignItems:'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30 },
  starsContainer: { flexDirection: 'row', marginBottom: 30 },
  input: { width: '100%', backgroundColor: '#F9F9F9', padding: 15, borderRadius: 12, height: 100, textAlignVertical: 'top', fontSize: 16, marginBottom: 20 },
  btn: { width: '100%', backgroundColor: 'black', padding: 18, borderRadius: 15, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
