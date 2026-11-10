/**
 * Où se pose un bottom sheet : toute la largeur sur iPhone ; sur le Duo
 * déplié, une seule page (la plus large), jamais à cheval sur le pli ni sous
 * le rail système.
 */
jest.mock('react-native-safe-area-context', () => ({}));
jest.mock('../lib/layout/hinge', () => ({ useHinge: () => undefined }));
const { sheetPageFor, sheetMarginsFor, SHEET_MAX_WIDTH } = require('../lib/layout/sheetFrame');

// Duo déplié, mesuré : fenêtre 951 pt, pli 455,5 → 495,5, rail de 84 pt.
const FOLD = { start: 455.5, end: 495.5 };

describe('sheetPageFor', () => {
  it('iPhone : toute la largeur', () => {
    expect(sheetPageFor({ windowWidth: 402, isRegular: false, container: { x: 0, width: 402 }, insets: { left: 0, right: 0 }, fold: null }))
      .toEqual({ start: 0, end: 402 });
  });

  it('Duo, rail à droite (vu depuis la racine) : page droite, celle du détail, jusqu’au rail', () => {
    expect(sheetPageFor({ windowWidth: 951, isRegular: true, container: { x: 0, width: 951 }, insets: { left: 0, right: 84 }, fold: FOLD }))
      .toEqual({ start: 495.5, end: 867 });
  });

  it('Duo, rail à droite (vu depuis une scène InsetScope) : même page', () => {
    expect(sheetPageFor({ windowWidth: 951, isRegular: true, container: { x: 0, width: 867 }, insets: { left: 0, right: 0 }, fold: FOLD }))
      .toEqual({ start: 495.5, end: 867 });
  });

  it('page droite trop étroite pour un sheet de téléphone : la plus large', () => {
    expect(sheetPageFor({ windowWidth: 951, isRegular: true, container: { x: 0, width: 951 }, insets: { left: 0, right: 200 }, fold: FOLD }))
      .toEqual({ start: 0, end: 455.5 });
  });

  it('Duo, rail à gauche : page droite', () => {
    expect(sheetPageFor({ windowWidth: 951, isRegular: true, container: { x: 0, width: 951 }, insets: { left: 84, right: 0 }, fold: FOLD }))
      .toEqual({ start: 495.5, end: 951 });
  });

  it('regular sans pli connu : colonne centrée de largeur bornée', () => {
    const p = sheetPageFor({ windowWidth: 1000, isRegular: true, container: { x: 0, width: 1000 }, insets: { left: 0, right: 0 }, fold: null });
    expect(p.end - p.start).toBe(SHEET_MAX_WIDTH);
    expect(p.start).toBe((1000 - SHEET_MAX_WIDTH) / 2);
  });
});

describe('sheetMarginsFor', () => {
  it('modal (portail racine) : marges en repère fenêtre, le rail exclu', () => {
    expect(sheetMarginsFor({ windowWidth: 951, isRegular: true, container: { x: 0, width: 867 }, insets: { left: 0, right: 0 }, fold: FOLD, modal: true }))
      .toEqual({ marginLeft: 495.5, marginRight: 84 });
  });

  it('sheet posé dans la scène : marges en repère du conteneur', () => {
    expect(sheetMarginsFor({ windowWidth: 951, isRegular: true, container: { x: 0, width: 867 }, insets: { left: 0, right: 0 }, fold: FOLD, modal: false }))
      .toEqual({ marginLeft: 495.5, marginRight: 0 });
  });

  it('iPhone : aucune marge', () => {
    expect(sheetMarginsFor({ windowWidth: 402, isRegular: false, container: { x: 0, width: 402 }, insets: { left: 0, right: 0 }, fold: null, modal: true }))
      .toEqual({ marginLeft: 0, marginRight: 0 });
  });
});
