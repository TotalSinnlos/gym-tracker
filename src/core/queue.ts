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

/** The pending entries other than `entryId`, in queue order starting after it and wrapping round to the start. */
export function pendingAfter(entries: SessionEntry[], entryId: string): SessionEntry[] {
  const index = entries.findIndex((e) => e.id === entryId);
  const rotated = [...entries.slice(index + 1), ...entries.slice(0, index)];
  return rotated.filter((e) => e.state === "pending");
}

/**
 * The pending entries in the order they come up: the one the user left behind first,
 * then the rest in queue order. Leaves out `excludeId` (the entry on screen).
 */
export function nextInQueue(entries: SessionEntry[], returnToId: string | null, excludeId: string | null): SessionEntry[] {
  const pending = entries.filter((e) => e.state === "pending" && e.id !== excludeId);
  const returnTo = pending.find((e) => e.id === returnToId);
  return returnTo ? [returnTo, ...pending.filter((e) => e !== returnTo)] : pending;
}

/** Marks an entry done once it has all its sets, and pending again if a set is removed. */
export function settleEntry(entry: SessionEntry): SessionEntry {
  const complete = entry.loggedSets.length >= entry.sets;
  if (entry.state === "pending" && complete) return { ...entry, state: "done" };
  if (entry.state === "done" && !complete) return { ...entry, state: "pending" };
  return entry;
}
