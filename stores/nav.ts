// stores/nav.ts — ce que la barre flottante porte, décidé par les écrans.
//
// Le disque détaché à droite de la barre porte l'action du moment, et suit sur
// tous les onglets : GO (hors ligne) · stop (en ligne) côté prestataire (en
// mission, la feuille porte l'action) ; « + » (demander) · flèche ambre (suivre) côté
// client. Les écrans le règlent (`setDisc`) ; la barre le rend ; l'appui
// remonte au réglage courant. Les badges suivent la même voie.
import { useEffect } from 'react';
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
  /** La barre s'efface (glisse sous l'écran) quand une fiche prend tout l'écran. */
  barHidden: boolean;
  setBarHidden: (hidden: boolean) => void;
  /** Verrous posés par les feuilles modales ouvertes dans un onglet : tant qu'il en reste un, la barre reste effacée. */
  barLocks: number;
  lockBar: () => void;
  unlockBar: () => void;
  badges: Badges;
  setBadge: (tab: keyof Badges, value: number | string | null) => void;
};

export const useNavStore = create<NavState>((set) => ({
  disc: { kind: 'hidden' },
  setDisc: (disc) => set({ disc }),
  barHidden: false,
  setBarHidden: (barHidden) => set((s) => (s.barHidden === barHidden ? s : { barHidden })),
  barLocks: 0,
  lockBar: () => set((s) => ({ barLocks: s.barLocks + 1 })),
  unlockBar: () => set((s) => ({ barLocks: Math.max(0, s.barLocks - 1) })),
  badges: {},
  setBadge: (tab, value) => set((s) => (s.badges[tab] === value ? s : { badges: { ...s.badges, [tab]: value } })),
}));

/** Le disque du prestataire selon le stade de l'accueil — pur, testé. */
export function providerDisc(stage: 'off' | 'on' | 'incoming' | 'busy' | 'gps' | 'net'): DiscKind {
  switch (stage) {
    case 'off': return 'go';
    case 'on': return 'stop';
    default: return 'hidden'; // incoming / busy : la fiche ou la feuille de mission porte l'action ; gps / net : rien ne partirait
  }
}

/** Le disque du client : « + » au repos, la flèche quand une demande vit. */
export function clientDisc(hasLiveRequest: boolean): DiscKind {
  return hasLiveRequest ? 'track' : 'plus';
}

/** Une feuille modale ouverte dans un onglet efface la barre le temps de sa vie. */
export function useHideBar(): void {
  const lock = useNavStore((s) => s.lockBar);
  const unlock = useNavStore((s) => s.unlockBar);
  useEffect(() => { lock(); return unlock; }, [lock, unlock]);
}

/** Version composant, à poser dans le contenu d'une feuille rendue inline. */
export function BarLock(): null {
  useHideBar();
  return null;
}
