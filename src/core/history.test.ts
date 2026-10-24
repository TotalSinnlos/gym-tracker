import { describe, expect, it } from "vitest";
import { CoreError, createCore, createMemoryStore } from ".";

async function setup() {
  let counter = 0;
  let clock = new Date("2026-10-01T18:00:00Z");
  const store = createMemoryStore();
  const core = await createCore(store, {
    newId: () => `id-${++counter}`,
    now: () => clock,
  });
  // Each session starts a day after the last, so history has distinct dates.
  const nextDay = () => (clock = new Date(clock.getTime() + 24 * 60 * 60 * 1000));
  // 2 sets of 9–12 by default, so 13+ reps on both sets qualifies.
  const press = await core.createExercise({ name: "Leg press", type: "machine", weight: 60 });
  const curl = await core.createExercise({ name: "Curl", type: "freeWeight", weight: 12, increment: 2, sets: 3 });
  const pullUp = await core.createExercise({ name: "Pull-ups", type: "bodyweight" });
  const routine = await core.createRoutine("My routine", [press.id, curl.id, pullUp.id]);
  return { store, core, nextDay, press, curl, pullUp, routine };
}

type Core = Awaited<ReturnType<typeof setup>>["core"];

/** Starts a session, logs the given reps per entry (weight defaults to the session weight) and ends it. */
async function runSession(core: Core, routineId: string, log: Record<string, ({ reps: number; weight?: number } | number)[]>) {
  await core.startSession(routineId);
  for (const [entryId, sets] of Object.entries(log)) {
    for (const set of sets) await core.logSet(entryId, typeof set === "number" ? { reps: set } : set);
  }
  const result = await core.endSession();
  if (!result.session) throw new Error("Session was discarded");
  return result.session;
}

describe("listing history", () => {
  it("lists completed sessions newest first, with their date, routine and entries", async () => {
    const { core, nextDay, routine, press, curl } = await setup();
    const first = await runSession(core, routine.id, { [press.id]: [10, 11] });
    nextDay();
    const other = await core.createRoutine("Arms", [curl.id]);
    const second = await runSession(core, other.id, { [curl.id]: [9] });
    expect(core.listSessions().map((s) => [s.id, s.routineName, s.startedAt])).toEqual([
      [second.id, "Arms", "2026-10-02T18:00:00.000Z"],
      [first.id, "My routine", "2026-10-01T18:00:00.000Z"],
    ]);
    expect(core.getSession(first.id).entries.map((e) => [e.exerciseName, e.state, e.loggedSets])).toEqual([
      ["Leg press", "done", [{ reps: 10, weight: 60 }, { reps: 11, weight: 60 }]],
      ["Curl", "skipped", []],
      ["Pull-ups", "skipped", []],
    ]);
    expect(() => core.getSession("nope")).toThrow(CoreError);
  });

  it("keeps a deleted routine's name", async () => {
    const { core, press } = await setup();
    const other = await core.createRoutine("Old split", [press.id]);
    const session = await runSession(core, other.id, { [press.id]: [10, 10] });
    await core.deleteRoutine(other.id);
    expect(core.getSession(session.id).routineName).toBe("Old split");
  });
});

describe("correcting a past set", () => {
  it("changes reps and weight, keeping the entry's state", async () => {
    const { core, routine, press, curl } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 11], [curl.id]: [9] });
    await core.editPastSet(session.id, press.id, 1, { reps: 12, weight: 55 });
    await core.editPastSet(session.id, curl.id, 0, { reps: 15 });
    const entries = core.getSession(session.id).entries;
    expect(entries[0]).toMatchObject({ state: "done", loggedSets: [{ reps: 10, weight: 60 }, { reps: 12, weight: 55 }] });
    expect(entries[1]).toMatchObject({ state: "incomplete", loggedSets: [{ reps: 15, weight: 12 }] });
  });

  it("is checked like a set logged during a session", async () => {
    const { core, routine, press, pullUp } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 11], [pullUp.id]: [8, 8] });
    await expect(core.editPastSet(session.id, press.id, 0, { reps: -1 })).rejects.toThrow(CoreError);
    await expect(core.editPastSet(session.id, press.id, 0, { reps: 2.5 })).rejects.toThrow(CoreError);
    await expect(core.editPastSet(session.id, press.id, 0, { weight: -5 })).rejects.toThrow(CoreError);
    await expect(core.editPastSet(session.id, press.id, 2, { reps: 10 })).rejects.toThrow(CoreError);
    await expect(core.editPastSet(session.id, "nope", 0, { reps: 10 })).rejects.toThrow(CoreError);
    await expect(core.editPastSet("nope", press.id, 0, { reps: 10 })).rejects.toThrow(CoreError);
    // Bodyweight sets have no weight.
    await core.editPastSet(session.id, pullUp.id, 0, { reps: 9, weight: 20 });
    expect(core.getSession(session.id).entries[2].loggedSets[0]).toEqual({ reps: 9 });
    expect(core.getSession(session.id).entries[0].loggedSets[0]).toEqual({ reps: 10, weight: 60 });
  });

  it("waits until no session is running", async () => {
    const { core, routine, press } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 11] });
    await core.startSession(routine.id);
    await expect(core.editPastSet(session.id, press.id, 0, { reps: 13 })).rejects.toThrow(CoreError);
    await expect(core.deleteSession(session.id)).rejects.toThrow(CoreError);
  });

  it("is kept when the core is reloaded", async () => {
    const { store, core, routine, press } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 11] });
    await core.editPastSet(session.id, press.id, 0, { reps: 12 });
    const reloaded = await createCore(store);
    expect(reloaded.getSession(session.id).entries[0].loggedSets[0]).toEqual({ reps: 12, weight: 60 });
  });
});

