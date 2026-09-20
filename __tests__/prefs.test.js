// Réglages de l'app (stores/prefs) : thème et langue persistés, appliqués sur place.
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'fr', changeLanguage: jest.fn(() => Promise.resolve()) } }));
const AsyncStorage = require('@react-native-async-storage/async-storage');
const i18n = require('@/lib/i18n').default;
const { usePrefs, PREFS_KEY, currentLanguage } = require('@/stores/prefs');

beforeEach(async () => { await AsyncStorage.clear(); usePrefs.setState({ theme: 'system', language: null, hydrated: false }); i18n.language = 'fr'; i18n.changeLanguage.mockClear(); });

describe('stores/prefs', () => {
  it('le thème se persiste', async () => {
    usePrefs.getState().setTheme('dark');
    expect(usePrefs.getState().theme).toBe('dark');
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse(await AsyncStorage.getItem(PREFS_KEY))).toEqual({ theme: 'dark', language: null });
  });
  it('la langue change i18n tout de suite et se persiste', async () => {
    usePrefs.getState().setLanguage('nl');
    expect(i18n.changeLanguage).toHaveBeenCalledWith('nl');
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse(await AsyncStorage.getItem(PREFS_KEY))).toEqual({ theme: 'system', language: 'nl' });
  });
  it('hydrate relit les deux et applique la langue ; une valeur inconnue retombe sur le défaut', async () => {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ theme: 'light', language: 'en' }));
    await usePrefs.getState().hydrate();
    expect(usePrefs.getState()).toMatchObject({ theme: 'light', language: 'en', hydrated: true });
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en');
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ theme: 'neon', language: 'xx' }));
    await usePrefs.getState().hydrate();
    expect(usePrefs.getState()).toMatchObject({ theme: 'system', language: null });
  });
  it('currentLanguage : le choix sinon celle de i18n', () => {
    i18n.language = 'nl-BE';
    expect(currentLanguage()).toBe('nl');
    i18n.language = 'de';
    expect(currentLanguage()).toBe('fr');
  });
});
