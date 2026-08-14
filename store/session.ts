/**
 * Session teardown — wipe everything that belongs to one customer.
 *
 * The bug this exists for: `logout()` cleared the auth store and nothing else.
 * Four stores persist to device storage (`oofoo-address`, `oofoo-order`,
 * `oofoo-cart`, plus in-memory chat/notifications), so the next person to sign
 * in on the same browser or phone opened the app holding the previous
 * customer's saved addresses — recipient name, phone number, house address, map
 * pin — and their order history. On the web store that is one shared laptop
 * away from a real disclosure, and the LINE login makes switching accounts a
 * two-tap operation.
 *
 * Called from three places, because logout is not the only way the identity
 * changes:
 *   - `logout()`               — the deliberate case
 *   - auth event with no session — expiry, revocation, sign-out elsewhere
 *   - a session whose user id differs from the one already loaded — account
 *     switch with no sign-out in between (Supabase can hand us a new session
 *     directly, e.g. the LINE magiclink redeem)
 *
 * Deliberately NOT cleared: `oofoo-locale` (UI language) and `oofoo-mode`
 * (delivery vs online). They are device preferences, carry nothing personal,
 * and resetting them would just make the app feel amnesiac.
 */

import { useAddress } from '@/store/address';
import { useCart } from '@/store/cart';
import { useChat } from '@/store/chat';
import { useNotifications } from '@/store/notifications';
import { useOrder } from '@/store/order';

/** Drop every trace of the signed-out customer from this device's memory. */
export function clearUserScopedState(): void {
  useAddress.getState().reset();
  useCart.getState().reset();
  useOrder.getState().reset();
  useNotifications.getState().reset();
  useChat.getState().reset();
}
