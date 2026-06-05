import { useFeedbackStore } from '../store';

beforeEach(() => useFeedbackStore.setState({ toasts: [], celebration: null, confirm: null, actionSheet: null }));

test('pushToast appends a toast with id', () => {
  useFeedbackStore.getState().pushToast({ type: 'success', message: 'Hi' });
  const { toasts } = useFeedbackStore.getState();
  expect(toasts).toHaveLength(1);
  expect(toasts[0].message).toBe('Hi');
  expect(typeof toasts[0].id).toBe('number');
});

test('dismissToast removes by id', () => {
  const s = useFeedbackStore.getState();
  s.pushToast({ type: 'info', message: 'A' });
  const id = useFeedbackStore.getState().toasts[0].id;
  s.dismissToast(id);
  expect(useFeedbackStore.getState().toasts).toHaveLength(0);
});

test('toast queue is capped at 3', () => {
  const s = useFeedbackStore.getState();
  for (let i = 0; i < 5; i++) s.pushToast({ type: 'info', message: `m${i}` });
  expect(useFeedbackStore.getState().toasts.length).toBeLessThanOrEqual(3);
});

test('setCelebration / clearCelebration', () => {
  const s = useFeedbackStore.getState();
  s.setCelebration({ kind: 'burst', title: 'Yes!' });
  expect(useFeedbackStore.getState().celebration?.title).toBe('Yes!');
  s.clearCelebration();
  expect(useFeedbackStore.getState().celebration).toBeNull();
});

test('setActionSheet / clearActionSheet', () => {
  const s = useFeedbackStore.getState();
  let chosen: number | null = -99;
  s.setActionSheet({
    options: [{ label: 'A' }, { label: 'B', destructive: true }],
    cancelLabel: 'Cancel',
    resolve: (i) => { chosen = i; },
  });
  expect(useFeedbackStore.getState().actionSheet?.options).toHaveLength(2);
  useFeedbackStore.getState().actionSheet!.resolve(1);
  expect(chosen).toBe(1);
  s.clearActionSheet();
  expect(useFeedbackStore.getState().actionSheet).toBeNull();
});

test('setConfirm resolves a superseded pending confirm with false', () => {
  let firstResolved: boolean | null = null;
  useFeedbackStore.getState().setConfirm({ title: 'A', confirmLabel: 'ok', cancelLabel: 'no', destructive: false, resolve: (v) => { firstResolved = v; } });
  useFeedbackStore.getState().setConfirm({ title: 'B', confirmLabel: 'ok', cancelLabel: 'no', destructive: false, resolve: () => {} });
  expect(firstResolved).toBe(false);
});

test('setActionSheet resolves a superseded pending action sheet with null', () => {
  let firstResolved: number | null | undefined = undefined;
  useFeedbackStore.getState().setActionSheet({ options: [{ label: 'A' }], cancelLabel: 'c', resolve: (v) => { firstResolved = v; } });
  useFeedbackStore.getState().setActionSheet({ options: [{ label: 'B' }], cancelLabel: 'c', resolve: () => {} });
  expect(firstResolved).toBeNull();
});
