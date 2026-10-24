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
});

/** Fills in fields added after the data was first saved. */
export function normalize(loaded: AppData | null): AppData {
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
