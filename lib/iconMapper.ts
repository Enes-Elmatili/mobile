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

// ============================================================================
// Feather support (design charter — Feather icons only)
// ============================================================================

// Emoji → Feather (miroir de EMOJI_TO_IONICONS)
const EMOJI_TO_FEATHER: Record<string, string> = {
  '🔧': 'tool', '🔨': 'tool', '⚙️': 'settings', '🛠️': 'tool',
  '🔩': 'settings', '🪛': 'tool',
  '🧹': 'star', '🧺': 'shopping-bag', '🧽': 'droplet', '🪣': 'droplet', '🧴': 'droplet',
  '🚨': 'alert-circle', '⚠️': 'alert-triangle', '🆘': 'help-circle', '🔴': 'radio',
  '🏠': 'home', '🏡': 'home', '🚪': 'log-in', '🪟': 'grid', '🛋️': 'home', '🛁': 'droplet',
  '💡': 'zap', '⚡': 'zap', '🔌': 'cpu', '💧': 'droplet', '🚿': 'droplet',
  '🌿': 'feather', '🌳': 'feather', '🌱': 'feather', '✂️': 'scissors',
  '📦': 'package', '🚚': 'truck', '🏋️': 'activity',
  '🎨': 'edit-2', '🖌️': 'edit-2',
  '💻': 'monitor', '📱': 'smartphone', '🖥️': 'monitor', '📷': 'camera',
  '🐾': 'heart', '🐕': 'heart', '🍽️': 'coffee', '👶': 'users',
  '🧑‍⚕️': 'plus-square', '💊': 'plus-square',
};

// Nom de catégorie → Feather (miroir de CATEGORY_NAME_TO_IONICONS)
const CATEGORY_NAME_TO_FEATHER: Record<string, string> = {
  plomberie:    'droplet',   plumber:    'droplet',
  electricite:  'zap',       electricité:'zap',       electric:'zap',
  nettoyage:    'star',      cleaning:   'star',
  jardinage:    'feather',   garden:     'feather',
  demenagement: 'package',   déménagement:'package',  moving:  'package',
  peinture:     'edit-2',    painting:   'edit-2',
  informatique: 'monitor',   tech:       'monitor',
  serrurerie:   'key',       locksmith:  'key',
  chauffage:    'thermometer', heating:  'thermometer',
  urgence:      'alert-circle', emergency:'alert-circle',
  maconnerie:   'tool',      maçonnerie: 'tool',
  menuiserie:   'tool',
  toiture:      'home',      roof:       'home',
  garde:        'users',     enfant:     'users',
  animaux:      'heart',     pets:       'heart',
};