describe("recalculating the weight", () => {
  it("raises the weight when a typo in the most recent session is corrected to qualify", async () => {
    const { core, routine, press } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [13, 3] }); // meant 13
    expect(core.getExercise(press.id).weight).toBe(60);
    expect(core.editRecalculatesWeight(session.id, press.id)).toBe(true);
    await core.editPastSet(session.id, press.id, 1, { reps: 13 });
    expect(core.getExercise(press.id).weight).toBe(62.5);
  });

  it("takes back an increase when a typo is corrected to no longer qualify", async () => {
    const { core, routine, press } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [13, 31] }); // meant 13 and 11
    expect(core.getExercise(press.id).weight).toBe(62.5);
    await core.editPastSet(session.id, press.id, 0, { reps: 11 });
    expect(core.getExercise(press.id).weight).toBe(60);
  });

  it("works from the session weight, and a corrected set weight can disqualify", async () => {
    const { core, routine, press } = await setup();
    await core.startSession(routine.id);
    await core.setSessionWeight(press.id, 50);
    await core.logSet(press.id, { reps: 13 });
    await core.logSet(press.id, { reps: 13 });
    const result = await core.endSession();
    expect(core.getExercise(press.id).weight).toBe(52.5);
    await core.editPastSet(result.session!.id, press.id, 1, { weight: 45 });
    expect(core.getExercise(press.id).weight).toBe(50);
  });

  it("replaces a weight changed in settings since the session, as if the session had just ended", async () => {
    const { core, routine, press } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [13, 3] });
    await core.updateExercise(press.id, { weight: 70 });
    await core.editPastSet(session.id, press.id, 1, { reps: 13 });
    expect(core.getExercise(press.id).weight).toBe(62.5);
  });

  it("doesn't change current weights when an older session is corrected", async () => {
    const { core, nextDay, routine, press, curl } = await setup();
    const older = await runSession(core, routine.id, { [press.id]: [13, 3], [curl.id]: [10, 10, 10] });
    nextDay();
    await runSession(core, routine.id, { [press.id]: [10, 10] }); // curl skipped
    await core.updateExercise(curl.id, { weight: 20 });
    expect(core.editRecalculatesWeight(older.id, press.id)).toBe(false);
    await core.editPastSet(older.id, press.id, 1, { reps: 13 });
    expect(core.getExercise(press.id).weight).toBe(60);
    // A skipped entry later doesn't count: the older session is still curl's most recent one.
    expect(core.editRecalculatesWeight(older.id, curl.id)).toBe(true);
    await core.editPastSet(older.id, curl.id, 0, { reps: 11 });
    expect(core.getExercise(curl.id).weight).toBe(12);
  });

  it("only recalculates from the entry that decides the weight when an exercise appears twice", async () => {
    const { core, press } = await setup();
    const twice = await core.createRoutine("Twice", [press.id, press.id]);
    const session = await runSession(core, twice.id, { [press.id]: [13, 13], [`${press.id}#2`]: [13, 3] });
    expect(core.getExercise(press.id).weight).toBe(60);
    // The first occurrence doesn't decide the weight, so correcting it only fixes the record.
    expect(core.editRecalculatesWeight(session.id, press.id)).toBe(false);
    await core.updateExercise(press.id, { weight: 65 });
    await core.editPastSet(session.id, press.id, 0, { reps: 14 });
    expect(core.getExercise(press.id).weight).toBe(65);
    await core.editPastSet(session.id, `${press.id}#2`, 1, { reps: 13 });
    expect(core.getExercise(press.id).weight).toBe(62.5);
  });

  it("leaves the weight alone for an exercise that was only incomplete", async () => {
    const { core, routine, curl } = await setup();
    const session = await runSession(core, routine.id, { [curl.id]: [13, 13] });
    await core.updateExercise(curl.id, { weight: 14 });
    await core.editPastSet(session.id, curl.id, 0, { reps: 15 });
    expect(core.getExercise(curl.id).weight).toBe(14);
  });

  it("keeps a weight set in settings during that session, since it won when the session ended", async () => {
    const { core, routine, press } = await setup();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 13 });
    await core.logSet(press.id, { reps: 3 });
    await core.updateExercise(press.id, { weight: 70 });
    const result = await core.endSession();
    expect(core.getExercise(press.id).weight).toBe(70);
    await core.updateExercise(press.id, { weight: 75 });
    await core.editPastSet(result.session!.id, press.id, 1, { reps: 13 });
    expect(core.getExercise(press.id).weight).toBe(70);
  });

  it("never gives bodyweight exercises a weight", async () => {
    const { core, routine, pullUp } = await setup();
    const session = await runSession(core, routine.id, { [pullUp.id]: [8, 8] });
    await core.editPastSet(session.id, pullUp.id, 0, { reps: 14 });
    expect(core.getExercise(pullUp.id)).toEqual(pullUp);
  });

  it("leaves exercises switched to or from bodyweight since the session alone", async () => {
    const { core, routine, press, pullUp } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [13, 3], [pullUp.id]: [13, 13] });
    await core.updateExercise(press.id, { type: "bodyweight", weight: undefined, increment: undefined });
    await core.updateExercise(pullUp.id, { type: "machine", weight: 10 });
    await core.editPastSet(session.id, press.id, 1, { reps: 13 });
    await core.editPastSet(session.id, pullUp.id, 0, { reps: 3 });
    expect(core.getExercise(press.id).weight).toBeUndefined();
    expect(core.getExercise(pullUp.id).weight).toBe(10);
  });

  it("still recalculates for an archived exercise, which keeps its weight for when it's unarchived", async () => {
    const { core, routine, press } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [13, 3] });
    await core.archiveExercise(press.id);
    await core.editPastSet(session.id, press.id, 1, { reps: 13 });
    expect(core.getExercise(press.id)).toMatchObject({ archived: true, weight: 62.5 });
  });
});

