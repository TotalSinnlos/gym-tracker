// The AI trainer's brief: everything the trainer gets to know about a session, written as plain text.
// The core works out the facts (how long since the last increase, how often skipped...) so the AI only
// interprets numbers and never has to count. A brief only covers what had happened up to its session.

import { decidingEntry, earnedIncrease, isBelowRange, summarizeProgression } from "./progression";
import { localDate } from "./spreadsheet";
import { type AppData, type Exercise, type Session, type SessionEntry, type SetRecord, EXERCISE_TYPE_LABELS } from "./types";

/** How many of an exercise's recent sessions "skipped in k of the last n" and "below range" look at. */
const RECENT_SESSIONS = 8;
const RECENT_RESULTS = 4;

export interface TrainerBrief {
  text: string;
  /** How many earlier sessions the brief could list, before any were left out. */
  earlierSessions: number;
}

/**
 * The brief for `session`: the session itself, facts per exercise, the exercises and routines, all
 * sessions before it and their summaries, and the user's goals. `leaveOut` drops that many of the
 * oldest earlier sessions (and their summaries), for a brief that's too long for the AI.
 */
export function buildTrainerBrief(data: AppData, session: Session, leaveOut = 0): TrainerBrief {
  const index = data.sessions.indexOf(session);
  const before = data.sessions.slice(0, index);
  const upTo = [...before, session];
  const listed = before.slice(Math.min(leaveOut, before.length));
  const goals = data.settings.trainer?.goals.trim() ?? "";

  const exercises = exercisesIn(data, upTo);
  const sessionExercises = unique(session.entries.map((e) => e.exerciseId)).flatMap((id) => {
    const exercise = data.exercises.find((e) => e.id === id);
    return exercise ? [exercise] : [];
  });
  const recent = upTo.filter((s) => daysBetween(s.startedAt, session.startedAt) < 28).length;
  const previous = before.at(-1);

  const parts = [
    "Progression rule: each exercise has a target rep range. When every set reaches at least one rep above the top of the range, the weight goes up by the exercise's increment next time. Skipped and incomplete exercises keep their weight. Below range means a set had fewer reps than the bottom of the range.",
    `Goals and notes: ${goals === "" ? "(none)" : goals}`,
    [
      `This session (${localDate(session.startedAt)}, routine "${session.routineName}"):`,
      ...session.entries.map((entry) => `- ${entryLine(data, session, entry)}`),
    ].join("\n"),
    `Training frequency: ${recent} ${recent === 1 ? "session" : "sessions"} in the 4 weeks up to this one${
      previous ? `; the previous session was ${ago(previous.startedAt, session.startedAt)} before.` : "; this is the first session."
    }`,
    ["Facts per exercise in this session:", ...sessionExercises.map((e) => `- ${facts(upTo, session, e)}`)].join("\n"),
    ["Exercises:", ...exercises.map((e) => `- ${exerciseLine(e, upTo)}`)].join("\n"),
    [
      "Routines (as they are now):",
      ...data.routines.map(
        (r) => `- ${r.name}: ${r.exerciseIds.map((id) => data.exercises.find((e) => e.id === id)?.name ?? "?").join(", ") || "(empty)"}`,
      ),
    ].join("\n"),
    [
      "Earlier sessions, oldest first:",
      ...(leaveOut > 0 && before.length > 0 ? [`(${before.length - listed.length} older sessions left out)`] : []),
      ...(listed.length === 0 ? ["(none)"] : listed.map(sessionLine)),
    ].join("\n"),
    [
      "Earlier summaries, oldest first:",
      ...summariesOf(listed),
    ].join("\n"),
  ];
  return { text: parts.join("\n\n"), earlierSessions: before.length };
}

