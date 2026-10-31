// Saved data: what a fresh app starts with, and upgrading data saved by earlier versions.

import { entryIdsFor } from "./queue";
import type { AppData, Session } from "./types";

export const emptyData = (): AppData => ({
  version: 1,
  exercises: [],
  routines: [],
  settings: { setupComplete: false },
  activeSession: null,
  sessions: [],
  serverBackup: null,
  trainerDue: [],
});

/** Fills in fields added after the data was first saved. */
export function normalize(loaded: AppData | null): AppData {
  const empty = emptyData();
  if (!loaded) return empty;
  const upgradeSession = (saved: Session): Session => {
    // Before entries had ids, each exercise appeared once and the session tracked `currentExerciseId`.
    // `returnToEntryId` belonged to "Skip for now", which flipping between exercises replaced.
    const { currentExerciseId, returnToEntryId, ...session } = saved as Session & {
      currentExerciseId?: string | null;
      returnToEntryId?: string | null;
    };
    const ids = entryIdsFor(session.entries.map((e) => e.exerciseId));
    // Sessions show their routine's current name: renames made before renaming did this too.
    const routine = loaded.routines?.find((r) => r.id === session.routineId);
    return {
      ...session,
      routineName: routine?.name ?? session.routineName,
      entries: session.entries.map((e, i) => ({ ...e, id: e.id ?? ids[i] })),
      currentEntryId: session.currentEntryId ?? currentExerciseId ?? null,
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
