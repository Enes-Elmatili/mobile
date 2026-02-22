// lib/iconMapper.ts
// Convertit les emojis et noms invalides en noms d'icônes Ionicons valides
// Compatible aussi avec @expo/vector-icons (Ionicons, MaterialIcons, etc.)

const EMOJI_TO_IONICONS: Record<string, string> = {
  // Outils / Services
  '🔧': 'construct-outline',
  '🔨': 'hammer-outline',
  '⚙️': 'settings-outline',
  '🛠️': 'build-outline',
  '🔩': 'settings-outline',
  '🪛': 'construct-outline',

  // Nettoyage
  '🧹': 'sparkles-outline',
  '🧺': 'basket-outline',
  '🧽': 'water-outline',
  '🪣': 'water-outline',
  '🧴': 'flask-outline',

  // Urgence / Sécurité
  '🚨': 'alert-circle-outline',
  '⚠️': 'warning-outline',
  '🆘': 'help-circle-outline',
  '🔴': 'radio-button-on-outline',

  // Maison
  '🏠': 'home-outline',
  '🏡': 'home-outline',
  '🚪': 'enter-outline',
  '🪟': 'apps-outline',
  '🛋️': 'bed-outline',
  '🛁': 'water-outline',

  // Électricité / Plomberie
  '💡': 'bulb-outline',
  '⚡': 'flash-outline',
  '🔌': 'hardware-chip-outline',
  '💧': 'water-outline',
  '🚿': 'water-outline',

  // Nature / Jardin
  '🌿': 'leaf-outline',
  '🌳': 'leaf-outline',
  '🌱': 'leaf-outline',
  '✂️': 'cut-outline',

  // Déménagement / Transport
  '📦': 'cube-outline',
  '🚚': 'car-outline',
  '🏋️': 'barbell-outline',

  // Peinture / Déco
  '🎨': 'color-palette-outline',
  '🖌️': 'brush-outline',

  // Tech
  '💻': 'laptop-outline',
  '📱': 'phone-portrait-outline',
  '🖥️': 'desktop-outline',
  '📷': 'camera-outline',

  // Divers
  '🐾': 'paw-outline',
  '🐕': 'paw-outline',
  '🍽️': 'restaurant-outline',
  '👶': 'people-outline',
  '🧑‍⚕️': 'medkit-outline',
  '💊': 'medkit-outline',
};

// Icônes Ionicons valides par défaut pour les catégories
const CATEGORY_NAME_TO_IONICONS: Record<string, string> = {
  plomberie:       'water-outline',
  plumber:         'water-outline',
  electricite:     'flash-outline',
  electricité:     'flash-outline',
  electric:        'flash-outline',
  nettoyage:       'sparkles-outline',
  cleaning:        'sparkles-outline',
  jardinage:       'leaf-outline',
  garden:          'leaf-outline',
  demenagement:    'cube-outline',
  déménagement:    'cube-outline',
  moving:          'cube-outline',
  peinture:        'brush-outline',
  painting:        'brush-outline',
  informatique:    'laptop-outline',
  tech:            'laptop-outline',
  serrurerie:      'key-outline',
  locksmith:       'key-outline',
  chauffage:       'thermometer-outline',
  heating:         'thermometer-outline',
  urgence:         'alert-circle-outline',
  emergency:       'alert-circle-outline',
  maconnerie:      'construct-outline',
  maçonnerie:      'construct-outline',
  menuiserie:      'hammer-outline',
  toiture:         'home-outline',
  roof:            'home-outline',
  garde:           'people-outline',
  enfant:          'people-outline',
  animaux:         'paw-outline',
  pets:            'paw-outline',
};

/**
 * Retourne un nom d'icône Ionicons valide à partir de n'importe quelle input
 * (emoji, nom de catégorie, nom d'icône potentiellement invalide)
 */
export function toIoniconName(
  input: string | undefined | null,
  fallback = 'hammer-outline'
): string {
  if (!input) return fallback;

  // 1. Si c'est déjà un emoji → mapper
  if (EMOJI_TO_IONICONS[input]) {
    return EMOJI_TO_IONICONS[input];
  }

  // 2. Si ça contient un emoji (ex: "🔧 Plomberie")
  for (const [emoji, icon] of Object.entries(EMOJI_TO_IONICONS)) {
    if (input.includes(emoji)) return icon;
  }

  // 3. Si c'est un nom de catégorie connu
  const normalized = input.toLowerCase().trim();
  if (CATEGORY_NAME_TO_IONICONS[normalized]) {
    return CATEGORY_NAME_TO_IONICONS[normalized];
  }

  // 4. Cherche une correspondance partielle dans les noms de catégories
  for (const [key, icon] of Object.entries(CATEGORY_NAME_TO_IONICONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return icon;
    }
  }

  // 5. Si ça ressemble à un nom Ionicons valide (contient des tirets, pas d'emoji)
  const looksLikeIonicon = /^[a-z][a-z0-9-]+$/.test(input);
  if (looksLikeIonicon) return input;

  return fallback;
}