import { useFeedbackStore } from '../store';

beforeEach(() => useFeedbackStore.setState({ toasts: [], celebration: null, confirm: null }));

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
