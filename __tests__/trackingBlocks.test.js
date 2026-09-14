// Les briques du suivi (components/tracking) : elles rendent ce que le stade
// leur donne, sans couleur en dur ni texte en dur.
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost/api';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k, o) => (o && typeof o === 'object' ? `${k}:${Object.values(o).join(',')}` : k) }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('@expo/vector-icons', () => { const { Text } = require('react-native'); return { Feather: (p) => <Text>{p.name}</Text> }; });
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: ({ children }) => children }));
jest.mock('expo-image', () => { const { View } = require('react-native'); return { Image: (p) => <View {...p} /> }; });

// Import direct des briques (l'index tire aussi DoneContent, qui charge la
// pile socket / audio native, hors de portée d'un test de rendu).
const { StageHeader } = require('@/components/tracking/StageHeader');
const { EtaHero } = require('@/components/tracking/EtaHero');
const { ProviderRow, providerFirstName } = require('@/components/tracking/ProviderRow');
const { PinCard } = require('@/components/tracking/PinCard');
const { RequestRow } = require('@/components/tracking/RequestRow');
const { QuoteSteps } = require('@/components/tracking/QuoteSteps');
const { WorkTimeline } = require('@/components/tracking/WorkTimeline');
const { MoneyLine } = require('@/components/tracking/MoneyLine');

const brief = {
  id: 7, status: 'ACCEPTED',
  service: { name: 'Fuite d’eau', categoryName: 'Plomberie', categorySlug: 'plomberie', slug: 'fuite-eau', pricingMode: 'fixed_forfait', durationMinutes: 60 },
  schedule: { mode: 'now', at: null, urgent: false },
  place: { address: 'Avenue Louise 1, 1050 Ixelles', lat: 50.8, lng: 4.36, distanceKm: null },
  access: null, client: null,
  money: { gross: 89, net: null, calloutFee: null, pricingMode: 'fixed_forfait' },
  timeline: { createdAt: null, acceptedAt: null, completedAt: null },
  photos: [{ id: 1, url: '/uploads/a.jpg', shotKey: 'leak', width: 100, height: 100 }, { id: 2, url: '/uploads/b.jpg', shotKey: null, width: 100, height: 100 }],
  description: '', provider: null,
};

describe('tracking blocks', () => {
  it('StageHeader affiche kicker, titre, sous-titre', () => {
    const r = render(<StageHeader stageKey="x" kicker="EN ROUTE" title="Yassine a accepté" sub="Il se met en route." />);
    expect(r.getByText('EN ROUTE')).toBeTruthy();
    expect(r.getByText('Yassine a accepté')).toBeTruthy();
    expect(r.getByText('Il se met en route.')).toBeTruthy();
  });
  it('EtaHero : minutes et km avec GPS, « départ confirmé » sans', () => {
    const withGps = render(<EtaHero etaMin={4} distanceKm={1.14} hasGps />);
    expect(withGps.getByText(/tracking.min · 1,1 tracking.km/)).toBeTruthy();
    const noGps = render(<EtaHero etaMin={null} distanceKm={null} hasGps={false} />);
    expect(noGps.getByText('tracking.no_gps_title')).toBeTruthy();
  });
  it('ProviderRow : nom propre, note · missions, message et appel', () => {
    const onMessage = jest.fn(); const onCall = jest.fn();
    const r = render(<ProviderRow provider={{ id: 1, name: 'Yassine Kaddour', avgRating: 4.9, jobsCompleted: 128 }} unread={2} onMessage={onMessage} onCall={onCall} />);
    expect(r.getByText('Yassine Kaddour')).toBeTruthy();
    expect(r.getByText('4.9 · mission.missions_count:128')).toBeTruthy();
    fireEvent.press(r.getByLabelText('tracking.message:Yassine Kaddour'));
    fireEvent.press(r.getByLabelText('tracking.call:Yassine Kaddour'));
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(r.getByText('2')).toBeTruthy();
    expect(providerFirstName({ name: 'Yassine Kaddour' })).toBe('Yassine');
  });
  it('PinCard : compact avec consigne, héros chiffre par chiffre', () => {
    const c = render(<PinCard code="4827" mode="compact" name="Yassine" />);
    expect(c.getByText('4827')).toBeTruthy();
    expect(c.getByText('tracking.pin_compact:Yassine')).toBeTruthy();
    const h = render(<PinCard code="4827" mode="hero" name="Yassine" />);
    expect(h.getByText('4')).toBeTruthy(); expect(h.getByText('7')).toBeTruthy();
    expect(h.getByText('tracking.at_door_sub')).toBeTruthy();
  });
  it('RequestRow : replié puis déplié au tap', () => {
    const r = render(<RequestRow brief={brief} amount={89} amountCaption="TTC" />);
    expect(r.getByText('tracking.your_request')).toBeTruthy();
    expect(r.getByText('Fuite d’eau · tracking.photos_n:2')).toBeTruthy();
    expect(r.queryByText('MISSION.YOUR_REQUEST')).toBeNull();
    fireEvent.press(r.getByLabelText('tracking.your_request'));
    // La fiche dépliée : libellé « VOTRE DEMANDE » et les photos.
    expect(r.getByText('MISSION.YOUR_REQUEST')).toBeTruthy();
    expect(r.getAllByRole('imagebutton').length).toBe(2);
  });
  it('QuoteSteps : deux faites, une en cours, une à venir', () => {
    const r = render(<QuoteSteps calloutFee={29} current="diag" />);
    expect(r.getByText(/tracking.quote_step_paid:29/)).toBeTruthy();
    expect(r.getByText('tracking.quote_step_diag')).toBeTruthy();
    expect(r.getByText('tracking.quote_step_72h')).toBeTruthy();
  });
  it('WorkTimeline : la fin prévue est précédée d’un tilde', () => {
    const r = render(<WorkTimeline rows={[{ key: 'a', time: '14:32', label: 'Démarrée' }, { key: 'b', time: '15:30', label: 'Fin prévue', next: true }]} />);
    expect(r.getByText('14:32')).toBeTruthy();
    expect(r.getByText('~15:30')).toBeTruthy();
  });
  it('MoneyLine : montant, libellé, promesse', () => {
    const r = render(<MoneyLine amount={89} caption="TTC" promise="Prix fixe." />);
    expect(r.getByText(/89/)).toBeTruthy();
    expect(r.getByText('Prix fixe.')).toBeTruthy();
  });
});
