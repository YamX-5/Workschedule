import { newProfile } from '../domain/defaults';
import { THEME_IDS, type Profile } from '../domain/types';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Fill missing fields from `base`, keep known values whose type matches. Arrays are taken as-is. */
function fill<T>(base: T, raw: unknown): T {
  if (!isObj(base) || !isObj(raw)) {
    if (Array.isArray(base)) return (Array.isArray(raw) ? raw : base) as T;
    return (raw !== undefined && raw !== null && typeof raw === typeof base ? raw : base) as T;
  }
  const out: Record<string, unknown> = { ...raw };
  for (const k of Object.keys(base)) out[k] = fill((base as Record<string, unknown>)[k], raw[k]);
  return out as T;
}

/** Any stored blob -> a valid Profile. Never throws (Review Focus #4). */
export function migrate(raw: unknown): Profile {
  try {
    if (!isObj(raw)) return newProfile();
    const p = fill(newProfile(), raw);
    p.schemaVersion = 1;
    if (!THEME_IDS.includes(p.protocol.theme)) p.protocol.theme = 'darkness';
    return p;
  } catch {
    return newProfile();
  }
}