/** "Chest press 45 kg: 13, 13 (done, increase earned: next time 47.5 kg)" */
function entryLine(data: AppData, session: Session, entry: SessionEntry): string {
  const name = `${entry.exerciseName} (${EXERCISE_TYPE_LABELS[entry.type].toLowerCase()}, ${entry.sets} sets of ${entry.repMin}-${entry.repMax})`;
  if (entry.state === "skipped") return `${name}: skipped`;
  const notes: string[] = [entry.state === "incomplete" ? `incomplete, ${entry.loggedSets.length} of ${entry.sets} sets` : "done"];
  if (earnedIncrease(session, entry)) {
    const increase = summarizeProgression(session, data.exercises).increases.find((i) => i.exerciseId === entry.exerciseId);
    notes.push(increase ? `increase earned: next time ${kg(increase.toKg)}` : "increase earned");
  } else if (entry.sessionWeight === undefined && entry === decidingEntry(session, entry.exerciseId, ["done"]) && beatsRange(entry)) {
    notes.push("beat the rep range (bodyweight: no weight to raise)");
  }
  if (isBelowRange(entry)) notes.push(entry.lowered ? "below range, weight lowered for next time" : "below range");
  return `${name}: ${setsText(entry)} (${notes.join(", ")})`;
}

/** The facts the AI should rely on instead of counting itself. */
function facts(upTo: Session[], session: Session, exercise: Exercise): string {
  const results = resultsOf(upTo, exercise.id);
  const parts: string[] = [];
  const current = decidingEntry(session, exercise.id, ["done", "incomplete"]);
  // Skipped this session: the facts are about the weight it was last done at.
  const latest = current ?? results.at(-1)?.entry;

  if (exercise.type !== "bodyweight" && latest?.sessionWeight !== undefined) {
    const weight = latest.sessionWeight;
    const weighted = results.filter((r) => r.entry.sessionWeight !== undefined);
    // The first session at today's weight after a lower one: when the weight last went up.
    let start = weighted.length - 1;
    while (start > 0 && weighted[start - 1].entry.sessionWeight! >= weight) start--;
    const atWeight = weighted.slice(start).filter((r) => r.entry.sessionWeight === weight);
    if (start > 0 && weighted[start].session === session) {
      parts.push(`weight went up for this session (to ${kg(weight)})`);
    } else if (start > 0) {
      parts.push(`weight last went up ${ago(weighted[start].session.startedAt, session.startedAt)} before this session (to ${kg(weight)})`);
    } else {
      parts.push(`weight hasn't gone up since it was first done (${localDate(weighted[0].session.startedAt)})`);
    }
    const sessions = `${atWeight.length} ${atWeight.length === 1 ? "session" : "sessions"} at ${kg(weight)}`;
    parts.push(current ? `${sessions} including this one` : `${sessions}, not done this session`);
    const best = bestSets(atWeight.map((r) => r.entry));
    if (best) parts.push(`best at ${kg(weight)}: ${best}`);
  } else if (exercise.type === "bodyweight") {
    const best = bestSets(results.map((r) => r.entry));
    parts.push(best ? `bodyweight; best: ${best}` : "bodyweight; not done yet");
  } else {
    parts.push("not done yet");
  }

  const inSessions = upTo.filter((s) => s.entries.some((e) => e.exerciseId === exercise.id)).slice(-RECENT_SESSIONS);
  const skipped = inSessions.filter((s) => !decidingEntry(s, exercise.id, ["done", "incomplete"])).length;
  parts.push(`skipped in ${skipped} of the last ${inSessions.length} sessions it was in`);
  const lastResults = results.slice(-RECENT_RESULTS);
  if (lastResults.length > 0) {
    const below = lastResults.filter((r) => isBelowRange(r.entry)).length;
    parts.push(`below range in ${below} of its last ${lastResults.length} results`);
  }
  return `${exercise.name}: ${parts.join("; ")}`;
}

