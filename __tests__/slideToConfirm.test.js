// Le curseur « glisser pour accepter » (jumeau JS du geste) : un glissé
// jusqu'au bout appelle onConfirm une fois, un glissé court revient sans rien
// appeler. Le code réellement exécuté sur le thread UI est couvert par
// __tests__/workletClosure.test.js.
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('@expo/vector-icons', () => { const { Text } = require('react-native'); return { Feather: (p) => <Text>{p.name}</Text> }; });

const { SlideToConfirm } = require('@/components/ui/SlideToConfirm');

// Gesture Handler applique la nouvelle config du geste (largeur de piste
// connue après onLayout) dans un setImmediate : on le laisse passer.
const flush = () => new Promise((r) => setImmediate(r));

async function mount(onConfirm, width = 350) {
  const r = render(<SlideToConfirm onConfirm={onConfirm} />);
  const track = r.getByLabelText('common.slide_to_accept');
  await act(async () => {
    track.props.onLayout({ nativeEvent: { layout: { width, height: 58, x: 0, y: 0 } } });
    await flush(); await flush();
  });
  return r;
}

describe('SlideToConfirm', () => {
  it('appelle onConfirm une fois après un glissé jusqu au bout', async () => {
    const onConfirm = jest.fn();
    await mount(onConfirm);
    fireGestureHandler(getByGestureTestId('slide-to-confirm'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: 60 },
      { translationX: 200 },
      { translationX: 298, velocityX: 0 },
      { state: State.END, translationX: 298, velocityX: 0 },
    ]);
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('confirme un flick lancé avant le bout', async () => {
    const onConfirm = jest.fn();
    await mount(onConfirm);
    fireGestureHandler(getByGestureTestId('slide-to-confirm'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: 40 },
      { translationX: 180, velocityX: 1500 },
      { state: State.END, translationX: 180, velocityX: 1500 },
    ]);
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('ne confirme pas un glissé court', async () => {
    const onConfirm = jest.fn();
    await mount(onConfirm);
    fireGestureHandler(getByGestureTestId('slide-to-confirm'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: 40 },
      { state: State.END, translationX: 80, velocityX: 0 },
    ]);
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
