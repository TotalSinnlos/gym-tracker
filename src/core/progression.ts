// How sessions move an exercise's weight: automatic increases, "lower weight" choices, weights set in
// settings, and working the weight out again when history is corrected or deleted.

import { type Exercise, type Session, type SessionEntry, isWeighted } from "./types";

/** What the end-of-session summary shows about progression. */
export interface ProgressionSummary {
  /** Weighted exercises that go up next time. */
  increases: { exerciseId: string; name: string; fromKg: number; toKg: number }[];
  /** Bodyweight exercises where every set beat the rep range. */
  repRangeBeaten: { exerciseId: string; name: string }[];
  /** Exercises with a set under the rep minimum. `lowerToKg` is offered for weighted ones only. */
  belowRange: { entryId: string; exerciseId: string; name: string; lowerToKg?: number }[];
}

/** Last time's results for an exercise: its latest done or incomplete entry from any routine. */
export interface LastResult {
  entry: SessionEntry;
  /** ISO start time of that session. */
  date: string;
}

/** The exercise's entry that counts for this session: its last one in queue order with one of `states`. */
export function decidingEntry(session: Session, exerciseId: string, states: SessionEntry["state"][]) {
  return session.entries.findLast((e) => e.exerciseId === exerciseId && states.includes(e.state));
}

/** The latest done or incomplete entry for the exercise across `sessions` (oldest first), with its session. */
export function findLastResult(sessions: Session[], exerciseId: string): (LastResult & { session: Session }) | null {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const session = sessions[i];
    const entry = decidingEntry(session, exerciseId, ["done", "incomplete"]);
    if (entry) return { entry, date: session.startedAt, session };
  }
  return null;
}

/**
 * Whether the entry counts for its exercise's weight in the exercise's most recent completed session:
 * it decided the weight when the session ended, or it is the result a lowering is recorded on.
 */
export function countsForWeight(sessions: Session[], session: Session, entry: SessionEntry): boolean {
  const last = findLastResult(sessions, entry.exerciseId);
  if (last?.session !== session) return false;
  return entry === decidingEntry(session, entry.exerciseId, ["done"]) || (entry === last.entry && entry.lowered === true);
}

/** Any set fell under the rep minimum. */
export function isBelowRange(entry: SessionEntry): boolean {
  return entry.loggedSets.some((set) => set.reps < entry.repMin);
}

export const loweredWeight = (sessionWeight: number, increment: number) => Math.max(0, sessionWeight - increment);

/**
 * The current weight a completed session gives an exercise: a weight set in settings during it, else the
 * done entry's progression. Undefined leaves the weight as it is: nothing was finished, or the exercise is
 * (now) bodyweight.
 */
export function weightFromSession(session: Session, exercise: Exercise): number | undefined {
  if (!isWeighted(exercise.type)) return undefined;
  const override = session.weightOverrides?.[exercise.id];
  if (override !== undefined) return override;
  const done = decidingEntry(session, exercise.id, ["done"]);
  return done?.sessionWeight === undefined ? undefined : progressedWeight(done, exercise);
}

/**
 * The exercise's current weight worked out again from a (corrected) session, as if it had just ended.
 * In order: a "lower weight" choice, while its entry is still below range; a weight set in settings during
 * the session; the done entry's progression. Undefined leaves the weight as it is: bodyweight exercises
 * (also ones switched to or from bodyweight since), and an exercise only incomplete that session, which
 * ending the session didn't change either, unless a lowering on it no longer applies.
 */
export function recalculatedWeight(session: Session, exercise: Exercise): number | undefined {
  if (!isWeighted(exercise.type) || exercise.increment === undefined) return undefined;
  const last = decidingEntry(session, exercise.id, ["done", "incomplete"]);
  if (last?.sessionWeight === undefined) return undefined;
  if (last.lowered && isBelowRange(last)) return loweredWeight(last.sessionWeight, exercise.increment);
  // Undoing the lowering leaves the weight where the session left it: at its session weight.
  return weightFromSession(session, exercise) ?? (last.lowered ? last.sessionWeight : undefined);
}

/**
 * The exercise's weight once `deleted` is gone from `sessions`, or undefined to leave it as it is. Only an
 * exercise whose latest result was in the deleted session changes: back to what the session before left it
 * at, or, with no session before, to the weight it was done at in the deleted one.
 */
export function weightWithoutSession(sessions: Session[], deleted: Session, exercise: Exercise): number | undefined {
  const last = findLastResult(sessions, exercise.id);
  if (last?.session !== deleted || !isWeighted(exercise.type)) return undefined;
  const before = findLastResult(
    sessions.filter((s) => s !== deleted),
    exercise.id,
  );
  return before ? (recalculatedWeight(before.session, exercise) ?? before.entry.sessionWeight) : last.entry.sessionWeight;
}

export function summarizeProgression(session: Session, exercises: Exercise[]): ProgressionSummary {
  const summary: ProgressionSummary = { increases: [], repRangeBeaten: [], belowRange: [] };
  const exerciseIds = [...new Set(session.entries.map((e) => e.exerciseId))];
  for (const exerciseId of exerciseIds) {
    const exercise = exercises.find((e) => e.id === exerciseId);
    // A weight set in settings during the session replaces the automatic result.
    if (!exercise || session.weightOverrides?.[exerciseId] !== undefined) continue;
    const { increment } = exercise;
    const name = session.entries.find((e) => e.exerciseId === exerciseId)!.exerciseName;
    const done = decidingEntry(session, exerciseId, ["done"]);
    if (done && beatsRepRange(done)) {
      if (done.sessionWeight === undefined) summary.repRangeBeaten.push({ exerciseId, name });
      else if (increment !== undefined && isWeighted(exercise.type)) {
        summary.increases.push({ exerciseId, name, fromKg: done.sessionWeight, toKg: done.sessionWeight + increment });
      }
    }
    const last = decidingEntry(session, exerciseId, ["done", "incomplete"]);
    if (last && isBelowRange(last)) {
      const weighted = last.sessionWeight !== undefined && increment !== undefined && isWeighted(exercise.type);
      summary.belowRange.push({
        entryId: last.id,
        exerciseId,
        name,
        ...(weighted && { lowerToKg: loweredWeight(last.sessionWeight!, increment!) }),
      });
    }
  }
  return summary;
}

/** Every configured set was logged and reached the rep maximum plus one, at the session weight or higher. */
function beatsRepRange(entry: SessionEntry): boolean {
  return (
    entry.loggedSets.length >= entry.sets &&
    entry.loggedSets.every(
      (set) =>
        set.reps >= entry.repMax + 1 &&
        (entry.sessionWeight === undefined || (set.weight ?? 0) >= entry.sessionWeight),
    )
  );
}

/** A done weighted entry's new current weight: the session weight, plus the increment if it qualifies. */
function progressedWeight(entry: SessionEntry, exercise: Exercise): number {
  const weight = entry.sessionWeight!;
  return beatsRepRange(entry) ? weight + (exercise.increment ?? 0) : weight;
}
