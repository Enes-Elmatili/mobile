import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface Props {
  provider: any;
  onSubmit: (rating: number, comment: string) => void;
}

const QUICK_TAGS = [
  { id: 1, text: 'Professionnel', icon: 'briefcase' },
  { id: 2, text: 'Ponctuel', icon: 'time' },
  { id: 3, text: 'Sympathique', icon: 'happy' },
  { id: 4, text: 'Travail soigné', icon: 'checkmark-done' },
  { id: 5, text: 'Bon rapport qualité/prix', icon: 'cash' },
  { id: 6, text: 'À recommander', icon: 'thumbs-up' },
];

export function RequestRatingView({ provider, onSubmit }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [hoveredStar, setHoveredStar] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const starAnims = useRef([...Array(5)].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleStarPress = (star: number) => {
    setRating(star);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate stars
    starAnims.forEach((anim, index) => {
      if (index < star) {
        Animated.sequence([
          Animated.spring(anim, {
            toValue: 1.3,
            tension: 100,
            friction: 3,
            useNativeDriver: true,
          }),
          Animated.spring(anim, {
            toValue: 1,
            tension: 50,
            friction: 5,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        anim.setValue(0);
      }
    });
  };

  const toggleTag = (tagId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = () => {
    if (rating === 0) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const tags = QUICK_TAGS
      .filter(tag => selectedTags.includes(tag.id))
      .map(tag => tag.text)
      .join(', ');
    
    const fullComment = tags ? `${comment}\n\nTags: ${tags}` : comment;
    onSubmit(rating, fullComment);
  };

  const getRatingText = () => {
    switch (rating) {
      case 1: return 'Très décevant';
      case 2: return 'Peut mieux faire';
      case 3: return 'Correct';
      case 4: return 'Très bien';
      case 5: return 'Excellent !';
      default: return 'Donnez votre avis';
    }
  };

  const getRatingColor = () => {
    if (rating <= 2) return '#FF3B30';
    if (rating === 3) return '#FF9500';
    return '#34C759';
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Gradient Background */}
      <LinearGradient
        colors={['#FFFFFF', '#F8F8F8', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Provider Avatar */}
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['#667EEA', '#764BA2']}
              style={styles.avatarGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.avatarText}>
                {provider?.name?.charAt(0) || 'P'}
              </Text>
            </LinearGradient>
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={16} color="#FFF" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            Comment s'est passée votre expérience ?
          </Text>
          <Text style={styles.providerName}>
            avec {provider?.name || 'ce prestataire'}
          </Text>

          {/* Stars */}
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleStarPress(star)}
                activeOpacity={0.7}
                style={styles.starButton}
              >
                <Animated.View
                  style={{
                    transform: [{ scale: starAnims[star - 1] }],
                  }}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={48}
                    color={star <= rating ? getRatingColor() : '#D1D1D6'}
                  />
                </Animated.View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Rating Text */}
          <Animated.Text
            style={[
              styles.ratingText,
              { color: rating > 0 ? getRatingColor() : '#999' },
            ]}
          >
            {getRatingText()}
          </Animated.Text>

          {/* Quick Tags */}
          {rating > 0 && (
            <View style={styles.tagsSection}>
              <Text style={styles.tagsTitle}>Ce qui vous a plu</Text>
              <View style={styles.tagsGrid}>
                {QUICK_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => toggleTag(tag.id)}
                    activeOpacity={0.7}
                    style={styles.tagButton}
                  >
                    <LinearGradient
                      colors={
                        selectedTags.includes(tag.id)
                          ? ['#000', '#1A1A1A']
                          : ['#FFF', '#F5F5F5']
                      }
                      style={styles.tagGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons
                        name={tag.icon as any}
                        size={18}
                        color={selectedTags.includes(tag.id) ? '#FFF' : '#000'}
                      />
                      <Text
                        style={[
                          styles.tagText,
                          selectedTags.includes(tag.id) && styles.tagTextActive,
                        ]}
                      >
                        {tag.text}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Comment Input */}
          {rating > 0 && (
            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>
                Un commentaire ? (optionnel)
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Partagez votre expérience..."
                  placeholderTextColor="#999"
                  multiline
                  value={comment}
                  onChangeText={setComment}
                  maxLength={500}
                />
                <Text style={styles.charCount}>
                  {comment.length}/500
                </Text>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={rating === 0}
            activeOpacity={0.9}
            style={[
              styles.submitButton,
              rating === 0 && styles.submitButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={
                rating === 0
                  ? ['#E5E5E5', '#D1D1D6']
                  : ['#000', '#1A1A1A']
              }
              style={styles.submitGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text
                style={[
                  styles.submitText,
                  rating === 0 && styles.submitTextDisabled,
                ]}
              >
                {rating === 0 ? 'Sélectionnez une note' : 'Envoyer l\'avis'}
              </Text>
              {rating > 0 && (
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Skip Button */}
          <TouchableOpacity style={styles.skipButton}>
            <Text style={styles.skipText}>Passer cette étape</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 60,
    paddingBottom: 40,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFF',
  },
  checkBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  providerName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    fontWeight: '500',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 40,
    letterSpacing: 0.2,
  },
  tagsSection: {
    width: '100%',
    marginBottom: 32,
  },
  tagsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tagGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  tagTextActive: {
    color: '#FFF',
  },
  commentSection: {
    width: '100%',
    marginBottom: 32,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  inputContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
  },
  input: {
    padding: 16,
    fontSize: 16,
    color: '#000',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontWeight: '600',
  },
  submitButton: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    shadowOpacity: 0.05,
    elevation: 0,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  submitText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  submitTextDisabled: {
    color: '#999',
  },
  skipButton: {
    paddingVertical: 16,
  },
  skipText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});