import { type EntryState, type Exercise, type SessionEntry, type SetRecord, isWeighted, localDate } from "../core";

// Accepts "42,5" as well as "42.5", since Android keyboards may offer either.
export const parseNumber = (text: string) => (text.trim() === "" ? NaN : Number(text.replace(",", ".")));

/** A number with up to 2 decimals, e.g. "62.5". */
export const formatNumber = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 2 });

export const formatKg = (kg: number) => `${formatNumber(kg)} kg`;

export const formatSet = (set: SetRecord) => (set.weight === undefined ? `${set.reps} reps` : `${set.reps} × ${formatKg(set.weight)}`);

export const formatReps = (entry: SessionEntry) => entry.loggedSets.map((s) => s.reps).join(" / ");

export const formatEntryWeight = (entry: SessionEntry) =>
  entry.sessionWeight === undefined ? "Bodyweight" : formatKg(entry.sessionWeight);

export const formatExerciseNames = (exercises: Exercise[]) => exercises.map((e) => e.name).join(" · ");

export const STATE_LABELS: Record<EntryState, string> = {
  done: "Done",
  incomplete: "Incomplete",
  skipped: "Skipped",
  pending: "Pending",
};

export function lastIncreaseText(exercise: Exercise, lastIncrease: string | null) {
  if (!isWeighted(exercise.type)) return null;
  return lastIncrease ? `Last increase: ${formatShortDate(lastIncrease, true)}` : "No increase yet";
}

// --- Dates ---
// All dates are shown day first ("24 Oct"), the same way everywhere.

const LOCALE = "en-GB";

/** "24 Oct", with the year added when it isn't this year. */
export function formatShortDate(iso: string, withYearIfOld = false): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    ...(withYearIfOld && !sameYear && { year: "numeric" }),
  });
}

/** "Sat 24 Oct 2026" */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** "Sat 24 Oct" */
export const formatDayShort = (iso: string) =>
  new Date(iso).toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" });

/** "Saturday 24 October" */
export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" });

/** "24 Oct 2026, 18:30" */
export const formatDateTime = (iso: string) => new Date(iso).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" });

/** "2026-10-24", or "2026-10-24-1830" with the time, for file names. */
export function fileStamp(iso: string, withTime = false): string {
  if (!withTime) return localDate(iso);
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${localDate(iso)}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
