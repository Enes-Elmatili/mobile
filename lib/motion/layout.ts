// lib/motion/layout.ts — le déplacement d'une ligne quand la liste change
// (ajout, retrait, section qui s'ouvre). Même ressort que l'indicateur
// d'onglet (MOTION.tab), amortissement critique : la ligne glisse à sa place
// sans la dépasser. Remplace les `LinearTransition.springify().damping(24)
// .stiffness(260)` écrits à la main (ζ ≈ 0,74 : un rebond à chaque réordonnancement).
import { LinearTransition } from 'react-native-reanimated';
import { MOTION } from './springs';

export const LAYOUT = LinearTransition.springify().damping(MOTION.tab.damping).stiffness(MOTION.tab.stiffness).mass(MOTION.tab.mass);
