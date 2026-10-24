export type ExerciseType = "machine" | "freeWeight" | "bodyweight";

export const EXERCISE_TYPES: readonly ExerciseType[] = ["machine", "freeWeight", "bodyweight"];

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  sets: number;
  repMin: number;
  repMax: number;
  /** Current weight in kg. Absent for bodyweight exercises. */
  weight?: number;
  /** Weight step in kg. Absent for bodyweight exercises. */
  increment?: number;
  archived: boolean;
}

export interface Routine {
  id: string;
  name: string;
  exerciseIds: string[];
}

export interface Settings {
  setupComplete: boolean;
}

export interface SetRecord {
  reps: number;
  /** kg. Absent for bodyweight exercises. */
  weight?: number;
}

export type EntryState = "pending" | "done" | "incomplete" | "skipped";

/** One exercise within a session, with the exercise's settings as they were when the session started. */
export interface SessionEntry {
  exerciseId: string;
  exerciseName: string;
  type: ExerciseType;
  sets: number;
  repMin: number;
  repMax: number;
  /** The working weight for this exercise in this session. Absent for bodyweight exercises. */
  sessionWeight?: number;
  loggedSets: SetRecord[];
  state: EntryState;
  /** Set when the user chose "Lower to X kg next time?" in the end-of-session summary. */
  lowered?: boolean;
}

export interface Session {
  id: string;
  routineId: string;
  routineName: string;
  /** ISO timestamps. */
  startedAt: string;
  endedAt?: string;
  /** In queue order. */
  entries: SessionEntry[];
  /** The exercise on screen, or null once nothing is pending. */
  currentExerciseId: string | null;
}

export interface AppData {
  version: 1;
  exercises: Exercise[];
  routines: Routine[];
  settings: Settings;
  activeSession: Session | null;
  /** Completed sessions, oldest first. */
  sessions: Session[];
}

export interface ExerciseInput {
  name: string;
  type: ExerciseType;
  sets?: number;
  repMin?: number;
  repMax?: number;
  weight?: number;
  increment?: number;
}

export type ExercisePatch = Partial<ExerciseInput>;

export const isWeighted = (type: ExerciseType) => type !== "bodyweight";