/** Every exercise in the history so far or in a routine, with archived ones marked. */
function exercisesIn(data: AppData, upTo: Session[]): Exercise[] {
  const used = new Set([...upTo.flatMap((s) => s.entries.map((e) => e.exerciseId)), ...data.routines.flatMap((r) => r.exerciseIds)]);
  return data.exercises.filter((e) => used.has(e.id));
}

function exerciseLine(exercise: Exercise, upTo: Session[]): string {
  const type = EXERCISE_TYPE_LABELS[exercise.type].toLowerCase();
  const increment = exercise.increment === undefined ? "" : `, increment ${kg(exercise.increment)}`;
  let line = `${exercise.name}: ${type}, ${exercise.sets} sets of ${exercise.repMin}-${exercise.repMax} reps${increment}`;
  if (exercise.archived) {
    const last = resultsOf(upTo, exercise.id).at(-1);
    line += last ? ` (archived; last done ${localDate(last.session.startedAt)})` : " (archived)";
  }
  return line;
}

/** "2026-10-27 Upper body: Chest press 45 kg 11, 11; Seated row skipped" */
function sessionLine(session: Session): string {
  const entries = session.entries.map((entry) => {
    if (entry.state === "skipped") return `${entry.exerciseName} skipped`;
    return `${entry.exerciseName} ${setsText(entry)}${entry.state === "incomplete" ? " (incomplete)" : ""}`;
  });
  return `${localDate(session.startedAt)} ${session.routineName}: ${entries.join("; ")}`;
}

function summariesOf(sessions: Session[]): string[] {
  const written = sessions.filter((s) => s.trainerSummary);
  if (written.length === 0) return ["(none)"];
  return written.map((s) => `${localDate(s.startedAt)}:\n${s.trainerSummary!.text.trim()}`);
}

/** "45 kg: 13, 13", "13, 12" for bodyweight, or "45 kg: 11, 42.5 kg: 10" when the weight changed mid-way. */
function setsText(entry: SessionEntry): string {
  const sets = entry.loggedSets;
  if (entry.sessionWeight === undefined) return sets.map((s) => s.reps).join(", ");
  if (sets.every((s) => s.weight === entry.sessionWeight)) return `${kg(entry.sessionWeight)}: ${sets.map((s) => s.reps).join(", ")}`;
  return sets.map((s: SetRecord) => `${kg(s.weight ?? entry.sessionWeight)}: ${s.reps}`).join(", ");
}

/** The exercise's deciding entry in each session it was done or left incomplete in, oldest first. */
function resultsOf(sessions: Session[], exerciseId: string) {
  return sessions.flatMap((session) => {
    const entry = decidingEntry(session, exerciseId, ["done"]) ?? decidingEntry(session, exerciseId, ["incomplete"]);
    return entry ? [{ session, entry }] : [];
  });
}

/** The reps of the entry with the most reps in total, e.g. "12, 11". */
function bestSets(entries: SessionEntry[]): string | null {
  const total = (e: SessionEntry) => e.loggedSets.reduce((sum, s) => sum + s.reps, 0);
  const done = entries.filter((e) => e.loggedSets.length >= e.sets);
  const best = (done.length > 0 ? done : entries).reduce<SessionEntry | null>((a, e) => (a && total(a) >= total(e) ? a : e), null);
  return best && best.loggedSets.map((s) => s.reps).join(", ");
}

const beatsRange = (entry: SessionEntry) =>
  entry.loggedSets.length >= entry.sets && entry.loggedSets.every((s) => s.reps >= entry.repMax + 1);

const kg = (value: number | undefined) => `${value ?? 0} kg`;

const unique = <T,>(values: T[]) => [...new Set(values)];

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000));
}

/** "5 days", "3 weeks" (rounded down), or "the same day". */
function ago(from: string, to: string): string {
  const days = daysBetween(from, to);
  if (days <= 0) return "the same day";
  if (days < 14) return days === 1 ? "1 day" : `${days} days`;
  return `${Math.floor(days / 7)} weeks`;
}
