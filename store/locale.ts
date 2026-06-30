/**
 * App language (zustand, persisted). Thai is the default; the language screen
 * flips it and the `useT` hook re-renders consumers.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

export type Lang = 'th' | 'en';

export type LocaleState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

export const useLocale = create<LocaleState>()(
  persist(
    (set) => ({
      lang: 'th',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'oofoo-locale', storage: zustandStorage },
  ),
);