describe("recalculating with a recorded lowering", () => {
  it("keeps the lowered weight while the corrected entry is still below range", async () => {
    const { core, routine, press } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 7] });
    await core.lowerWeightAfterSession(session.id, press.id);
    expect(core.getExercise(press.id).weight).toBe(57.5);
    await core.editPastSet(session.id, press.id, 0, { reps: 6 });
    expect(core.getExercise(press.id).weight).toBe(57.5);
  });

  it("drops the lowering once the entry is no longer below range", async () => {
    const { core, routine, press } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 7] }); // meant 10 and 13
    await core.lowerWeightAfterSession(session.id, press.id);
    await core.editPastSet(session.id, press.id, 1, { reps: 10 });
    expect(core.getExercise(press.id).weight).toBe(60);
    // Back below range, the recorded choice applies again.
    await core.editPastSet(session.id, press.id, 1, { reps: 8 });
    expect(core.getExercise(press.id).weight).toBe(57.5);
  });

  it("drops the lowering on an incomplete entry back to its session weight", async () => {
    const { core, routine, curl } = await setup();
    const session = await runSession(core, routine.id, { [curl.id]: [5] });
    await core.lowerWeightAfterSession(session.id, curl.id);
    expect(core.getExercise(curl.id).weight).toBe(10);
    await core.editPastSet(session.id, curl.id, 0, { reps: 9 });
    expect(core.getExercise(curl.id).weight).toBe(12);
  });
});

describe("deleting a session", () => {
  it("removes it from history but leaves current weights alone", async () => {
    const { core, nextDay, routine, press } = await setup();
    const first = await runSession(core, routine.id, { [press.id]: [10, 10] });
    nextDay();
    const second = await runSession(core, routine.id, { [press.id]: [13, 13] });
    expect(core.getExercise(press.id).weight).toBe(62.5);
    await core.deleteSession(second.id);
    expect(core.listSessions().map((s) => s.id)).toEqual([first.id]);
    expect(core.getExercise(press.id).weight).toBe(62.5);
    // "Last time" now comes from the session before.
    expect(core.lastResult(press.id)?.date).toBe("2026-10-01T18:00:00.000Z");
    expect(() => core.getSession(second.id)).toThrow(CoreError);
    await expect(core.deleteSession(second.id)).rejects.toThrow(CoreError);
  });

  it("lets an exercise whose only history was deleted be deleted too", async () => {
    const { core, routine, press } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 10] });
    expect(core.hasHistory(press.id)).toBe(true);
    await core.deleteSession(session.id);
    expect(core.hasHistory(press.id)).toBe(false);
  });
});
