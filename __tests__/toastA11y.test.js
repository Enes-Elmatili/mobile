// Un toast doit être entendu, pas seulement vu : VoiceOver n'annonce pas une
// vue qui apparaît. Il reste plus longtemps quand un lecteur d'écran est actif,
// et son bouton d'action reste une cible à part (atteignable au balayage).
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, act } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Feather: Object.assign(() => null, { glyphMap: {} }) }));
const mockDismiss = jest.fn();
jest.mock('@/lib/feedback/store', () => ({
  useFeedbackStore: (sel) => sel({ dismissToast: mockDismiss }),
}));

const { Toast } = require('@/components/feedback/Toast');

let announce;
function screenReader(on) {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(on);
}

beforeEach(() => {
  jest.useFakeTimers();
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('Toast — accessibilité', () => {
  it('annonce le message à l’apparition', async () => {
    screenReader(false);
    render(<Toast item={{ id: 1, type: 'error', message: 'Paiement refusé' }} />);
    await act(async () => {});
    expect(announce).toHaveBeenCalledWith('Paiement refusé');
  });

  it('toast de notification : titre et message annoncés ensemble', async () => {
    screenReader(false);
    render(<Toast item={{ id: 2, type: 'info', title: 'Devis reçu', message: '120 €' }} />);
    await act(async () => {});
    expect(announce).toHaveBeenCalledWith('Devis reçu. 120 €');
  });

  it('lecteur d’écran actif : au moins 6 s à l’écran (2,5 s sinon)', async () => {
    screenReader(true);
    const r = render(<Toast item={{ id: 3, type: 'success', message: 'Mission acceptée' }} />);
    await act(async () => {});
    act(() => jest.advanceTimersByTime(3000));
    // Toujours monté : la rétractation n'a pas commencé.
    expect(r.getByLabelText('Mission acceptée')).toBeTruthy();
    expect(mockDismiss).not.toHaveBeenCalled();
  });

  it('avec une action : le bouton est une cible distincte du texte', async () => {
    screenReader(false);
    const r = render(<Toast item={{ id: 4, type: 'info', title: 'Nouveau message', message: 'Karim', action: { label: 'Voir', onPress: jest.fn() } }} />);
    await act(async () => {});
    expect(r.getByLabelText('Voir')).toBeTruthy();
    expect(r.getByLabelText('Nouveau message. Karim')).toBeTruthy();
  });
});
