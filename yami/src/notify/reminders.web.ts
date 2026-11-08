import type { Profile } from '../domain/types';

// ponytail: web has no scheduled notifications here; the PWA relies on the Status screen. Add web push if needed.
export async function syncReminders(_p: Profile, _now = new Date()) {}
