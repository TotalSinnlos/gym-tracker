// The order of a running session's exercises: which comes up next, and when one counts as finished.

import type { SessionEntry } from "./types";

/** Entry ids for exercises in queue order: the exercise id, then `#2`, `#3`… for repeats. */
export function entryIdsFor(exerciseIds: string[]): string[] {
  const seen = new Map<string, number>();
  return exerciseIds.map((id) => {
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    return count === 1 ? id : `${id}#${count}`;
  });
}

/** The pending entries other than `excludeId` (the entry on screen), in queue order: the order they come up in. */
export function pendingExcept(entries: SessionEntry[], excludeId: string | null): SessionEntry[] {
  return entries.filter((e) => e.state === "pending" && e.id !== excludeId);
}

/** Marks an entry done once it has all its sets, and pending again if a set is removed. */
export function settleEntry(entry: SessionEntry): SessionEntry {
  const complete = entry.loggedSets.length >= entry.sets;
  if (entry.state === "pending" && complete) return { ...entry, state: "done" };
  if (entry.state === "done" && !complete) return { ...entry, state: "pending" };
  return entry;
}
