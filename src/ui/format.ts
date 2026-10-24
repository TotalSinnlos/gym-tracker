import type { SessionEntry, SetRecord } from "../core";

// Accepts "42,5" as well as "42.5", since Android keyboards may offer either.
export const parseNumber = (text: string) => (text.trim() === "" ? NaN : Number(text.replace(",", ".")));

export const formatKg = (kg: number) => `${kg.toLocaleString("en", { maximumFractionDigits: 2 })} kg`;

export const formatSet = (set: SetRecord) => (set.weight === undefined ? `${set.reps} reps` : `${set.reps} × ${formatKg(set.weight)}`);

export const formatReps = (entry: SessionEntry) => entry.loggedSets.map((s) => s.reps).join(" / ");

export const formatEntryWeight = (entry: SessionEntry) =>
  entry.sessionWeight === undefined ? "Bodyweight" : formatKg(entry.sessionWeight);
