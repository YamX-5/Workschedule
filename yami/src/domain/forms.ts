// Character forms: the avatar upgrades every 10 player levels, up to The Chosen One at LV 100.
// Form follows the CURRENT level, so slipping below a threshold loses the form; the best form ever reached is kept.

export interface Form { tier: number; minLevel: number; name: string; upgrade: string }

export const FORMS: Form[] = [
  { tier: 0, minLevel: 0, name: 'Dormant', upgrade: 'A shadow that has not woken.' },
  { tier: 1, minLevel: 10, name: 'Awakened', upgrade: 'Eyes light up blue.' },
  { tier: 2, minLevel: 20, name: 'Initiate', upgrade: 'A core of light in the chest.' },
  { tier: 3, minLevel: 30, name: 'Seeker', upgrade: 'The hooded cloak.' },
  { tier: 4, minLevel: 40, name: 'Vanguard', upgrade: 'Shoulder armour.' },
  { tier: 5, minLevel: 50, name: 'Warden', upgrade: 'A halo ring behind you.' },
  { tier: 6, minLevel: 60, name: 'Ascendant', upgrade: 'Shards of light orbit you.' },
  { tier: 7, minLevel: 70, name: 'Sovereign', upgrade: 'The crown.' },
  { tier: 8, minLevel: 80, name: 'Paragon', upgrade: 'Wings of light.' },
  { tier: 9, minLevel: 90, name: 'Transcendent', upgrade: 'Full aura; you leave the ground.' },
  { tier: 10, minLevel: 100, name: 'The Chosen One', upgrade: 'Body of light, double ring. Nothing stops you now.' },
];

export const formFor = (level: number): Form => [...FORMS].reverse().find(f => level >= f.minLevel)!;
export const nextForm = (level: number): Form | null => FORMS.find(f => f.minLevel > level) ?? null;
