import * as Haptics from 'expo-haptics';
import { feedback, __setSoundPlayer } from '../feedback';
import { useFeedbackStore } from '../store';
import { useFeedbackPrefs } from '../../../stores/feedbackPrefs';

const playMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  __setSoundPlayer(playMock);
  useFeedbackStore.setState({ toasts: [], celebration: null, confirm: null, actionSheet: null });
  useFeedbackPrefs.setState({ sound: true, haptics: true, animations: true, reduceMotion: false, hydrated: true });
});

test('celebration event fires all enabled channels', () => {
  feedback.event('quote_accepted');
  expect(Haptics.notificationAsync).toHaveBeenCalled();
  expect(playMock).toHaveBeenCalledWith('missionAccepted');
  expect(useFeedbackStore.getState().toasts).toHaveLength(1);
  expect(useFeedbackStore.getState().celebration).not.toBeNull();
});

test('haptics pref off skips haptic', () => {
  useFeedbackPrefs.setState({ haptics: false });
  feedback.event('tap_primary');
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
});

test('sound pref off skips sound but keeps toast', () => {
  useFeedbackPrefs.setState({ sound: false });
  feedback.event('quote_accepted');
  expect(playMock).not.toHaveBeenCalled();
  expect(useFeedbackStore.getState().toasts).toHaveLength(1);
});

test('animations off (or reduceMotion) downgrades celebration to toast only', () => {
  useFeedbackPrefs.setState({ animations: false });
  feedback.event('quote_accepted');
  expect(useFeedbackStore.getState().celebration).toBeNull();
  expect(useFeedbackStore.getState().toasts).toHaveLength(1);
});

test('confirm resolves true when confirmed', async () => {
  const p = feedback.confirm({ titleKey: 'x', confirmKey: 'ok', cancelKey: 'no' });
  useFeedbackStore.getState().confirm!.resolve(true);
  await expect(p).resolves.toBe(true);
});

test('actionSheet resolves the chosen index', async () => {
  const p = feedback.actionSheet({ options: [{ labelKey: 'a' }, { labelKey: 'b' }], cancelKey: 'c' });
  useFeedbackStore.getState().actionSheet!.resolve(1);
  await expect(p).resolves.toBe(1);
});

test('actionSheet resolves null on cancel', async () => {
  const p = feedback.actionSheet({ options: [{ labelKey: 'a' }], cancelKey: 'c' });
  useFeedbackStore.getState().actionSheet!.resolve(null);
  await expect(p).resolves.toBeNull();
});

test('success/info/error wrappers push the right toast type', () => {
  feedback.success('feedback.events.saved');
  feedback.error('feedback.events.error_generic');
  const types = useFeedbackStore.getState().toasts.map(t => t.type);
  expect(types).toEqual(['success', 'error']);
});
