// SplitPane : une colonne sur compact, deux volets sur regular, et au pliage
// rien ne se démonte — le master garde son état (spec § 4.3, moment 4).
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';

let mockRegular = false;
jest.mock('@/lib/layout/useLayoutClass', () => ({
  useLayoutClass: () => ({
    width: mockRegular ? 951 : 390, height: mockRegular ? 669 : 844,
    cls: mockRegular ? 'regular' : 'compact', isRegular: mockRegular, isLandscape: mockRegular,
    insets: { top: 0, bottom: 0, left: mockRegular ? 30 : 0, right: 0 },
  }),
}));

const { SplitPane } = require('@/lib/layout/SplitPane');

let mounts = 0;
function Master() {
  const [n] = useState(() => ++mounts);
  useEffect(() => {}, []);
  return <Text>master-{n}</Text>;
}

const tree = () => (
  <SplitPane master={<Master />} detail={mockRegular ? <Text>detail</Text> : null} placeholder={<Text>placeholder</Text>} />
);

beforeEach(() => { mounts = 0; mockRegular = false; });

describe('SplitPane', () => {
  it('compact : le master seul, le volet droit masqué', () => {
    const r = render(tree());
    expect(r.getByText('master-1')).toBeTruthy();
    expect(r.queryByText('detail')).toBeNull();
    expect(r.queryByText('placeholder', { includeHiddenElements: false })).toBeNull();
  });

  it('regular : master et détail côte à côte', () => {
    mockRegular = true;
    const r = render(tree());
    expect(r.getByText('master-1')).toBeTruthy();
    expect(r.getByText('detail')).toBeTruthy();
  });

  it('déplier puis replier ne remonte pas le master', async () => {
    const r = render(tree());
    mockRegular = true;
    await act(async () => { r.rerender(tree()); });
    expect(r.getByText('detail')).toBeTruthy();
    mockRegular = false;
    await act(async () => { r.rerender(tree()); });
    expect(r.getByText('master-1')).toBeTruthy();
    expect(mounts).toBe(1);
  });
});
