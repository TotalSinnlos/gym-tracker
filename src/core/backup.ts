// Backup files: everything as JSON, and checking a file thoroughly before it replaces the data.

import { normalize } from "./data";
import {
  type AppData,
  type EntryState,
  type Exercise,
  type ExerciseInput,
  type ExerciseType,
  type SessionEntry,
  ENTRY_STATES,
  EXERCISE_TYPES,
  isWeighted,
} from "./types";
import { CoreError, buildExercise } from "./validation";

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

/** All data as a backup file, stamped with `createdAt` as the last backup time. */
export function writeBackup(data: AppData, createdAt: string): Backup {
  const backup: AppData = { ...data, settings: { ...data.settings, lastBackupAt: createdAt } };
  return { text: JSON.stringify(backup, null, 2), createdAt };
}

/** Parses and checks a backup file, upgrading an older one. Throws a CoreError if it can't be restored. */
export function readBackup(text: string): AppData {
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
