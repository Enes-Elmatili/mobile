// Ligne de mission : glisser vers la droite (volet vert « Accepter ») accepte,
// vers la gauche (volet ambre « Refuser ») refuse. ReanimatedSwipeable passe
// le sens du glissé à onSwipeableOpen ('right' quand le volet gauche s'ouvre).
import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('@expo/vector-icons', () => { const { Text } = require('react-native'); return { Feather: (p) => <Text>{p.name}</Text> }; });
jest.mock('expo-image', () => { const { View } = require('react-native'); return { Image: (p) => <View {...p} /> }; });
// RNTL 14 (test-renderer) n'expose que les éléments hôtes : le Swipeable est
// remplacé par une View qui porte onSwipeableOpen, pour le déclencher à la main.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Swipeable = React.forwardRef(({ onSwipeableOpen, children }, ref) => {
    React.useImperativeHandle(ref, () => ({ close: () => {}, reset: () => {}, openLeft: () => {}, openRight: () => {} }));
    return <View testID="swipeable" onSwipeableOpen={onSwipeableOpen}>{children}</View>;
  });
  return { __esModule: true, default: Swipeable };
});

const { MissionRow } = require('@/components/mission/MissionRow');

const brief = {
  id: 7, status: 'PUBLISHED',
  service: { name: 'Fuite d’eau', categoryName: 'Plomberie', categorySlug: 'plomberie', slug: 'fuite-eau', pricingMode: 'fixed_forfait', durationMinutes: 60 },
  schedule: { mode: 'now', start: null, urgent: false },
  place: { address: 'Avenue Louise 1, 1050 Ixelles', lat: 50.8, lng: 4.36, distanceKm: 1.2, etaMinutes: 6, floor: null, access: null, parking: null },
  money: { pricingMode: 'fixed_forfait', gross: 89, net: 71.2, calloutFee: null, commissionRate: 0.2 },
  client: { name: 'Marie', language: 'fr', missionsCount: 2, rating: null },
  photos: [], description: '',
};

async function open(direction, accept, refuse) {
  const r = await render(<MissionRow brief={brief} onPress={() => {}} onSwipeAccept={accept} onSwipeRefuse={refuse} />);
  const swipeable = r.getByTestId('swipeable');
  await act(async () => {
    swipeable.props.onSwipeableOpen(direction);
    await new Promise((res) => setTimeout(res, 5));
  });
}

describe('MissionRow — glissés', () => {
  it('vers la droite → accepter', async () => {
    const accept = jest.fn(); const refuse = jest.fn();
    await open('right', accept, refuse);
    expect(accept).toHaveBeenCalledTimes(1);
    expect(refuse).not.toHaveBeenCalled();
  });
  it('vers la gauche → refuser', async () => {
    const accept = jest.fn(); const refuse = jest.fn();
    await open('left', accept, refuse);
    expect(refuse).toHaveBeenCalledTimes(1);
    expect(accept).not.toHaveBeenCalled();
  });
});
