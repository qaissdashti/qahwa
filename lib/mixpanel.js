'use client';

// ============================================================
// Mixpanel analytics — thin wrapper around mixpanel-browser.
//
// All exports are SAFE no-ops when NEXT_PUBLIC_MIXPANEL_TOKEN is missing
// (local dev without a token, previews, etc.) — nothing throws, nothing
// is sent. Client-only: import these from 'use client' components.
//
// Super properties (sent with every event) are registered at init:
//   platform: 'web'
//   language: 'ar' | 'en'  (re-registered by MixpanelProvider on change)
//
// PII policy: never pass phone numbers, civil IDs, or IBANs. Names/emails
// are allowed for identifyUser() only.
// ============================================================

import mixpanel from 'mixpanel-browser';

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
let started = false;

function ready() {
  return started && !!TOKEN;
}

// Initialise once. Guarded so repeated calls (e.g. effect re-runs, HMR)
// are harmless. No token → stays uninitialised and every helper no-ops.
export function initMixpanel() {
  if (started || !TOKEN || typeof window === 'undefined') return;
  try {
    mixpanel.init(TOKEN, {
      track_pageview: true,        // automatic page-view tracking
      persistence: 'localStorage',
      ignore_dnt: false,
    });
    mixpanel.register({ platform: 'web' });
    started = true;
  } catch {
    /* never let analytics break the app */
  }
}

// Register/update super properties (merged into every subsequent event).
export function registerSuperProps(props) {
  if (!ready() || !props) return;
  try { mixpanel.register(props); } catch { /* no-op */ }
}

export function trackEvent(name, props = {}) {
  if (!ready()) return;
  try { mixpanel.track(name, props); } catch { /* no-op */ }
}

// Tie subsequent events to a known user. traits go to the People profile.
// Only call for authenticated creators/admins — never for anonymous
// supporters on the tipping page.
export function identifyUser(userId, traits = {}) {
  if (!ready() || !userId) return;
  try {
    mixpanel.identify(String(userId));
    if (traits && Object.keys(traits).length) mixpanel.people.set(traits);
  } catch { /* no-op */ }
}

// Clear identity on logout so the next user starts a fresh distinct_id.
export function resetUser() {
  if (!ready()) return;
  try { mixpanel.reset(); } catch { /* no-op */ }
}
