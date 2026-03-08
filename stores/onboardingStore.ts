import { create } from 'zustand';

type Role = 'CLIENT' | 'PROVIDER' | null;

interface OnboardingStore {
  // Rôle
  role: Role;
  setRole: (role: Role) => void;

  // Commun
  email: string;
  password: string;
  setCredentials: (email: string, password: string) => void;

  // Provider uniquement
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  radiusKm: number;
  selectedSkills: string[];
  uploadedDocs: Record<string, string>; // type → uri
  quizPassed: boolean;
  stripeAccountId: string | null;

  setIdentity: (firstName: string, lastName: string, phone: string) => void;
  setZone: (city: string, radiusKm: number) => void;
  setSkills: (skills: string[]) => void;
  setDocumentUploaded: (type: string, uri: string) => void;
  setQuizPassed: (passed: boolean) => void;
  setStripeAccountId: (id: string) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  role: null,
  email: '', password: '',
  firstName: '', lastName: '', phone: '',
  city: 'Bruxelles', radiusKm: 10,
  selectedSkills: [],
  uploadedDocs: {},
  quizPassed: false,
  stripeAccountId: null,

  setRole: (role) => set({ role }),
  setCredentials: (email, password) => set({ email, password }),
  setIdentity: (firstName, lastName, phone) => set({ firstName, lastName, phone }),
  setZone: (city, radiusKm) => set({ city, radiusKm }),
  setSkills: (selectedSkills) => set({ selectedSkills }),
  setDocumentUploaded: (type, uri) =>
    set((s) => ({ uploadedDocs: { ...s.uploadedDocs, [type]: uri } })),
  setQuizPassed: (quizPassed) => set({ quizPassed }),
  setStripeAccountId: (stripeAccountId) => set({ stripeAccountId }),
  reset: () => set({
    role: null, email: '', password: '',
    firstName: '', lastName: '', phone: '',
    city: 'Bruxelles', radiusKm: 10,
    selectedSkills: [], uploadedDocs: {},
    quizPassed: false, stripeAccountId: null,
  }),
}));
