/**
 * Canonical legal-page URL — the admin web app hosts the real, kept-in-sync
 * privacy policy (admin/src/pages/PrivacyPolicy.tsx, required by both stores'
 * Data Safety / privacy-link forms). One constant so the login consent line,
 * the in-app legal summary, and the desktop web footer can't drift apart the
 * way the footer-only link did before this file existed.
 */
export const PRIVACY_URL = 'https://ofu-ivory.vercel.app/privacy';
export const DELETE_ACCOUNT_URL = 'https://ofu-ivory.vercel.app/delete-account';
