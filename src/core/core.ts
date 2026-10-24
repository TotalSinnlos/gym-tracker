import type { Store } from "./store";
import {
  type AppData,
  type Exercise,
  type ExerciseInput,
  type ExercisePatch,
  type ExerciseType,
  type Routine,
  type EntryState,
  type Session,
  type SessionEntry,
  type SetRecord,
  ENTRY_STATES,
  EXERCISE_TYPES,
  isWeighted,
} from "./types";

export const DEFAULT_SETS = 2;
export const DEFAULT_REP_MIN = 9;
export const DEFAULT_REP_MAX = 12;
export const DEFAULT_INCREMENT = 2.5;

/** Thrown when a command is given input the rules don't allow. */
export class CoreError extends Error {}

const emptyData = (): AppData => ({
  version: 1,
  exercises: [],
  routines: [],
  settings: { setupComplete: false },
  activeSession: null,
  sessions: [],
});

export type Core = Awaited<ReturnType<typeof createCore>>;

export interface CoreOptions {
  newId?: () => string;
  now?: () => Date;
}

/** What the end-of-session summary shows about progression. */
export interface ProgressionSummary {
  /** Weighted exercises that go up next time. */
  increases: { exerciseId: string; name: string; fromKg: number; toKg: number }[];
  /** Bodyweight exercises where every set beat the rep range. */
  repRangeBeaten: { exerciseId: string; name: string }[];
  /** Exercises with a set under the rep minimum. `lowerToKg` is offered for weighted ones only. */
  belowRange: { entryId: string; exerciseId: string; name: string; lowerToKg?: number }[];
}

/** The saved session with its summary, or `session: null` when nothing was logged and it was discarded. */
export type EndSessionResult = { session: Session; summary: ProgressionSummary } | { session: null };

/** Last time's results for an exercise: its latest done or incomplete entry from any routine. */
export interface LastResult {
  entry: SessionEntry;
  /** ISO start time of that session. */
  date: string;
}

/** A backup file's contents, made by `createBackup`. */
export interface Backup {
  /** All data as JSON. */
  text: string;
  /** ISO time the backup was made. */
  createdAt: string;
}

/** What a backup file holds, shown before restoring it. */
export interface BackupInfo {
  /** ISO time the backup was made, or null if the file doesn't say. */
  createdAt: string | null;
  exercises: number;
  sessions: number;
}

