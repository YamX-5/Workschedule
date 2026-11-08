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
  };
}

export function seedQuests(): Quest[] {
  return [
    { id: 'salah', title: 'Salah', stat: 'deen', xp: 15, type: 'count', target: 5, days: DAILY, deadline: '23:00' },
    { id: 'rehab', title: 'Knee rehab', stat: 'body', xp: 20, type: 'count', target: 5, days: DAILY, deadline: '21:00' },
    { id: 'perio', title: 'Perio ch.4', stat: 'mind', xp: 25, type: 'check', target: 1, days: DAILY, deadline: '23:00' },
    { id: 'ship', title: 'Ship academy landing page', stat: 'craft', xp: 40, type: 'check', target: 1, days: DAILY, deadline: '23:00' },
    { id: 'sleep', title: 'Asleep by 23:00', stat: 'rest', xp: 30, type: 'check', target: 1, days: DAILY, deadline: '23:00' },
  ];
}

const STAT_NAMES: Record<StatId, string> = { deen: 'DEEN', body: 'BODY', mind: 'MIND', craft: 'CRAFT', rest: 'REST' };
const stat = (id: StatId): StatState => ({ level: 1, xp: 0, enabled: true, name: STAT_NAMES[id] });

export function newProfile(): Profile {
  return {
    schemaVersion: 1,
    name: 'Player',
    title: 'The Protagonist',
    day: 1,
    honor: 50,
    stats: { deen: stat('deen'), body: stat('body'), mind: stat('mind'), craft: stat('craft'), rest: stat('rest') },
    quests: seedQuests(),
    reports: [],
    judgedDays: [],
    debuffs: [],
    corruptionCarryMin: 0,
    usage: { dayKey: '', usedMin: 0, reserveUsedMin: 0, reserveOpen: false, reserveReasons: [], earnedMin: 0 },
    fallRecord: [],
    scars: 0,
    onboarded: false,
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