// Nom Ionicons → Feather (basé sur mapping table établi en migration Pilot B)
const IONICON_TO_FEATHER: Record<string, string> = {
  'construct': 'tool', 'hammer': 'tool', 'build': 'tool',
  'settings': 'settings', 'cog': 'settings',
  'sparkles': 'star',
  'basket': 'shopping-bag',
  'water': 'droplet', 'flask': 'droplet',
  'alert-circle': 'alert-circle', 'warning': 'alert-triangle', 'alert': 'alert-triangle',
  'help-circle': 'help-circle', 'information-circle': 'info', 'info': 'info',
  'home': 'home',
  'bulb': 'zap', 'flash': 'zap', 'bolt': 'zap',
  'hardware-chip': 'cpu',
  'leaf': 'feather',
  'cut': 'scissors',
  'cube': 'package',
  'car': 'truck',
  'barbell': 'activity',
  'color-palette': 'edit-2', 'brush': 'edit-2', 'pencil': 'edit-2', 'create': 'edit-2',
  'laptop': 'monitor', 'desktop': 'monitor',
  'phone-portrait': 'smartphone',
  'camera': 'camera',
  'paw': 'heart',
  'restaurant': 'coffee',
  'people': 'users', 'person': 'user', 'person-circle': 'user',
  'medkit': 'plus-square',
  'key': 'key',
  'thermometer': 'thermometer',
  'briefcase': 'briefcase', 'business': 'briefcase', 'storefront': 'briefcase',
  'time': 'clock', 'hourglass': 'clock', 'stopwatch': 'clock',
  'calendar': 'calendar',
  'checkmark-circle': 'check-circle', 'checkmark': 'check', 'shield-checkmark': 'check-circle',
  'close': 'x', 'close-circle': 'x-circle',
  'location': 'map-pin', 'pin': 'map-pin',
  'enter': 'log-in', 'exit': 'log-out',
  'apps': 'grid', 'grid': 'grid',
  'bed': 'home',
  'chevron-forward': 'chevron-right', 'chevron-back': 'chevron-left',
  'arrow-forward': 'arrow-right', 'arrow-back': 'arrow-left',
  'mail': 'mail', 'call': 'phone', 'phone': 'phone',
  'card': 'credit-card', 'wallet': 'credit-card',
  'cash': 'dollar-sign', 'pricetag': 'tag',
  'document-text': 'file-text', 'document': 'file-text', 'receipt': 'file-text',
  'notifications': 'bell',
  'refresh': 'refresh-cw', 'sync': 'refresh-cw',
  'lock-closed': 'lock', 'lock': 'lock', 'lock-open': 'unlock',
  'eye': 'eye', 'eye-off': 'eye-off',
  'star': 'star', 'heart': 'heart',
  'bookmark': 'bookmark', 'flag': 'flag',
  'share': 'share-2', 'share-social': 'share-2',
  'trash': 'trash-2',
  'download': 'download', 'upload': 'upload', 'cloud-upload': 'upload',
  'send': 'send', 'paper-plane': 'send',
  'chatbubble': 'message-circle', 'chatbubbles': 'message-circle', 'chatbox': 'message-square',
  'log-in': 'log-in', 'log-out': 'log-out',
  'menu': 'menu', 'search': 'search', 'filter': 'filter', 'funnel': 'filter', 'options': 'filter',
  'shield': 'shield',
  'trending-up': 'trending-up', 'trending-down': 'trending-down',
  'stats-chart': 'bar-chart-2', 'analytics': 'bar-chart-2', 'bar-chart': 'bar-chart',
  'pie-chart': 'pie-chart',
  'radio-button-on': 'radio',
  'ellipsis-horizontal': 'more-horizontal', 'ellipsis-vertical': 'more-vertical',
  'add': 'plus', 'add-circle': 'plus-circle',
  'remove': 'minus', 'remove-circle': 'minus-circle',
  'navigate': 'navigation', 'compass': 'compass',
  'globe': 'globe', 'language': 'globe',
  'moon': 'moon', 'sunny': 'sun',
};

/**
 * Retourne un nom d'icône **Feather** valide à partir de n'importe quelle input
 * (emoji, nom de catégorie, nom Ionicons legacy, ou nom Feather déjà valide).
 * Utilisé principalement pour mapper les champs `icon` venus du backend (taxonomie)
 * vers la charte Feather-only imposée côté mobile.
 */
export function toFeatherName(
  input: string | undefined | null,
  fallback = 'briefcase'
): string {
  if (!input) return fallback;

  // 1. Emoji exact
  if (EMOJI_TO_FEATHER[input]) return EMOJI_TO_FEATHER[input];

  // 2. Contient un emoji (ex: "🔧 Plomberie")
  for (const [emoji, icon] of Object.entries(EMOJI_TO_FEATHER)) {
    if (input.includes(emoji)) return icon;
  }

  // 3. Nom de catégorie connu (match exact puis partial)
  const normalized = input.toLowerCase().trim();
  if (CATEGORY_NAME_TO_FEATHER[normalized]) return CATEGORY_NAME_TO_FEATHER[normalized];
  for (const [key, icon] of Object.entries(CATEGORY_NAME_TO_FEATHER)) {
    if (normalized.includes(key) || key.includes(normalized)) return icon;
  }

  // 4. Nom Ionicons legacy → Feather (strip `-outline` suffix)
  const stripped = input.replace(/-outline$/, '');
  if (IONICON_TO_FEATHER[stripped]) return IONICON_TO_FEATHER[stripped];
  if (IONICON_TO_FEATHER[input]) return IONICON_TO_FEATHER[input];

  return fallback;
}