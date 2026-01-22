import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RequestRatingViewProps {
  providerName: string;
  providerAvatar?: string;
  onSubmitRating: (rating: number) => void;
}

export function RequestRatingView({ 
  providerName, 
  providerAvatar, 
  onSubmitRating 
}: RequestRatingViewProps) {
  const [rating, setRating] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleRating = (value: number) => {
    setRating(value);
    // Petit délai pour l'effet visuel avant soumission
    setTimeout(() => {
      setIsSubmitted(true);
      setTimeout(() => onSubmitRating(value), 1000);
    }, 500);
  };

  if (isSubmitted) {
    return (
      <View style={styles.container}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={32} color="#fff" />
        </View>
        <Text style={styles.title}>Merci !</Text>
        <Text style={styles.subtitle}>Votre avis a été enregistré.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image 
        source={{ uri: providerAvatar || 'https://i.pravatar.cc/150?u=a042581f4e29026024d' }} 
        style={styles.avatar} 
      />
      
      <Text style={styles.title}>Notez {providerName}</Text>
      <Text style={styles.subtitle}>Comment s'est passée votre expérience ?</Text>

      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity 
            key={star} 
            onPress={() => handleRating(star)}
            style={styles.starButton}
          >
            <Ionicons 
              name={star <= rating ? "star" : "star-outline"} 
              size={40} 
              color={star <= rating ? "#FFD700" : "#E0E0E0"} 
            />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.ratingLabel}>
        {rating === 5 && 'Excellent !'}
        {rating === 4 && 'Très bien'}
        {rating === 3 && 'Bien'}
        {rating === 2 && 'Moyen'}
        {rating === 1 && 'À éviter'}
        {rating === 0 && ' '}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 50,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
    backgroundColor: '#F0F0F0',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#545454',
    marginBottom: 32,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#545454',
    height: 24, // Pour éviter le saut de layout
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
});
