import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFeedbackPrefs, FEEDBACK_PREFS_KEY } from '../feedbackPrefs';

beforeEach(async () => {
  await AsyncStorage.clear();
  act(() => useFeedbackPrefs.setState({ sound: true, haptics: true, animations: true, reduceMotion: false, hydrated: false }));
});

test('defaults are all-on', () => {
  const s = useFeedbackPrefs.getState();
  expect(s.sound).toBe(true);
  expect(s.haptics).toBe(true);
  expect(s.animations).toBe(true);
  expect(s.reduceMotion).toBe(false);
});

test('setPref persists to AsyncStorage', async () => {
  await act(async () => { useFeedbackPrefs.getState().setPref('sound', false); });
  const raw = await AsyncStorage.getItem(FEEDBACK_PREFS_KEY);
  expect(JSON.parse(raw!).sound).toBe(false);
});

test('hydrate loads persisted prefs', async () => {
  await AsyncStorage.setItem(FEEDBACK_PREFS_KEY, JSON.stringify({ sound: false, haptics: true, animations: false }));
  await act(async () => { await useFeedbackPrefs.getState().hydrate(); });
  const s = useFeedbackPrefs.getState();
  expect(s.sound).toBe(false);
  expect(s.animations).toBe(false);
  expect(s.hydrated).toBe(true);
});
