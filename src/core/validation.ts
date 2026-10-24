// Checking what the user enters: exercises, sets and names. Breaking a rule throws a CoreError with a
// message the screens show as it is.

import { type Exercise, type ExerciseInput, type SessionEntry, type SetRecord, EXERCISE_TYPES, isWeighted } from "./types";

export const DEFAULT_SETS = 2;
export const DEFAULT_REP_MIN = 9;
export const DEFAULT_REP_MAX = 12;
export const DEFAULT_INCREMENT = 2.5;

/** Thrown when a command is given input the rules don't allow. */
export class CoreError extends Error {}

export function buildExercise(id: string, input: ExerciseInput): Exercise {
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

export function buildSet(entry: SessionEntry, reps: number, weight: number | undefined): SetRecord {
  requireWholeNumber(reps, 0, "Reps");
  if (entry.sessionWeight === undefined) return { reps };
  if (weight === undefined) throw new CoreError("Weight is missing");
  return { reps, weight: requireWeight(weight) };
}

export function requireWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight < 0) throw new CoreError("Weight can't be negative");
  return weight;
}

export function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new CoreError("Name can't be empty");
  return trimmed;
}

function requireWholeNumber(value: number, min: number, label: string): number {
  if (!Number.isInteger(value) || value < min) throw new CoreError(`${label} must be a whole number of at least ${min}`);
  return value;
}
