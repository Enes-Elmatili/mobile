// stores/nav.ts — ce que la barre flottante porte, décidé par les écrans.
//
// Le disque détaché à droite de la barre porte l'action du moment, et suit sur
// tous les onglets : GO (hors ligne) · stop (en ligne) · flèche ambre (en
// mission) côté prestataire ; « + » (demander) · flèche ambre (suivre) côté
// client. Les écrans le règlent (`setDisc`) ; la barre le rend ; l'appui
// remonte au réglage courant. Les badges suivent la même voie.
import { create } from 'zustand';

export type DiscKind = 'go' | 'stop' | 'busy' | 'plus' | 'track' | 'hidden';

export type Disc = {
  kind: DiscKind;
  onPress?: () => void;
  /** Libellé VoiceOver de l'action. */
  label?: string;
};

export type Badges = {
  missions?: number | string | null;
  documents?: number | string | null;
  profile?: number | string | null;
};

type NavState = {
  disc: Disc;
  setDisc: (d: Disc) => void;
  badges: Badges;
  setBadge: (tab: keyof Badges, value: number | string | null) => void;
};

export const useNavStore = create<NavState>((set) => ({
  disc: { kind: 'hidden' },
  setDisc: (disc) => set({ disc }),
  badges: {},
  setBadge: (tab, value) => set((s) => (s.badges[tab] === value ? s : { badges: { ...s.badges, [tab]: value } })),
}));

/** Le disque du prestataire selon le stade de l'accueil — pur, testé. */
export function providerDisc(stage: 'off' | 'on' | 'incoming' | 'busy' | 'gps' | 'net'): DiscKind {
  switch (stage) {
    case 'off': return 'go';
    case 'on': return 'stop';
    case 'busy': return 'busy';
    default: return 'hidden'; // incoming : la fiche prend l'écran ; gps / net : rien ne partirait
  }
}

/** Le disque du client : « + » au repos, la flèche quand une demande vit. */
export function clientDisc(hasLiveRequest: boolean): DiscKind {
  return hasLiveRequest ? 'track' : 'plus';
}
