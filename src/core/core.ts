// The core module's commands and queries: the one place the app's data is read and changed. It keeps
// the current data, saves every change through the store and tells subscribers. The rules themselves live
// in the files next to it (queue, progression, graphs, backup, spreadsheet, validation).

import { type Backup, type BackupInfo, readBackup, writeBackup } from "./backup";
import { normalize } from "./data";
import { exerciseHistory, lastIncreaseDate, type OverviewRow, trend } from "./graphs";
import {
  type LastResult,
  type ProgressionSummary,
  countsForWeight,
  earnedIncrease,
  findLastResult,
  isBelowRange,
  loweredWeight,
  recalculatedWeight,
  summarizeProgression,
  weightFromSession,
  weightWithoutSession,
} from "./progression";
import { entryIdsFor, pendingExcept, settleEntry } from "./queue";
import { type BackupServer, buildConnection, explainServerError } from "./server";
import { type SpreadsheetExport, spreadsheetCsv } from "./spreadsheet";
import type { Store } from "./store";
import {
  type AppData,
  type Exercise,
  type ExerciseInput,
  type ExercisePatch,
  type Routine,
  type Session,
  type SessionEntry,
  isWeighted,
} from "./types";
import { CoreError, DEFAULT_INCREMENT, buildExercise, buildSet, requireName, requireWeight } from "./validation";

/** A session started longer ago than this was probably forgotten (see `isSessionStale`). */
export const STALE_SESSION_HOURS = 6;

export type Core = Awaited<ReturnType<typeof createCore>>;

export interface CoreOptions {
  newId?: () => string;
  now?: () => Date;
  /** The user's own backup server. Without it, the server backup commands refuse to run. */
  server?: BackupServer;
}

/** The saved session with its summary, or `session: null` when nothing was logged and it was discarded. */
export type EndSessionResult = { session: Session; summary: ProgressionSummary } | { session: null };