export async function createCore(store: Store, options: CoreOptions = {}) {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
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
    let { currentEntryId, returnToEntryId } = session;
    // Finishing the exercise on screen moves on: back to the one left behind, else the first pending one.
    if (before.state === "pending" && after.state === "done" && currentEntryId === entryId) {
      currentEntryId = nextInQueue(entries, returnToEntryId ?? null, entryId)[0]?.id ?? null;
      returnToEntryId = null;
    }
    await commit({ ...data, activeSession: { ...session, entries, currentEntryId, returnToEntryId } });
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

    getExercise: (id: string) => findExercise(id),

    /** How far the −/+ buttons move an exercise's weight. */
    weightStep: (exerciseId: string) => findExercise(exerciseId).increment ?? DEFAULT_INCREMENT,

    // --- Routines ---

    async createRoutine(name: string, exerciseIds: string[] = []): Promise<Routine> {
      exerciseIds.forEach(findExercise);
      const routine: Routine = { id: newId(), name: requireName(name), exerciseIds: [...exerciseIds] };
      await commit({ ...data, routines: [...data.routines, routine] });
      return routine;
    },

    async renameRoutine(id: string, name: string) {
      await replaceRoutine({ ...findRoutine(id), name: requireName(name) });
    },

    /** Adds an exercise to the end of the routine. The same exercise may appear more than once. */
    async addExerciseToRoutine(routineId: string, exerciseId: string) {
      const routine = findRoutine(routineId);
      findExercise(exerciseId);
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

    listRoutines: () => data.routines,

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
      const exercises = routine.exerciseIds.map(findExercise);
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
        returnToEntryId: null,
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
     * Puts an entry of the running session on screen: jumps to another exercise, or reopens a finished
     * one to correct it. Leaving an unfinished exercise remembers it, so it comes up next.
     */
    async goToEntry(entryId: string) {
      const session = requireActiveSession();
      findEntry(session, entryId);
      if (entryId === session.currentEntryId) return;
      const current = session.currentEntryId ? findEntry(session, session.currentEntryId) : null;
      const returnToEntryId =
        current?.state === "pending" ? current.id : session.returnToEntryId === entryId ? null : session.returnToEntryId;
      await commit({ ...data, activeSession: { ...session, currentEntryId: entryId, returnToEntryId } });
    },

    // --- Session queue ---

    /** Whether "Skip for now" is available: the exercise on screen is pending and another one is too. */
    canSkip(): boolean {
      const session = data.activeSession;
      if (!session?.currentEntryId) return false;
      const current = findEntry(session, session.currentEntryId);
      return current.state === "pending" && pendingAfter(session.entries, current.id).length > 0;
    },

    /** Swaps the exercise on screen with the next pending one, so it comes back straight after it. */
    async skipCurrent() {
      const session = requireActiveSession();
      const current = session.currentEntryId ? findEntry(session, session.currentEntryId) : null;
      const next = current?.state === "pending" ? pendingAfter(session.entries, current.id)[0] : undefined;
      if (!current || !next) throw new CoreError("There's no other exercise to do first");
      const entries = session.entries.filter((e) => e !== current);
      entries.splice(entries.indexOf(next) + 1, 0, current);
      await commit({
        ...data,
        activeSession: { ...session, entries, currentEntryId: next.id, returnToEntryId: current.id },
      });
    },

    /** The pending exercises other than the one on screen, in the order they come up. */
    upNext(): SessionEntry[] {
      const session = data.activeSession;
      if (!session) return [];
      return nextInQueue(session.entries, session.returnToEntryId ?? null, session.currentEntryId);
    },

    /** How many exercises are still to do. */
    pendingCount: () => data.activeSession?.entries.filter((e) => e.state === "pending").length ?? 0,

    /**
     * Saves the session: untouched exercises become skipped, partly logged ones incomplete,
     * and finished weighted exercises keep their session weight as their current weight,
     * plus one increment when they qualify (see "Progression rules" below).
     * A session with nothing logged is discarded.
     */
    async endSession(): Promise<EndSessionResult> {
      const session = requireActiveSession();
      if (session.entries.every((e) => e.loggedSets.length === 0)) {
        await commit({ ...data, activeSession: null });
        return { session: null };
      }
      const ended: Session = {
        ...session,
        endedAt: now().toISOString(),
        currentEntryId: null,
        returnToEntryId: null,
        entries: session.entries.map((e) =>
          e.state === "pending" ? { ...e, state: e.loggedSets.length > 0 ? "incomplete" : "skipped" } : e,
        ),
      };
      const exercises = data.exercises.map((exercise) => {
        const override = ended.weightOverrides?.[exercise.id];
        if (override !== undefined) return { ...exercise, weight: override };
        const entry = decidingEntry(ended, exercise.id, ["done"]);
        // An exercise switched to bodyweight during the session gets no weight back.
        if (!entry || entry.sessionWeight === undefined || !isWeighted(exercise.type)) return exercise;
        return { ...exercise, weight: progressedWeight(entry, exercise) };
      });
      await commit({ ...data, exercises, activeSession: null, sessions: [...data.sessions, ended] });
      return { session: ended, summary: summarizeProgression(ended, data.exercises) };
    },

    /** Completed sessions, newest first. */
    listSessions: () => [...data.sessions].reverse(),

    // --- Progression ---

    /** Last time's results for an exercise, or null if it has never been done. */
    lastResult: (exerciseId: string) => findLastResult(exerciseId),

    /**
     * How far the exercise's current weight has moved since last time (e.g. +2.5 after an increase).
     * Null for bodyweight exercises and exercises with no history.
     */
    weightChangeSinceLastTime(exerciseId: string): number | null {
      const exercise = findExercise(exerciseId);
      const last = findLastResult(exerciseId);
      if (exercise.weight === undefined || last?.entry.sessionWeight === undefined) return null;
      return exercise.weight - last.entry.sessionWeight;
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
      if (findLastResult(exercise.id)?.entry !== entry) {
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
    createBackup(): Backup {
      const createdAt = now().toISOString();
      const backup: AppData = { ...data, settings: { ...data.settings, lastBackupAt: createdAt } };
      return { text: JSON.stringify(backup, null, 2), createdAt };
    },

    /** Remembers that the backup was saved, for "Last backup". */
    async recordBackup(backup: Backup) {
      await commit({ ...data, settings: { ...data.settings, lastBackupAt: backup.createdAt } });
    },

    /** Checks a backup file without changing anything. Throws a CoreError saying what's wrong if it can't be restored. */
    checkBackup(text: string): BackupInfo {
      const backup = readBackup(text);
      return {
        createdAt: backup.settings.lastBackupAt ?? null,
        exercises: backup.exercises.length,
        sessions: backup.sessions.length,
      };
    },

    /**
     * Replaces all data, including a running session, with the backup's. An older backup is upgraded
     * the same way as older saved data. A file that can't be restored is rejected and nothing changes.
     */
    async restoreBackup(text: string) {
      await commit(readBackup(text));
    },
  };

  function findSession(id: string): Session {
    const session = data.sessions.find((s) => s.id === id);
    if (!session) throw new CoreError(`Unknown session: ${id}`);
    return session;
  }

  /** The latest done or incomplete entry for the exercise across completed sessions. */
  function findLastResult(exerciseId: string): LastResult | null {
    for (let i = data.sessions.length - 1; i >= 0; i--) {
      const session = data.sessions[i];
      const entry = decidingEntry(session, exerciseId, ["done", "incomplete"]);
      if (entry) return { entry, date: session.startedAt };
    }
    return null;
  }
}

// --- Data ---

/** Fills in fields added after the data was first saved. */
function normalize(loaded: AppData | null): AppData {
  const empty = emptyData();
  if (!loaded) return empty;
  const upgradeSession = (session: Session): Session => {
    // Before entries had ids, each exercise appeared once and the session tracked `currentExerciseId`.
    const legacy = session as Session & { currentExerciseId?: string | null };
    const ids = entryIdsFor(session.entries.map((e) => e.exerciseId));
    return {
      ...session,
      entries: session.entries.map((e, i) => ({ ...e, id: e.id ?? ids[i] })),
      currentEntryId: session.currentEntryId ?? legacy.currentExerciseId ?? null,
    };
  };
  return {
    ...empty,
    ...loaded,
    settings: { ...empty.settings, ...loaded.settings },
    activeSession: loaded.activeSession ? upgradeSession(loaded.activeSession) : null,
    sessions: (loaded.sessions ?? []).map(upgradeSession),
  };
}

// --- Backup rules ---

/** Parses and checks a backup file, upgrading an older one. Throws a CoreError if it can't be restored. */
function readBackup(text: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new CoreError("This file isn't a backup: it couldn't be read.");
  }
  if (!isObject(raw) || !("version" in raw)) invalidBackup("it has no format version");
  if (raw.version !== 1) {
    if (typeof raw.version === "number" && raw.version > 1) {
      throw new CoreError("This backup was made by a newer version of the app. Update the app, then try again.");
    }
    throw new CoreError(`This backup's format version (${JSON.stringify(raw.version)}) isn't supported.`);
  }
  if (!Array.isArray(raw.exercises) || !Array.isArray(raw.routines) || !isObject(raw.settings)) {
    invalidBackup("its exercises, routines or settings are missing");
  }
  let data: AppData;
  try {
    data = normalize(raw as unknown as AppData);
  } catch {
    invalidBackup("its sessions are damaged");
  }
  checkData(data);
  return data;
}

function invalidBackup(problem: string): never {
  throw new CoreError(`This file isn't a valid backup: ${problem}.`);
}

/** Checks every part of (normalized) backup data, so the rest of the core can rely on it. */
function checkData(data: AppData) {
  const exerciseIds = new Set<string>();
  for (const exercise of data.exercises as unknown[]) {
    checkExercise(exercise);
    if (exerciseIds.has(exercise.id)) invalidBackup("two exercises share an id");
    exerciseIds.add(exercise.id);
  }
  const routineIds = new Set<string>();
  for (const routine of data.routines as unknown[]) {
    if (!isObject(routine) || !isText(routine.id) || !isText(routine.name) || !Array.isArray(routine.exerciseIds)) {
      invalidBackup("a routine is damaged");
    }
    if (routineIds.has(routine.id)) invalidBackup("two routines share an id");
    routineIds.add(routine.id);
    if (!routine.exerciseIds.every((id) => exerciseIds.has(id as string))) {
      invalidBackup(`routine "${routine.name}" uses an exercise that isn't in the backup`);
    }
  }
  const settings: unknown = data.settings;
  if (!isObject(settings) || typeof settings.setupComplete !== "boolean" || !isOptional(settings.lastBackupAt, isTime)) {
    invalidBackup("its settings are damaged");
  }
  if (data.activeSession !== null && !isSession(data.activeSession, true)) invalidBackup("the running session is damaged");
  if (!data.sessions.every((s) => isSession(s, false))) invalidBackup("a saved session is damaged");
}

function checkExercise(exercise: unknown): asserts exercise is Exercise {
  if (!isObject(exercise) || !isText(exercise.id) || typeof exercise.name !== "string") {
    invalidBackup("an exercise is damaged");
  }
  const type = exercise.type as ExerciseType;
  const missingWeight =
    EXERCISE_TYPES.includes(type) && isWeighted(type) && (exercise.weight === undefined || exercise.increment === undefined);
  if (typeof exercise.archived !== "boolean" || missingWeight) invalidBackup(`exercise "${exercise.name}" is damaged`);
  try {
    buildExercise(exercise.id, exercise as unknown as ExerciseInput);
  } catch (e) {
    invalidBackup(`exercise "${exercise.name}" is damaged (${(e as Error).message})`);
  }
}

function isSession(value: unknown, active: boolean): boolean {
  if (!isObject(value) || !Array.isArray(value.entries) || !value.entries.every(isEntry)) return false;
  const entryIds = value.entries.map((e) => (e as SessionEntry).id);
  const isEntryId = (id: unknown) => id === null || id === undefined || entryIds.includes(id as string);
  return (
    isText(value.id) &&
    typeof value.routineId === "string" &&
    typeof value.routineName === "string" &&
    isTime(value.startedAt) &&
    (active ? value.endedAt === undefined : isTime(value.endedAt)) &&
    new Set(entryIds).size === entryIds.length &&
    isEntryId(value.currentEntryId) &&
    isEntryId(value.returnToEntryId) &&
    isOptional(value.weightOverrides, (o) => isObject(o) && Object.values(o).every(isKg))
  );
}

function isEntry(value: unknown): boolean {
  return (
    isObject(value) &&
    isText(value.id) &&
    isText(value.exerciseId) &&
    typeof value.exerciseName === "string" &&
    EXERCISE_TYPES.includes(value.type as ExerciseType) &&
    [value.sets, value.repMin, value.repMax].every(isCount) &&
    isOptional(value.sessionWeight, isKg) &&
    Array.isArray(value.loggedSets) &&
    value.loggedSets.every((set) => isObject(set) && isCount(set.reps) && isOptional(set.weight, isKg)) &&
    ENTRY_STATES.includes(value.state as EntryState) &&
    isOptional(value.lowered, (v) => typeof v === "boolean")
  );
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value !== "";
const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
const isKg = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isTime = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const isOptional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);

/** Entry ids for exercises in queue order: the exercise id, then `#2`, `#3`… for repeats. */
function entryIdsFor(exerciseIds: string[]): string[] {
  const seen = new Map<string, number>();
  return exerciseIds.map((id) => {
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    return count === 1 ? id : `${id}#${count}`;
  });
}

// --- Progression rules ---

/** The exercise's entry that counts for this session: its last one in queue order with one of `states`. */
function decidingEntry(session: Session, exerciseId: string, states: SessionEntry["state"][]) {
  return session.entries.findLast((e) => e.exerciseId === exerciseId && states.includes(e.state));
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

/** Any set fell under the rep minimum. */
function isBelowRange(entry: SessionEntry): boolean {
  return entry.loggedSets.some((set) => set.reps < entry.repMin);
}

/** A done weighted entry's new current weight: the session weight, plus the increment if it qualifies. */
function progressedWeight(entry: SessionEntry, exercise: Exercise): number {
  const weight = entry.sessionWeight!;
  return beatsRepRange(entry) ? weight + (exercise.increment ?? 0) : weight;
}

const loweredWeight = (sessionWeight: number, increment: number) => Math.max(0, sessionWeight - increment);

function summarizeProgression(session: Session, exercises: Exercise[]): ProgressionSummary {
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

// --- Queue rules ---

/** The pending entries other than `entryId`, in queue order starting after it and wrapping round to the start. */
function pendingAfter(entries: SessionEntry[], entryId: string): SessionEntry[] {
  const index = entries.findIndex((e) => e.id === entryId);
  const rotated = [...entries.slice(index + 1), ...entries.slice(0, index)];
  return rotated.filter((e) => e.state === "pending");
}

/**
 * The pending entries in the order they come up: the one the user left behind first,
 * then the rest in queue order. Leaves out `excludeId` (the entry on screen).
 */
function nextInQueue(entries: SessionEntry[], returnToId: string | null, excludeId: string | null): SessionEntry[] {
  const pending = entries.filter((e) => e.state === "pending" && e.id !== excludeId);
  const returnTo = pending.find((e) => e.id === returnToId);
  return returnTo ? [returnTo, ...pending.filter((e) => e !== returnTo)] : pending;
}

/** Marks an entry done once it has all its sets, and pending again if a set is removed. */
function settleEntry(entry: SessionEntry): SessionEntry {
  const complete = entry.loggedSets.length >= entry.sets;
  if (entry.state === "pending" && complete) return { ...entry, state: "done" };
  if (entry.state === "done" && !complete) return { ...entry, state: "pending" };
  return entry;
}

function buildSet(entry: SessionEntry, reps: number, weight: number | undefined): SetRecord {
  requireWholeNumber(reps, 0, "Reps");
  if (entry.sessionWeight === undefined) return { reps };
  if (weight === undefined) throw new CoreError("Weight is missing");
  return { reps, weight: requireWeight(weight) };
}

function requireWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight < 0) throw new CoreError("Weight can't be negative");
  return weight;
}

function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new CoreError("Name can't be empty");
  return trimmed;
}

