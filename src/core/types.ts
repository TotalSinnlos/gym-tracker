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

export interface AppData {
  version: 1;
  exercises: Exercise[];
  routines: Routine[];
  settings: Settings;
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