export async function createCore(store: Store, options: CoreOptions = {}) {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const server = options.server;
  let data: AppData = normalize(await store.load());
  const listeners = new Set<() => void>();

  async function commit(next: AppData) {
    await store.save(next);
    data = next;
    listeners.forEach((listener) => listener());
  }

  function findExercise(id: string): Exercise {
    const exercise = data.exercises.find((e) => e.id === id);
    if (!exercise) throw new CoreError(`Unknown exercise: ${id}`);
    return exercise;
  }

  function findRoutine(id: string): Routine {
    const routine = data.routines.find((r) => r.id === id);
    if (!routine) throw new CoreError(`Unknown routine: ${id}`);
    return routine;
  }

  async function replaceRoutine(routine: Routine) {
    await commit({ ...data, routines: data.routines.map((r) => (r.id === routine.id ? routine : r)) });
  }

  function requireActiveSession(): Session {
    if (!data.activeSession) throw new CoreError("No session is running");
    return data.activeSession;
  }

  function findEntry(session: Session, entryId: string): SessionEntry {
    const entry = session.entries.find((e) => e.id === entryId);
    if (!entry) throw new CoreError("That exercise isn't part of this session");
    return entry;
  }

  /** Applies `change` to one entry of the active session, then settles its state and the current exercise. */
  async function changeEntry(entryId: string, change: (entry: SessionEntry) => SessionEntry) {
    const session = requireActiveSession();
    const before = findEntry(session, entryId);
    const after = settleEntry(change(before));
    const entries = session.entries.map((e) => (e.id === entryId ? after : e));
    let { currentEntryId } = session;
    // Finishing the exercise on screen moves on to the first one still to do, in queue order.
    if (before.state === "pending" && after.state === "done" && currentEntryId === entryId) {
      currentEntryId = pendingExcept(entries, entryId)[0]?.id ?? null;
    }
    await commit({ ...data, activeSession: { ...session, entries, currentEntryId } });
  }

  /** Ends the active session (see `endSession`), recording `endedAt` as when it ended. */
  async function endSessionAt(endedAt: Date): Promise<EndSessionResult> {
    const session = requireActiveSession();
    if (session.entries.every((e) => e.loggedSets.length === 0)) {
      await commit({ ...data, activeSession: null });
      return { session: null };
    }
    const ended: Session = {
      ...session,
      endedAt: endedAt.toISOString(),
      currentEntryId: null,
      entries: session.entries.map((e) =>
        e.state === "pending" ? { ...e, state: e.loggedSets.length > 0 ? "incomplete" : "skipped" } : e,
      ),
    };
    const exercises = data.exercises.map((exercise) => {
      const weight = weightFromSession(ended, exercise);
      return weight === undefined ? exercise : { ...exercise, weight };
    });
    await commit({ ...data, exercises, activeSession: null, sessions: [...data.sessions, ended] });
    return { session: ended, summary: summarizeProgression(ended, data.exercises) };
  }

  function isSessionStale(): boolean {
    const session = data.activeSession;
    if (!session) return false;
    return now().getTime() - new Date(session.startedAt).getTime() > STALE_SESSION_HOURS * 60 * 60 * 1000;
  }

  return {
    /** The whole current state. Replaced (never mutated) on every change. */
    getData: () => data,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    // --- Exercises ---

    async createExercise(input: ExerciseInput): Promise<Exercise> {
      const exercise = buildExercise(newId(), input);
      await commit({ ...data, exercises: [...data.exercises, exercise] });
      return exercise;
    },

    async updateExercise(id: string, patch: ExercisePatch): Promise<Exercise> {
      const current = findExercise(id);
      const merged = { ...current, ...patch };
      // Switching from bodyweight to a weighted type starts at 0 kg with the default step.
      const exercise = {
        ...buildExercise(id, {
          ...merged,
          weight: merged.weight ?? (isWeighted(merged.type) ? 0 : undefined),
          increment: merged.increment ?? (isWeighted(merged.type) ? DEFAULT_INCREMENT : undefined),
        }),
        archived: current.archived,
      };
      // A weight change made in settings applies to a running session straight away: pending entries
      // use it, and if the exercise was already done this session, it wins over that session's result.
      let activeSession = data.activeSession;
      if (activeSession && exercise.weight !== undefined && exercise.weight !== current.weight) {
        const entries = activeSession.entries.filter((e) => e.exerciseId === id);
        activeSession = {
          ...activeSession,
          entries: activeSession.entries.map((e) =>
            e.exerciseId === id && e.state === "pending" && e.sessionWeight !== undefined
              ? { ...e, sessionWeight: exercise.weight }
              : e,
          ),
          weightOverrides: entries.some((e) => e.state !== "pending")
            ? { ...activeSession.weightOverrides, [id]: exercise.weight }
            : activeSession.weightOverrides,
        };
      }
      await commit({
        ...data,
        exercises: data.exercises.map((e) => (e.id === id ? exercise : e)),
        activeSession,
      });
      return exercise;
    },

    listExercises: () => data.exercises.filter((e) => !e.archived),

    listArchivedExercises: () => data.exercises.filter((e) => e.archived),

    /**
     * Hides an exercise from lists and pickers but keeps its history. It is also taken out of every
     * routine, so no routine (and no new session) contains an archived exercise. A running session
     * keeps it until it ends.
     */
    async archiveExercise(id: string) {
      findExercise(id);
      await commit({
        ...data,
        exercises: data.exercises.map((e) => (e.id === id ? { ...e, archived: true } : e)),
        routines: data.routines.map((r) => withoutExercise(r, id)),
      });
    },

    /** Brings an archived exercise back, with its history. It isn't put back into any routine. */
    async unarchiveExercise(id: string) {
      findExercise(id);
      await commit({ ...data, exercises: data.exercises.map((e) => (e.id === id ? { ...e, archived: false } : e)) });
    },

    /** Whether the exercise appears in any saved session or the running one, even as skipped. */
    hasHistory,

    /** Deletes an exercise and takes it out of every routine. Only allowed when it has no history. */
    async deleteExercise(id: string) {
      findExercise(id);
      if (hasHistory(id)) throw new CoreError("This exercise has history, so it can only be archived");
      await commit({
        ...data,
        exercises: data.exercises.filter((e) => e.id !== id),
        routines: data.routines.map((r) => withoutExercise(r, id)),
      });
    },

    /** The routines the exercise is in, for warning before archiving or deleting it. */
    routinesWithExercise: (id: string) => data.routines.filter((r) => r.exerciseIds.includes(id)),

    getExercise: (id: string) => findExercise(id),

    /** How far the −/+ buttons move an exercise's weight. */
    weightStep: (exerciseId: string) => findExercise(exerciseId).increment ?? DEFAULT_INCREMENT,

    // --- Routines ---

    async createRoutine(name: string, exerciseIds: string[] = []): Promise<Routine> {
      exerciseIds.forEach(findActiveExercise);
      const routine: Routine = { id: newId(), name: requireName(name), exerciseIds: [...exerciseIds] };
      await commit({ ...data, routines: [...data.routines, routine] });
      return routine;
    },

    /** Renames a routine, and with it the running session and past sessions started from it. */
    async renameRoutine(id: string, name: string) {
      const routine = { ...findRoutine(id), name: requireName(name) };
      const renamed = (session: Session) => (session.routineId === id ? { ...session, routineName: routine.name } : session);
      await commit({
        ...data,
        routines: data.routines.map((r) => (r.id === id ? routine : r)),
        activeSession: data.activeSession && renamed(data.activeSession),
        sessions: data.sessions.map(renamed),
      });
    },

    /** Adds an exercise to the end of the routine. The same exercise may appear more than once. */
    async addExerciseToRoutine(routineId: string, exerciseId: string) {
      const routine = findRoutine(routineId);
      findActiveExercise(exerciseId);
      await replaceRoutine({ ...routine, exerciseIds: [...routine.exerciseIds, exerciseId] });
    },

    /** Removes the exercise at `position` (zero-based) from the routine. */
    async removeExerciseFromRoutine(routineId: string, position: number) {
      const routine = findRoutine(routineId);
      if (!(position in routine.exerciseIds)) throw new CoreError("Position out of range");
      await replaceRoutine({ ...routine, exerciseIds: routine.exerciseIds.filter((_, i) => i !== position) });
    },

    /** Moves the exercise at position `from` to position `to` (both zero-based). */
    async moveExerciseInRoutine(routineId: string, from: number, to: number) {
      const routine = findRoutine(routineId);
      const ids = [...routine.exerciseIds];
      if (!(from in ids) || !(to in ids)) throw new CoreError("Position out of range");
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      await replaceRoutine({ ...routine, exerciseIds: ids });
    },

    /**
     * Deletes a routine. Past sessions keep its last name. The routine of the running session can't be
     * deleted, and neither can the last routine, so there's always one to start a session from.
     */
    async deleteRoutine(id: string) {
      const problem = routineDeleteProblem(findRoutine(id));
      if (problem) throw new CoreError(problem);
      await commit({ ...data, routines: data.routines.filter((r) => r.id !== id) });
    },

    canDeleteRoutine: (id: string) => routineDeleteProblem(findRoutine(id)) === null,

    /** Why the routine can't be deleted, or null if it can. */
    routineDeleteProblem: (id: string) => routineDeleteProblem(findRoutine(id)),

    listRoutines: () => data.routines,

    /** The routines a session can be started from: those with at least one exercise. */
    startableRoutines: () => data.routines.filter((r) => r.exerciseIds.length > 0),

    getRoutine: (id: string) => findRoutine(id),

    /** The routine's exercises in order. */
    routineExercises: (id: string) => findRoutine(id).exerciseIds.map(findExercise),

    // --- Setup ---

    isSetupComplete: () => data.settings.setupComplete,

    async completeSetup() {
      if (!data.routines.some((r) => r.exerciseIds.length > 0)) {
        throw new CoreError("Add at least one exercise to your routine first");
      }
      await commit({ ...data, settings: { ...data.settings, setupComplete: true } });
    },

    // --- Sessions ---

    async startSession(routineId: string): Promise<Session> {
      if (data.activeSession) throw new CoreError("A session is already running");
      const routine = findRoutine(routineId);
      // Archiving takes an exercise out of its routines, so this only guards against odd data.
      const exercises = routine.exerciseIds.map(findActiveExercise);
      if (exercises.length === 0) throw new CoreError("This routine has no exercises");
      const entryIds = entryIdsFor(exercises.map((e) => e.id));
      const session: Session = {
        id: newId(),
        routineId: routine.id,
        routineName: routine.name,
        startedAt: now().toISOString(),
        entries: exercises.map((exercise, i) => ({
          id: entryIds[i],
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          type: exercise.type,
          sets: exercise.sets,
          repMin: exercise.repMin,
          repMax: exercise.repMax,
          sessionWeight: exercise.weight,
          loggedSets: [],
          state: "pending",
        })),
        currentEntryId: entryIds[0],
      };
      await commit({ ...data, activeSession: session });
      return session;
    },

    activeSession: () => data.activeSession,

    /** The entry on screen, or null when every exercise is finished. */
    currentEntry(): SessionEntry | null {
      const session = data.activeSession;
      if (!session?.currentEntryId) return null;
      return findEntry(session, session.currentEntryId);
    },

    /** Finished entries other than the one on screen, in queue order. */
    finishedEntries: () =>
      data.activeSession?.entries.filter((e) => e.state === "done" && e.id !== data.activeSession?.currentEntryId) ?? [],

    async setSessionWeight(entryId: string, weight: number) {
      requireWeight(weight);
      await changeEntry(entryId, (entry) => {
        if (entry.sessionWeight === undefined) throw new CoreError("Bodyweight exercises have no weight");
        return { ...entry, sessionWeight: weight };
      });
    },

    /** Logs a set. The weight defaults to the session weight. */
    async logSet(entryId: string, set: { reps: number; weight?: number }) {
      await changeEntry(entryId, (entry) => ({
        ...entry,
        loggedSets: [...entry.loggedSets, buildSet(entry, set.reps, set.weight ?? entry.sessionWeight)],
      }));
    },

    async editSet(entryId: string, index: number, change: { reps?: number; weight?: number }) {
      await changeEntry(entryId, (entry) => {
        const set = entry.loggedSets[index];
        if (!set) throw new CoreError("No such set");
        const edited = buildSet(entry, change.reps ?? set.reps, change.weight ?? set.weight);
        return { ...entry, loggedSets: entry.loggedSets.map((s, i) => (i === index ? edited : s)) };
      });
    },

    async removeSet(entryId: string, index: number) {
      await changeEntry(entryId, (entry) => {
        if (!entry.loggedSets[index]) throw new CoreError("No such set");
        return { ...entry, loggedSets: entry.loggedSets.filter((_, i) => i !== index) };
      });
    },

    /**
     * Puts an entry of the running session on screen: flips to another exercise, or reopens a finished one
     * to correct it. An unfinished exercise flipped away from keeps its sets and stays in the queue.
     */
    async goToEntry(entryId: string) {
      const session = requireActiveSession();
      findEntry(session, entryId);
      if (entryId === session.currentEntryId) return;
      await commit({ ...data, activeSession: { ...session, currentEntryId: entryId } });
    },

    // --- Session queue ---

    /** The entries just before and after the one on screen in queue order, for flipping through them. */
    neighbourEntries(): { previous: SessionEntry | null; next: SessionEntry | null } {
      const session = data.activeSession;
      const index = session?.entries.findIndex((e) => e.id === session.currentEntryId) ?? -1;
      if (!session || index === -1) return { previous: null, next: null };
      return { previous: session.entries[index - 1] ?? null, next: session.entries[index + 1] ?? null };
    },

    /** The pending exercises other than the one on screen, in the order they come up. */
    upNext(): SessionEntry[] {
      const session = data.activeSession;
      if (!session) return [];
      return pendingExcept(session.entries, session.currentEntryId);
    },

    /** How many exercises are still to do. */
    pendingCount: () => data.activeSession?.entries.filter((e) => e.state === "pending").length ?? 0,

    /**
     * Saves the session: untouched exercises become skipped, partly logged ones incomplete,
     * and finished weighted exercises keep their session weight as their current weight,
     * plus one increment when they qualify (see "Progression rules" below).
     * A session with nothing logged is discarded.
     */
    endSession: () => endSessionAt(now()),

    // --- Forgotten sessions ---

    /** Whether the running session started more than 6 hours ago, so the user probably forgot to end it. */
    isSessionStale,

    /**
     * "End it" for a forgotten session: saved (or discarded) exactly like `endSession`, but dated by its
     * start. Its `endedAt` is the start time too: we don't know when the workout really finished, and
     * "now" may be many hours later, even the next day.
     */
    async endStaleSession(): Promise<EndSessionResult> {
      const session = requireActiveSession();
      if (!isSessionStale()) throw new CoreError("This session is still recent; end it normally");
      return endSessionAt(new Date(session.startedAt));
    },

    /** Completed sessions, newest first. */
    listSessions: () => [...data.sessions].reverse(),

    // --- History ---

    /** A completed session. */
    getSession: (id: string) => findSession(id),

    /** The entries of a completed session that earned their exercise a weight increase. */
    increasedEntryIds(sessionId: string): string[] {
      const session = findSession(sessionId);
      return session.entries.filter((e) => earnedIncrease(session, e)).map((e) => e.id);
    },

    /** Whether past sessions can be corrected or deleted: only while no session is running. */
    canEditHistory: () => data.activeSession === null,

    /**
     * Whether correcting this entry works out the exercise's current weight again: it must count for the
     * weight in the exercise's most recent completed session (see `editPastSet`).
     */
    editRecalculatesWeight(sessionId: string, entryId: string) {
      const session = findSession(sessionId);
      return countsForWeight(data.sessions, session, findEntry(session, entryId));
    },

    /**
     * Corrects a set's reps or weight in a completed session, checked like a set logged during one. Entry
     * states stay as they were. When the entry counts for the weight in the exercise's most recent completed
     * session, the exercise's current weight is worked out again as if that session had just ended (see
     * `recalculatedWeight`). Correcting an older session, or another entry, only fixes the record.
     * Waits until no session is running, so a running session's weights don't shift under it.
     */
    async editPastSet(sessionId: string, entryId: string, index: number, change: { reps?: number; weight?: number }) {
      if (data.activeSession) throw new CoreError("Finish the running session before correcting history");
      const session = findSession(sessionId);
      const entry = findEntry(session, entryId);
      const set = entry.loggedSets[index];
      if (!set) throw new CoreError("No such set");
      const edited = buildSet(entry, change.reps ?? set.reps, change.weight ?? set.weight);
      const updated: Session = {
        ...session,
        entries: session.entries.map((e) =>
          e === entry ? { ...e, loggedSets: e.loggedSets.map((s, i) => (i === index ? edited : s)) } : e,
        ),
      };
      const exercise = data.exercises.find((e) => e.id === entry.exerciseId);
      const weight = exercise && countsForWeight(data.sessions, session, entry) ? recalculatedWeight(updated, exercise) : undefined;
      await commit({
        ...data,
        exercises: data.exercises.map((e) => (e === exercise && weight !== undefined ? { ...e, weight } : e)),
        sessions: data.sessions.map((s) => (s.id === sessionId ? updated : s)),
      });
    },

    /**
     * Deletes a completed session. For each exercise whose latest result was in it, the weight goes back to
     * what the session before left it at (worked out like `recalculatedWeight`), or, with no session before,
     * to the weight it was done at in the deleted one. Deleting an older session only removes the record.
     * Waits until no session is running.
     */
    async deleteSession(id: string) {
      if (data.activeSession) throw new CoreError("Finish the running session before deleting from history");
      const deleted = findSession(id);
      const exercises = data.exercises.map((exercise) => {
        const weight = weightWithoutSession(data.sessions, deleted, exercise);
        return weight === undefined ? exercise : { ...exercise, weight };
      });
      await commit({ ...data, exercises, sessions: data.sessions.filter((s) => s !== deleted) });
    },

    // --- Progression ---

    /** Last time's results for an exercise, or null if it has never been done. */
    lastResult(exerciseId: string): LastResult | null {
      const last = findLastResult(data.sessions, exerciseId);
      return last && { entry: last.entry, date: last.date };
    },

    /**
     * How far the exercise's current weight has moved since last time (e.g. +2.5 after an increase).
     * Null for bodyweight exercises and exercises with no history.
     */
    weightChangeSinceLastTime(exerciseId: string): number | null {
      const exercise = findExercise(exerciseId);
      const last = findLastResult(data.sessions, exerciseId);
      if (exercise.weight === undefined || last?.entry.sessionWeight === undefined) return null;
      return exercise.weight - last.entry.sessionWeight;
    },

    // --- Graphs ---

    /**
     * An exercise's history for its graphs: one point per completed session it was done or left
     * incomplete in (when it appears twice, the finished occurrence that decided its weight). Skipped
     * entries give no point, and the running session isn't included. The weight is the session weight.
     */
    exerciseHistory: (exerciseId: string) => exerciseHistory(data.sessions, findExercise(exerciseId)),

    /**
     * The start time of the latest session after which the exercise's weight went up, or null if it
     * never has (or it's a bodyweight exercise). "Went up" compares each session's weight with the
     * next session's, and the last session's with the current weight. So an increase earned in a
     * session is dated by that session, even before it has been lifted. A weight raised by hand (in
     * settings or on the session screen) counts too, dated by the session before it; lowering never does.
     */
    lastIncreaseDate: (exerciseId: string) => lastIncreaseDate(data.sessions, findExercise(exerciseId)),

    /** The recent sessions' trend for an exercise: see `OverviewRow.trend`. */
    exerciseTrend: (exerciseId: string) => trend(data.sessions, findExercise(exerciseId)),

    /** The overview page: every active exercise with its last increase and trend line. */
    overview(): OverviewRow[] {
      return data.exercises
        .filter((e) => !e.archived)
        .map((exercise) => ({
          exercise,
          lastIncrease: lastIncreaseDate(data.sessions, exercise),
          trend: trend(data.sessions, exercise),
        }));
    },

    /**
     * The "Lower to X kg next time?" button: sets the exercise's weight to one increment below the
     * session weight (never below 0 kg) and records the choice on the entry. Only allowed for a
     * below-range weighted entry that is the exercise's most recent result.
     */
    async lowerWeightAfterSession(sessionId: string, entryId: string) {
      const session = findSession(sessionId);
      const entry = findEntry(session, entryId);
      const exercise = findExercise(entry.exerciseId);
      if (findLastResult(data.sessions, exercise.id)?.entry !== entry) {
        throw new CoreError("Only the exercise's most recent session can lower its weight");
      }
      if (entry.sessionWeight === undefined || exercise.increment === undefined) {
        throw new CoreError("Bodyweight exercises have no weight to lower");
      }
      if (!isBelowRange(entry)) throw new CoreError("That exercise wasn't below its rep range");
      if (entry.lowered) throw new CoreError("The weight has already been lowered");

      const weight = loweredWeight(entry.sessionWeight, exercise.increment);
      const updated: Session = {
        ...session,
        entries: session.entries.map((e) => (e === entry ? { ...e, lowered: true } : e)),
      };
      await commit({
        ...data,
        exercises: data.exercises.map((e) => (e.id === exercise.id ? { ...e, weight } : e)),
        sessions: data.sessions.map((s) => (s.id === sessionId ? updated : s)),
      });
    },

    /** Whether "Lower to X kg next time?" was chosen for this entry. */
    wasLowered: (sessionId: string, entryId: string) => findEntry(findSession(sessionId), entryId).lowered === true,

    // --- Backup ---

    /** ISO time of the last backup, or null if none has been made yet. */
    lastBackupAt: () => data.settings.lastBackupAt ?? null,

    /**
     * Everything (exercises, routines, sessions, settings and the format version) as a backup file,
     * stamped with the time it was made. Changes nothing: call `recordBackup` once the file is saved,
     * so a cancelled share doesn't count as a backup.
     */
    createBackup: () => writeBackup(data, now().toISOString()),

    /** Remembers that the backup was saved, for "Last backup". */
    async recordBackup(backup: Backup) {
      await commit({ ...data, settings: { ...data.settings, lastBackupAt: backup.createdAt } });
    },

    /** Checks a backup file without changing anything. Throws a CoreError saying what's wrong if it can't be restored. */
    checkBackup: (text: string) => checkBackupText(text),

    /**
     * Replaces all data, including a running session, with the backup's. An older backup is upgraded
     * the same way as older saved data. A file that can't be restored is rejected and nothing changes.
     */
    async restoreBackup(text: string) {
      await commit({ ...readBackup(text), serverBackup: data.serverBackup });
    },

    // --- Server backup ---

    /** The backup server's address and when it last accepted a backup, or null when not set up. */
    serverBackup(): { url: string; lastBackupAt: string | null } | null {
      const saved = data.serverBackup;
      return saved && { url: saved.url, lastBackupAt: saved.lastBackupAt ?? null };
    },

    /**
     * Checks the address and token by asking the server for its newest backup, and saves them only if
     * that works. An empty token keeps the current one, so the address can be changed on its own.
     * Changing the address starts "last backed up to server" afresh.
     */
    async connectServer(address: string, token: string) {
      const current = data.serverBackup;
      const connection = buildConnection(address, token.trim() === "" && current ? current.token : token);
      await requireServer().latest(connection).catch(explainServerError);
      const sameServer = current?.url === connection.url;
      await commit({ ...data, serverBackup: { ...connection, lastBackupAt: sameServer ? current.lastBackupAt : undefined } });
    },

    /** Forgets the backup server. The backups on it stay there. */
    async disconnectServer() {
      await commit({ ...data, serverBackup: null });
    },

    /** Sends a backup (the same as `createBackup`'s) to the server, and records it as the last backup. */
    async backUpToServer() {
      const connection = requireConnection();
      const backup = writeBackup(data, now().toISOString());
      await requireServer().upload(connection, backup.text).catch(explainServerError);
      // Read `data` again: it may have changed during the upload.
      await commit({
        ...data,
        settings: { ...data.settings, lastBackupAt: backup.createdAt },
        serverBackup: data.serverBackup && { ...data.serverBackup, lastBackupAt: backup.createdAt },
      });
    },

    /** The server's newest backup, checked like a file (see `checkBackup`). Restore it with `restoreBackup`. */
    async fetchServerBackup(): Promise<{ text: string; info: BackupInfo }> {
      const text = await requireServer().latest(requireConnection()).catch(explainServerError);
      if (text === null) throw new CoreError("There are no backups on your server yet");
      return { text, info: checkBackupText(text) };
    },

    // --- Export ---

    /**
     * The history of completed sessions as a CSV file for Excel or Google Sheets, one row per logged set
     * (see `SPREADSHEET_COLUMNS`), oldest session first. Exercise names are as recorded in each session, so
     * later renames or deletions don't change past rows; routine renames do (see `renameRoutine`). Skipped exercises have no rows and the running session
     * isn't included. Null when there are no sets to export yet.
     */
    exportSpreadsheet(): SpreadsheetExport | null {
      const csv = spreadsheetCsv(data.sessions);
      return csv && { ...csv, createdAt: now().toISOString() };
    },
  };

  function checkBackupText(text: string): BackupInfo {
    const backup = readBackup(text);
    return {
      createdAt: backup.settings.lastBackupAt ?? null,
      exercises: backup.exercises.length,
      sessions: backup.sessions.length,
    };
  }

  function requireServer(): BackupServer {
    if (!server) throw new CoreError("Server backup isn't available here");
    return server;
  }

  function requireConnection() {
    if (!data.serverBackup) throw new CoreError("Set up server backup first");
    return data.serverBackup;
  }

  /** An exercise that can be put into a routine: one that exists and isn't archived. */
  function findActiveExercise(id: string): Exercise {
    const exercise = findExercise(id);
    if (exercise.archived) throw new CoreError(`${exercise.name} is archived`);
    return exercise;
  }

  function hasHistory(exerciseId: string): boolean {
    const sessions = data.activeSession ? [...data.sessions, data.activeSession] : data.sessions;
    return sessions.some((s) => s.entries.some((e) => e.exerciseId === exerciseId));
  }

  /** Why the routine can't be deleted, or null if it can. */
  function routineDeleteProblem(routine: Routine): string | null {
    if (data.activeSession?.routineId === routine.id) return "This routine's session is still running";
    if (data.routines.length === 1) return "You need at least one routine";
    return null;
  }

  function findSession(id: string): Session {
    const session = data.sessions.find((s) => s.id === id);
    if (!session) throw new CoreError(`Unknown session: ${id}`);
    return session;
  }


}

const withoutExercise = (routine: Routine, exerciseId: string): Routine => ({
  ...routine,
  exerciseIds: routine.exerciseIds.filter((id) => id !== exerciseId),
});
