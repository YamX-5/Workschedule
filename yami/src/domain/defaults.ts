import type { Profile, Protocol, Quest, StatId, StatState } from './types';

const DAILY = [0, 1, 2, 3, 4, 5, 6];

export function defaultProtocol(): Protocol {
  return {
    capMin: 120,
    reserveMin: 30,
    windDown: '22:30',
    sleepTarget: '23:00',
    fajrAlarm: '05:30',
    preset: 'balanced',
    neverMissTwice: true,
    graceUntilFajr: true,
    reminderLeadMin: 30,
    apps: {
      Instagram: 'watched', TikTok: 'watched', YouTube: 'watched', Snapchat: 'watched', X: 'watched',
      'Meta Business Suite': 'work',
      Phone: 'always', Messages: 'always', Maps: 'always', Quran: 'always', Bank: 'always',
    },
    workWindows: [{ from: '13:00', to: '13:20' }, { from: '18:00', to: '18:20' }],
    city: 'Amman',
    coords: { lat: 31.95, lng: 35.93 },
    calcMethod: 'MuslimWorldLeague',
    theme: 'darkness',
  };
}

/** The prayer quest. Its id must stay 'salah': the Gates screen reports to it. */
export const prayerQuest = (stat: StatId): Quest =>
  ({ id: 'salah', title: 'Salah', stat, xp: 50, type: 'count', target: 5, days: DAILY, deadline: '23:00' });

/** The owner's original five quests. New profiles start empty; tests use these through seededProfile(). */
export function seedQuests(): Quest[] {
  return [
    { id: 'salah', title: 'Salah', stat: 'deen', xp: 50, type: 'count', target: 5, days: DAILY, deadline: '23:00' },
    { id: 'rehab', title: 'Knee rehab', stat: 'body', xp: 50, type: 'count', target: 5, days: DAILY, deadline: '21:00' },
    { id: 'perio', title: 'Perio ch.4', stat: 'mind', xp: 35, type: 'check', target: 1, days: DAILY, deadline: '23:00' },
    { id: 'ship', title: 'Ship academy landing page', stat: 'craft', xp: 50, type: 'check', target: 1, days: DAILY, deadline: '23:00' },
    { id: 'sleep', title: 'Asleep by 23:00', stat: 'rest', xp: 35, type: 'check', target: 1, days: DAILY, deadline: '23:00' },
  ];
}

export const SEED_STAT_NAMES: Record<StatId, string> = { deen: 'DEEN', body: 'BODY', mind: 'MIND', craft: 'CRAFT', rest: 'REST' };
// Blank names: the player names their own stats in onboarding.
const stat = (): StatState => ({ level: 1, xp: 0, enabled: true, name: '' });

export function newProfile(): Profile {
  return {
    schemaVersion: 1,
    name: 'Player',
    title: 'The Protagonist',
    day: 1,
    honor: 50,
    stats: { deen: stat(), body: stat(), mind: stat(), craft: stat(), rest: stat() },
    quests: [],
    tasks: [],
    reports: [],
    judgedDays: [],
    debuffs: [],
    corruptionCarryMin: 0,
    usage: { dayKey: '', usedMin: 0, reserveUsedMin: 0, reserveOpen: false, reserveReasons: [], earnedMin: 0 },
    fallRecord: [],
    scars: 0,
    onboarded: false,
    tutorialDone: false,
    startKey: '',
    protocol: defaultProtocol(),
    shards: 0,
    dreams: [],
    rewards: [],
    claims: [],
    history: [],
    records: {},
    streak: { current: 0, best: 0, bent: false },
    titles: ['The Protagonist'],
    bestLevel: 5,
  };
}

/** A fully set-up profile with the five seed quests and named stats. For tests (pace, judgment) only. */
export function seededProfile(): Profile {
  const p = newProfile();
  const stats = { ...p.stats };
  (Object.keys(stats) as StatId[]).forEach(k => { stats[k] = { ...stats[k], name: SEED_STAT_NAMES[k] }; });
  return { ...p, stats, quests: seedQuests() };
}
