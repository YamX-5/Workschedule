// Yami domain types. Pure data, no React, no I/O. Spec: docs/superpowers/specs/2026-11-08-yami-design.md
export type StatId = 'deen' | 'body' | 'mind' | 'craft' | 'rest';
export const STAT_IDS: StatId[] = ['deen', 'body', 'mind', 'craft', 'rest'];
export type Preset = 'mercy' | 'balanced' | 'ruthless';
export type AppCategory = 'watched' | 'work' | 'always';
export type QuestType = 'check' | 'count' | 'timer';
export type ThemeId = 'darkness' | 'sakura' | 'abyss' | 'ember' | 'jade';
export const THEME_IDS: ThemeId[] = ['darkness', 'sakura', 'abyss', 'ember', 'jade'];

export interface Quest {
  id: string;
  title: string;
  stat: StatId;
  xp: number;
  type: QuestType;
  target: number;
  days: number[]; // 0=Sun..6
  deadline: string; // 'HH:MM'
  dreamId?: string;
}

export type ReportKind = 'done' | 'didnt';
export interface Report {
  questId: string;
  dayKey: string;
  kind: ReportKind;
  units: number;
  at: number; // epoch ms
  late: boolean;
  /** XP and Shards already banked the moment this was reported; Judgment only settles the difference. */
  xp?: number;
  shards?: number;
}

export interface StatState { level: number; xp: number; enabled: boolean; name: string }

export interface Window { from: string; to: string }

export interface Protocol {
  capMin: number;
  reserveMin: number;
  windDown: string;
  sleepTarget: string;
  fajrAlarm: string;
  preset: Preset;
  neverMissTwice: boolean;
  graceUntilFajr: boolean;
  reminderLeadMin: 60 | 30 | 10;
  apps: Record<string, AppCategory>;
  workWindows: Window[];
  city: string;
  coords: { lat: number; lng: number };
  calcMethod: string;
  theme: ThemeId;
}

export interface Dream {
  id: string;
  title: string;
  why: string;
  stat: StatId;
  milestones: { id: string; title: string; doneAt?: number }[];
  createdAt: number;
  /** Optional target date, 'YYYY-MM-DD'. */
  due?: string;
  achievedAt?: number;
  active: boolean;
}

export interface Reward { id: string; title: string; cost: number }

export interface DaySummary {
  dayKey: string;
  usedMin: number;
  capMin: number;
  cleared: number;
  late: number;
  confessed: number;
  unreported: number;
  xpGained: number;
  xpLost: number;
  shards: number;
  salahOnTime: number;
  rehabSets: number;
  energy?: number;
  held: boolean;
}

export type RecordId =
  | 'firstLight' | 'sevenUnbroken' | 'underCap' | 'fiveGates'
  | 'ironKnees' | 'honestBlade' | 'day66' | 'dreamer' | 'supreme';

export interface Streak { current: number; best: number; bent: boolean }

export interface Usage {
  dayKey: string;
  usedMin: number;
  reserveUsedMin: number;
  reserveOpen: boolean;
  reserveReasons: string[];
  earnedMin: number;
  energy?: number;
  /** Fajr..Isha gate marks for this day. */
  gates?: GateMark[];
}

export type GateMark = 'pending' | 'ontime' | 'late' | 'miss';

export interface Profile {
  schemaVersion: 1;
  name: string;
  title: string;
  day: number;
  honor: number;
  stats: Record<StatId, StatState>;
  quests: Quest[];
  reports: Report[];
  judgedDays: string[];
  debuffs: { stat: StatId; dayKey: string }[];
  corruptionCarryMin: number;
  usage: Usage;
  fallRecord: { day: number; at: number }[];
  scars: number;
  onboarded: boolean;
  /** dayKey of the first day played; days before it are never judged. '' until first open. */
  startKey: string;
  protocol: Protocol;
  // progression (spec §12)
  shards: number;
  dreams: Dream[];
  rewards: Reward[];
  claims: { rewardId: string; at: number; cost: number }[];
  history: DaySummary[];
  records: Partial<Record<RecordId, number>>;
  streak: Streak;
  titles: string[];
  /** Highest player level ever reached; the best form stays on record even if levels drop. */
  bestLevel: number;
}
