import * as Notifications from 'expo-notifications';
import type { Profile } from '../domain/types';
import { todayKey } from '../data/store';
import { planReminders } from './plan';

let asked = false;

/** Native: replace all scheduled reminders with today's plan. */
export async function syncReminders(p: Profile, now = new Date()) {
  try {
    if (!asked) { asked = true; await Notifications.requestPermissionsAsync(); }
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of planReminders(p, now, todayKey(p, now))) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
      });
    }
  } catch {
    // Permission denied or unsupported: reminders are a nudge, never a blocker.
  }
}
