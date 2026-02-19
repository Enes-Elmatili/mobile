// app/request/[id]/rating.tsx
// Client rates the provider after mission completion

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';

export default function RatingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load request to get providerId
  useEffect(() => {
    loadRequest();
  }, [id]);

  const loadRequest = async () => {
    try {
      const response = await api.get(`/requests/${id}`);
      setRequest(response.data || response);
    } catch (error) {
      console.error('Error loading request:', error);
      Alert.alert('Erreur', 'Impossible de charger la mission');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      Alert.alert('Note requise', 'Veuillez donner une note');
      return;
    }

    if (!request?.providerId) {
      Alert.alert('Erreur', 'Provider introuvable');
      return;
    }

    try {
      setSubmitting(true);
      
      console.log('⭐ Submitting rating:', {
        providerId: request.providerId,
        requestId: Number(id),
        rating,
        comment
      });

      await api.post('/ratings', {
        providerId: request.providerId,
        requestId: Number(id),
        rating,
        comment,
      });

      Alert.alert(
        '✅ Merci !',
        'Votre évaluation a été envoyée',
        [
          {
            text: 'OK',
            onPress: () => router.push('/(tabs)/dashboard')
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Rating error:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'envoyer l\'évaluation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Comment s'est passée votre expérience ?</Text>
          <Text style={styles.subtitle}>Votre avis nous aide à améliorer le service</Text>
        </View>

        {/* Stars */}
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              style={styles.starButton}
            >
              <Ionicons
                name={rating >= star ? 'star' : 'star-outline'}
                size={48}
                color={rating >= star ? '#FFB800' : '#D1D5DB'}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Rating label */}
        {rating > 0 && (
          <Text style={styles.ratingLabel}>
            {rating === 1 && 'Très mauvais'}
            {rating === 2 && 'Mauvais'}
            {rating === 3 && 'Moyen'}
            {rating === 4 && 'Bon'}
            {rating === 5 && 'Excellent'}
          </Text>
        )}

        {/* Comment */}
        <View style={styles.commentContainer}>
          <Text style={styles.commentLabel}>Commentaire (optionnel)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Partagez votre expérience..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit button */}
        <TouchableOpacity
          style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
          onPress={handleSubmitRating}
          disabled={rating === 0 || submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Envoi...' : 'Envoyer l\'évaluation'}
          </Text>
        </TouchableOpacity>

        {/* Skip button */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.push('/(tabs)/dashboard')}
        >
          <Text style={styles.skipButtonText}>Plus tard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: 32,
  },
  titleContainer: {
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  starButton: {
    padding: 8,
  },
  ratingLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 32,
  },
  commentContainer: {
    marginBottom: 32,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    backgroundColor: '#F9FAFB',
  },
  submitButton: {
    backgroundColor: '#000',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});