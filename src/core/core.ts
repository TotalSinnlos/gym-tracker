import type { Store } from "./store";
import {
  type AppData,
  type Exercise,
  type ExerciseInput,
  type ExercisePatch,
  type Routine,
  type Session,
  type SessionEntry,
  type SetRecord,
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

export interface EndSessionResult {
  /** The saved session, or null when nothing was logged and it was discarded. */
  session: Session | null;
}

export async function createCore(store: Store, options: CoreOptions = {}) {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  // Fill in fields added after the data was first saved.
  let data: AppData = { ...emptyData(), ...(await store.load()) };
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

  function findEntry(session: Session, exerciseId: string): SessionEntry {
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry) throw new CoreError("That exercise isn't part of this session");
    return entry;
  }

  /** Applies `change` to one entry of the active session, then settles its state and the current exercise. */
  async function changeEntry(exerciseId: string, change: (entry: SessionEntry) => SessionEntry) {
    const session = requireActiveSession();
    const before = findEntry(session, exerciseId);
    const after = settleEntry(change(before));
    const entries = session.entries.map((e) => (e.exerciseId === exerciseId ? after : e));
    let currentExerciseId = session.currentExerciseId;
    // Finishing the exercise on screen moves on to the next pending one in queue order.
    if (before.state === "pending" && after.state === "done" && currentExerciseId === exerciseId) {
      currentExerciseId = pendingAfter(entries, exerciseId)[0]?.exerciseId ?? null;
    }
    await commit({ ...data, activeSession: { ...session, entries, currentExerciseId } });
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
      // A weight change made in settings applies to a running session straight away.
      let activeSession = data.activeSession;
      if (activeSession && exercise.weight !== undefined && exercise.weight !== current.weight) {
        activeSession = {
          ...activeSession,
          entries: activeSession.entries.map((e) =>
            e.exerciseId === id && e.state === "pending" && e.sessionWeight !== undefined
              ? { ...e, sessionWeight: exercise.weight }
              : e,
          ),
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

    async addExerciseToRoutine(routineId: string, exerciseId: string) {
      const routine = findRoutine(routineId);
      findExercise(exerciseId);
      if (routine.exerciseIds.includes(exerciseId)) {
        throw new CoreError("That exercise is already in this routine");
      }
      await replaceRoutine({ ...routine, exerciseIds: [...routine.exerciseIds, exerciseId] });
    },

    async removeExerciseFromRoutine(routineId: string, exerciseId: string) {
      const routine = findRoutine(routineId);
      await replaceRoutine({ ...routine, exerciseIds: routine.exerciseIds.filter((id) => id !== exerciseId) });
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
      const session: Session = {
        id: newId(),
        routineId: routine.id,
        routineName: routine.name,
        startedAt: now().toISOString(),
        entries: exercises.map((exercise) => ({
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
        currentExerciseId: exercises[0].id,
      };
      await commit({ ...data, activeSession: session });
      return session;
    },

    activeSession: () => data.activeSession,

    /** The entry on screen, or null when every exercise is finished. */
    currentEntry(): SessionEntry | null {
      const session = data.activeSession;
      if (!session?.currentExerciseId) return null;
      return findEntry(session, session.currentExerciseId);
    },

    async setSessionWeight(exerciseId: string, weight: number) {
      requireWeight(weight);
      await changeEntry(exerciseId, (entry) => {
        if (entry.sessionWeight === undefined) throw new CoreError("Bodyweight exercises have no weight");
        return { ...entry, sessionWeight: weight };
      });
    },

    /** Logs a set. The weight defaults to the session weight. */
    async logSet(exerciseId: string, set: { reps: number; weight?: number }) {
      await changeEntry(exerciseId, (entry) => ({
        ...entry,
        loggedSets: [...entry.loggedSets, buildSet(entry, set.reps, set.weight ?? entry.sessionWeight)],
      }));
    },

    async editSet(exerciseId: string, index: number, change: { reps?: number; weight?: number }) {
      await changeEntry(exerciseId, (entry) => {
        const set = entry.loggedSets[index];
        if (!set) throw new CoreError("No such set");
        const edited = buildSet(entry, change.reps ?? set.reps, change.weight ?? set.weight);
        return { ...entry, loggedSets: entry.loggedSets.map((s, i) => (i === index ? edited : s)) };
      });
    },

    async removeSet(exerciseId: string, index: number) {
      await changeEntry(exerciseId, (entry) => {
        if (!entry.loggedSets[index]) throw new CoreError("No such set");
        return { ...entry, loggedSets: entry.loggedSets.filter((_, i) => i !== index) };
      });
    },

    /** Puts an exercise of the running session on screen, e.g. to correct a finished one. */
    async goToExercise(exerciseId: string) {
      const session = requireActiveSession();
      findEntry(session, exerciseId);
      await commit({ ...data, activeSession: { ...session, currentExerciseId: exerciseId } });
    },

    // --- Session queue ---

    /** Whether "Skip for now" is available: the exercise on screen is pending and another one is too. */
    canSkip(): boolean {
      const session = data.activeSession;
      if (!session?.currentExerciseId) return false;
      const current = findEntry(session, session.currentExerciseId);
      return current.state === "pending" && pendingAfter(session.entries, current.exerciseId).length > 0;
    },

    /** Swaps the exercise on screen with the next pending one, so it comes back straight after it. */
    async skipCurrent() {
      const session = requireActiveSession();
      const currentId = session.currentExerciseId;
      const current = currentId ? findEntry(session, currentId) : null;
      const next = current?.state === "pending" ? pendingAfter(session.entries, current.exerciseId)[0] : undefined;
      if (!current || !next) throw new CoreError("There's no other exercise to do first");
      const entries = session.entries.filter((e) => e !== current);
      entries.splice(entries.indexOf(next) + 1, 0, current);
      await commit({ ...data, activeSession: { ...session, entries, currentExerciseId: next.exerciseId } });
    },

    /** The pending exercises other than the one on screen, in the order they come up. */
    upNext(): SessionEntry[] {
      const session = data.activeSession;
      if (!session) return [];
      if (!session.currentExerciseId) return session.entries.filter((e) => e.state === "pending");
      return pendingAfter(session.entries, session.currentExerciseId);
    },

    /** How many exercises are still to do. */
    pendingCount: () => data.activeSession?.entries.filter((e) => e.state === "pending").length ?? 0,

    /**
     * Saves the session: untouched exercises become skipped, partly logged ones incomplete,
     * and finished weighted exercises keep their session weight as their current weight.
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
        currentExerciseId: null,
        entries: session.entries.map((e) =>
          e.state === "pending" ? { ...e, state: e.loggedSets.length > 0 ? "incomplete" : "skipped" } : e,
        ),
      };
      const exercises = data.exercises.map((exercise) => {
        const entry = ended.entries.find((e) => e.exerciseId === exercise.id);
        if (entry?.state !== "done" || entry.sessionWeight === undefined) return exercise;
        return { ...exercise, weight: entry.sessionWeight };
      });
      await commit({ ...data, exercises, activeSession: null, sessions: [...data.sessions, ended] });
      return { session: ended };
    },

    /** Completed sessions, newest first. */
    listSessions: () => [...data.sessions].reverse(),
  };
}

/** The pending entries other than `exerciseId`, in queue order starting after it and wrapping round to the start. */
function pendingAfter(entries: SessionEntry[], exerciseId: string): SessionEntry[] {
  const index = entries.findIndex((e) => e.exerciseId === exerciseId);
  const rotated = [...entries.slice(index + 1), ...entries.slice(0, index)];
  return rotated.filter((e) => e.state === "pending");
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
