// The numbers behind the graphs: one point per completed session an exercise was done in.

import { decidingEntry } from "./progression";
import { type Exercise, type Session, type SessionEntry, isWeighted } from "./types";

/** How many recent sessions a trend line (overview, session screen) shows. */
export const TREND_SESSIONS = 10;

/** One session's value in a graph: an exercise's weight, or its total reps. */
export interface ChartPoint {
  sessionId: string;
  /** ISO start time of the session. */
  date: string;
  value: number;
  /** The exercise was left incomplete in that session, so it is drawn as a hollow point. */
  incomplete: boolean;
}

/** One session's reps for an exercise, set by set. */
export interface RepsPoint {
  sessionId: string;
  /** ISO start time of the session. */
  date: string;
  reps: number[];
  incomplete: boolean;
}

/** The data behind an exercise's graphs, oldest session first. */
export interface ExerciseHistory {
  /** Session weight per session, or null for bodyweight exercises (no weight graph). */
  weight: ChartPoint[] | null;
  /** Reps of every logged set, per session. */
  reps: RepsPoint[];
}

/** One line of the overview page. */
export interface OverviewRow {
  exercise: Exercise;
  /** ISO start time of the session after which the weight last went up (see `lastIncreaseDate`). */
  lastIncrease: string | null;
  /** The last few sessions: weight for weighted exercises, total reps for bodyweight ones. */
  trend: ChartPoint[];
}

type HistoryEntry = { session: Session; entry: SessionEntry };

/**
 * An exercise's history for its graphs. Skipped entries give no point. The weight is the session weight
 * (the working weight).
 */
export function exerciseHistory(sessions: Session[], exercise: Exercise): ExerciseHistory {
  const history = historyEntries(sessions, exercise.id);
  return {
    weight: isWeighted(exercise.type) ? weightPoints(history) : null,
    reps: history.map(({ session, entry }) => ({
      sessionId: session.id,
      date: session.startedAt,
      reps: entry.loggedSets.map((s) => s.reps),
      incomplete: entry.state === "incomplete",
    })),
  };
}

/**
 * The start time of the latest session after which the exercise's weight went up, or null if it never has
 * (or it's a bodyweight exercise). "Went up" compares each session's weight with the next session's, and
 * the last session's with the current weight. So an increase earned in a session is dated by that session,
 * even before it has been lifted. A weight raised by hand (in settings or on the session screen) counts
 * too, dated by the session before it; lowering never does.
 */
export function lastIncreaseDate(sessions: Session[], exercise: Exercise): string | null {
  if (exercise.weight === undefined) return null;
  const points = weightPoints(historyEntries(sessions, exercise.id));
  const weights = [...points.map((p) => p.value), exercise.weight];
  for (let i = points.length - 1; i >= 0; i--) {
    if (weights[i + 1] > weights[i]) return points[i].date;
  }
  return null;
}

/** The recent sessions' trend for an exercise: see `OverviewRow.trend`. */
export function trend(sessions: Session[], exercise: Exercise): ChartPoint[] {
  const history = historyEntries(sessions, exercise.id);
  const points = isWeighted(exercise.type)
    ? weightPoints(history)
    : history.map(({ session, entry }) => chartPoint(session, entry, entry.loggedSets.reduce((sum, s) => sum + s.reps, 0)));
  return points.slice(-TREND_SESSIONS);
}

/**
 * The exercise's entry for each session it was done in, oldest first: the done entry that decided its
 * weight, or, if no occurrence was finished, the last incomplete one.
 */
function historyEntries(sessions: Session[], exerciseId: string): HistoryEntry[] {
  return sessions.flatMap((session) => {
    const entry = decidingEntry(session, exerciseId, ["done"]) ?? decidingEntry(session, exerciseId, ["incomplete"]);
    return entry ? [{ session, entry }] : [];
  });
}

const chartPoint = (session: Session, entry: SessionEntry, value: number): ChartPoint => ({
  sessionId: session.id,
  date: session.startedAt,
  value,
  incomplete: entry.state === "incomplete",
});

/** A point per session for the entries with a weight (an exercise switched from bodyweight has none before). */
function weightPoints(history: HistoryEntry[]): ChartPoint[] {
  return history.flatMap(({ session, entry }) =>
    entry.sessionWeight === undefined ? [] : [chartPoint(session, entry, entry.sessionWeight)],
  );
}
