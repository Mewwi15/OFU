/**
 * Shared persistence backend for zustand stores.
 *
 * Wraps AsyncStorage as a JSON storage so each store can opt in with the
 * `persist` middleware. Keep persisted state to plain data (use `partialize`
 * to drop action functions) and bump a store's `version` if its shape changes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

export const zustandStorage = createJSONStorage(() => AsyncStorage);
