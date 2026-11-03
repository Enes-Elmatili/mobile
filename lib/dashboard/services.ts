// lib/dashboard/services.ts — le catalogue de services affiché sur l'accueil.
import { COLORS } from '@/hooks/use-app-theme';
import type { FeatherName } from './status';

export type ServiceCard = {
  key: string;
  icon: FeatherName;
  theme: 'black' | 'light';
  led: string;
  category: string;
};

// Le `label` est volontairement absent : on rend `t(`category.${key}`)` au moment
// du render — comme ça la card s'affiche en NL / EN si le user a switché de langue.
// NB : pas de compteur de prestataires ici — aucune API ne fournit de vrais
// compteurs par catégorie, on n'affiche donc AUCUN chiffre mocké.
export const SERVICE_CARDS: ServiceCard[] = [
  { key: 'plomberie',   icon: 'droplet',  theme: 'black', led: COLORS.green,  category: 'plomberie'   },
  { key: 'electricite', icon: 'zap',      theme: 'light', led: COLORS.green,  category: 'electricite' },
  { key: 'serrurerie',  icon: 'key',      theme: 'light', led: COLORS.green,  category: 'serrurerie'  },
  { key: 'chauffage',   icon: 'zap',      theme: 'light', led: COLORS.green,  category: 'chauffage'   },
  { key: 'bricolage',   icon: 'tool',     theme: 'light', led: COLORS.green,  category: 'bricolage'   },
  { key: 'peinture',    icon: 'edit-2',   theme: 'light', led: COLORS.green,  category: 'peinture'    },
];

// Catalogue actuel : uniquement Plomberie et Serrurerie
export const LAUNCH_CARDS = SERVICE_CARDS.filter(c => c.key === 'plomberie' || c.key === 'serrurerie');
