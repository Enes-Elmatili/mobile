// components/provider/cockpit/useCockpitNavBar.ts — ce que l'accueil
// prestataire règle sur la barre flottante (stores/nav) : le disque (GO · stop
// · rien), la barre effacée sous la fiche ou la feuille, et les badges.
import { useEffect, useMemo } from 'react';
import type { TFunction } from 'i18next';
import { useNavStore, providerDisc } from '@/stores/nav';
import type { CockpitStage } from '@/lib/cockpit/stage';
import type { Reminder } from '@/lib/cockpit/day';

type Args = {
  loading: boolean;
  stage: CockpitStage;
  reminders: Reminder[];
  onToggleOnline: () => void;
  t: TFunction;
};

export function useCockpitNavBar({ loading, stage, reminders, onToggleOnline, t }: Args) {
  // ─── Le disque de la barre flottante : GO · stop · flèche vers la mission ──
  // L'écran règle le disque ; la barre le rend ; il suit sur tous les onglets.
  const setDisc = useNavStore((st) => st.setDisc);
  const discKind = providerDisc(stage);
  const discLabel = discKind === 'go' ? t('cockpit.go_a11y') : discKind === 'stop' ? t('cockpit.stop_a11y') : undefined;
  useEffect(() => {
    if (loading) return;
    setDisc({ kind: discKind, onPress: discKind === 'hidden' ? undefined : onToggleOnline, label: discLabel });
  }, [loading, discKind, discLabel, onToggleOnline, setDisc]);
  // Quitter l'accueil prestataire (déconnexion, changement de rôle) : le disque s'efface.
  useEffect(() => () => setDisc({ kind: 'hidden' }), [setDisc]);
  // La fiche « elle est pour vous » prend l'écran : la barre s'efface avec le reste.
  const setBarHidden = useNavStore((st) => st.setBarHidden);
  useEffect(() => { setBarHidden(!loading && (stage === 'incoming' || stage === 'busy')); }, [loading, stage, setBarHidden]);
  useEffect(() => () => setBarHidden(false), [setBarHidden]);
  // Les badges de la barre : devis à rédiger sur Missions, virements à configurer sur Profil.
  const setBadge = useNavStore((st) => st.setBadge);
  const quotesToWrite = useMemo(() => reminders.filter((r) => r.kind === 'quote').length, [reminders]);
  const payoutsTodo = useMemo(() => reminders.some((r) => r.kind === 'payouts'), [reminders]);
  const toTake = useNavStore((st) => st.toTake);
  useEffect(() => { setBadge('missions', (quotesToWrite + toTake) || null); }, [quotesToWrite, toTake, setBadge]);
  useEffect(() => { setBadge('profile', payoutsTodo ? '!' : null); }, [payoutsTodo, setBadge]);
}
