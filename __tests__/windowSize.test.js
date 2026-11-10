/**
 * useWindowSize : la taille de fenêtre lue sur la vue native (SafeAreaProvider
 * racine) prime sur Dimensions. Sur le Duo, après un dépliage, Dimensions
 * restait à 466 pt (taille pliée) alors que la fenêtre faisait 951 : l'app se
 * croyait compacte et étalait la colonne d'iPhone à travers la charnière.
 */
const React = require('react');
const { Text } = require('react-native');
const { render } = require('@testing-library/react-native');

let mockFrame = { x: 0, y: 0, width: 951, height: 669 };
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaFrame: () => mockFrame }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 466, height: 678, scale: 3, fontScale: 1 }),
}));

const { WindowSizeProvider, useWindowSize } = require('../lib/layout/windowSize');

function Probe() {
  const { width, height } = useWindowSize();
  return React.createElement(Text, { testID: 'size' }, `${width}x${height}`);
}

describe('useWindowSize', () => {
  it('Duo déplié, Dimensions périmé (466) : la vue native (951) fait foi', () => {
    mockFrame = { x: 0, y: 0, width: 951, height: 669 };
    const r = render(React.createElement(WindowSizeProvider, null, React.createElement(Probe)));
    expect(r.getByTestId('size').props.children).toBe('951x669');
  });

  it('sans provider (rendu isolé) : retombe sur Dimensions', () => {
    const r = render(React.createElement(Probe));
    expect(r.getByTestId('size').props.children).toBe('466x678');
  });

  it('cadre natif pas encore mesuré (0×0) : retombe sur Dimensions', () => {
    mockFrame = { x: 0, y: 0, width: 0, height: 0 };
    const r = render(React.createElement(WindowSizeProvider, null, React.createElement(Probe)));
    expect(r.getByTestId('size').props.children).toBe('466x678');
  });
});