function requireWholeNumber(value: number, min: number, label: string): number {
  if (!Number.isInteger(value) || value < min) throw new CoreError(`${label} must be a whole number of at least ${min}`);
  return value;
}

function buildExercise(id: string, input: ExerciseInput): Exercise {
  if (!EXERCISE_TYPES.includes(input.type)) throw new CoreError(`Unknown exercise type: ${input.type}`);
  const sets = requireWholeNumber(input.sets ?? DEFAULT_SETS, 1, "Sets");
  const repMin = requireWholeNumber(input.repMin ?? DEFAULT_REP_MIN, 1, "Minimum reps");
  const repMax = requireWholeNumber(input.repMax ?? DEFAULT_REP_MAX, 1, "Maximum reps");
  if (repMin > repMax) throw new CoreError("Minimum reps can't be more than maximum reps");

  const exercise: Exercise = { id, name: requireName(input.name), type: input.type, sets, repMin, repMax, archived: false };
  if (isWeighted(input.type)) {
    const weight = input.weight ?? 0;
    const increment = input.increment ?? DEFAULT_INCREMENT;
    if (!Number.isFinite(weight) || weight < 0) throw new CoreError("Weight can't be negative");
    if (!Number.isFinite(increment) || increment <= 0) throw new CoreError("Increment must be more than 0");
    exercise.weight = weight;
    exercise.increment = increment;
  }
  return exercise;
}
