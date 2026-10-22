// SplitPane (spec mouvement § 4.3 et § 7) : une colonne sur compact, deux volets
// sur regular — et au pliage/dépliage du Duo, le master n'est JAMAIS remonté
// (sélection, scroll et brouillons survivent).
const React = require('react');
const { Text } = require('react-native');
const { render } = require('@testing-library/react-native');

let mockRegular = false;
jest.mock('../lib/layout/useLayoutClass', () => ({
  useLayoutClass: () => ({
    isRegular: mockRegular,
    cls: mockRegular ? 'regular' : 'compact',
    width: mockRegular ? 951 : 466,
    height: mockRegular ? 669 : 678,
    isLandscape: mockRegular,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  }),
}));

const { SplitPane } = require('../lib/layout/SplitPane');

let mounts = 0;
function Master() {
  React.useEffect(() => { mounts += 1; }, []);
  return React.createElement(Text, null, 'master');
}
const ui = () => React.createElement(SplitPane, {
  master: React.createElement(Master),
  detail: React.createElement(Text, null, 'detail'),
});

describe('SplitPane', () => {
  beforeEach(() => { mounts = 0; mockRegular = false; });

  it('compact : le master seul', async () => {
    const r = await render(ui());
    expect(r.getByText('master')).toBeTruthy();
    expect(r.queryByText('detail')).toBeNull();
  });

  it('regular : le master et le détail', async () => {
    mockRegular = true;
    const r = await render(ui());
    expect(r.getByText('master')).toBeTruthy();
    expect(r.getByText('detail')).toBeTruthy();
  });

  it('déplier puis replier ne remonte pas le master', async () => {
    const r = await render(ui());
    expect(mounts).toBe(1);
    mockRegular = true;
    await r.rerender(ui());
    expect(r.getByText('detail')).toBeTruthy();
    mockRegular = false;
    await r.rerender(ui());
    expect(r.queryByText('detail')).toBeNull();
    expect(mounts).toBe(1);
  });
});
