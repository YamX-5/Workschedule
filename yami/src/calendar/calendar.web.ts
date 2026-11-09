// expo-calendar has no web support; the plan screen hides every calendar control when this is false.
import type { CalEvent } from './calendar';
import type { Task } from '../domain/types';

export const calendarSupported = false;
export async function requestCalendar() { return false; }
export async function readEvents(_from: Date, _to: Date): Promise<CalEvent[]> { return []; }
export async function addTaskEvent(_t: Task): Promise<string | null> { return null; }
export async function removeEvent(_id: string) {}
