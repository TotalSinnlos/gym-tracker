import { describe, expect, it } from "vitest";
import { CoreError, createCore, createMemoryStore } from ".";

async function setup() {
  let counter = 0;
  const store = createMemoryStore();
  const core = await createCore(store, {
    newId: () => `id-${++counter}`,
    now: () => new Date("2026-10-24T18:00:00Z"),
  });
  // 2 sets of 9–12 by default, so 13+ reps on both sets qualifies.
  const press = await core.createExercise({ name: "Leg press", type: "machine", weight: 60 });
  const curl = await core.createExercise({ name: "Curl", type: "freeWeight", weight: 12, increment: 2, sets: 3 });
  const pullUp = await core.createExercise({ name: "Pull-ups", type: "bodyweight" });
  const routine = await core.createRoutine("My routine", [press.id, curl.id, pullUp.id]);
  return { store, core, press, curl, pullUp, routine };
}

type Core = Awaited<ReturnType<typeof setup>>["core"];

/** Starts a session, logs the given reps per exercise (weight defaults to the session weight) and ends it. */
async function runSession(core: Core, routineId: string, log: Record<string, ({ reps: number; weight?: number } | number)[]>) {
  await core.startSession(routineId);
  for (const [exerciseId, sets] of Object.entries(log)) {
    for (const set of sets) await core.logSet(exerciseId, typeof set === "number" ? { reps: set } : set);
  }
  const result = await core.endSession();
  if (!result.session) throw new Error("Session was discarded");
  return result;
}

describe("progression when a session ends", () => {
  it("raises a qualifying weighted exercise by its increment", async () => {
    const { core, routine, press } = await setup();
    const { summary } = await runSession(core, routine.id, { [press.id]: [13, 14] });
    expect(core.getExercise(press.id).weight).toBe(62.5);
    expect(summary.increases).toEqual([{ exerciseId: press.id, name: "Leg press", fromKg: 60, toKg: 62.5 }]);
  });

  it("doesn't raise it when one set is short of the threshold", async () => {
    const { core, routine, press } = await setup();
    const { summary } = await runSession(core, routine.id, { [press.id]: [13, 12] });
    expect(core.getExercise(press.id).weight).toBe(60);
    expect(summary.increases).toEqual([]);
  });

  it("doesn't raise it when fewer sets than configured were done", async () => {
    const { core, routine, curl } = await setup();
    await core.startSession(routine.id);
    await core.logSet(curl.id, { reps: 15 });
    await core.logSet(curl.id, { reps: 15 });
    // Ending now leaves it incomplete with 2 of 3 sets.
    const result = await core.endSession();
    expect(result.session?.entries.find((e) => e.exerciseId === curl.id)?.state).toBe("incomplete");
    expect(core.getExercise(curl.id).weight).toBe(12);
  });

  it("requires every logged set to qualify, including extra sets", async () => {
    const { core, routine, press } = await setup();
    const { summary } = await runSession(core, routine.id, { [press.id]: [13, 13, 11] });
    expect(core.getExercise(press.id).weight).toBe(60);
    expect(summary.increases).toEqual([]);
  });

  it("doesn't raise it when a set was done at a lower weight", async () => {
    const { core, routine, press } = await setup();
    await runSession(core, routine.id, { [press.id]: [13, { reps: 15, weight: 55 }] });
    expect(core.getExercise(press.id).weight).toBe(60);
  });

  it("counts sets done above the session weight", async () => {
    const { core, routine, press } = await setup();
    await runSession(core, routine.id, { [press.id]: [13, { reps: 13, weight: 65 }] });
    expect(core.getExercise(press.id).weight).toBe(62.5);
  });

  it("uses a changed session weight as the basis for the new weight", async () => {
    const { core, routine, press } = await setup();
    await core.startSession(routine.id);
    await core.setSessionWeight(press.id, 50);
    await core.logSet(press.id, { reps: 13 });
    await core.logSet(press.id, { reps: 13 });
    const result = await core.endSession();
    expect(core.getExercise(press.id).weight).toBe(52.5);
    expect(result.session && result.summary.increases).toEqual([
      { exerciseId: press.id, name: "Leg press", fromKg: 50, toKg: 52.5 },
    ]);
  });

  it("leaves skipped and incomplete exercises unchanged, even with qualifying reps", async () => {
    const { core, routine, press, curl } = await setup();
    await core.startSession(routine.id);
    await core.setSessionWeight(curl.id, 20);
    await core.logSet(curl.id, { reps: 15 });
    const result = await core.endSession();
    expect(result.session?.entries.map((e) => e.state)).toEqual(["skipped", "incomplete", "skipped"]);
    expect(core.getExercise(press.id).weight).toBe(60);
    expect(core.getExercise(curl.id).weight).toBe(12);
    expect(result.session && result.summary.increases).toEqual([]);
  });

  it("flags a bodyweight exercise that beat the rep range but changes nothing", async () => {
    const { core, routine, pullUp } = await setup();
    const { summary } = await runSession(core, routine.id, { [pullUp.id]: [13, 13] });
    expect(summary.repRangeBeaten).toEqual([{ exerciseId: pullUp.id, name: "Pull-ups" }]);
    expect(summary.increases).toEqual([]);
    expect(core.getExercise(pullUp.id)).toEqual(pullUp);
  });

  it("doesn't flag a bodyweight exercise with a set short of the threshold", async () => {
    const { core, routine, pullUp } = await setup();
    const { summary } = await runSession(core, routine.id, { [pullUp.id]: [13, 12] });
    expect(summary.repRangeBeaten).toEqual([]);
  });

  it("returns no summary for a discarded session", async () => {
    const { core, routine } = await setup();
    await core.startSession(routine.id);
    expect(await core.endSession()).toEqual({ session: null });
  });
});

describe("below range", () => {
  it("lists exercises with any set under the rep minimum, offering a lower weight only for weighted ones", async () => {
    const { core, routine, press, curl, pullUp } = await setup();
    const { summary } = await runSession(core, routine.id, {
      [press.id]: [10, 8],
      [curl.id]: [7], // incomplete still counts
      [pullUp.id]: [5, 9],
    });
    expect(summary.belowRange).toEqual([
      { entryId: press.id, exerciseId: press.id, name: "Leg press", lowerToKg: 57.5 },
      { entryId: curl.id, exerciseId: curl.id, name: "Curl", lowerToKg: 10 },
      { entryId: pullUp.id, exerciseId: pullUp.id, name: "Pull-ups" },
    ]);
  });

  it("doesn't list exercises within range", async () => {
    const { core, routine, press } = await setup();
    const { summary } = await runSession(core, routine.id, { [press.id]: [9, 12] });
    expect(summary.belowRange).toEqual([]);
  });

  it("never lowers the weight automatically", async () => {
    const { core, routine, press } = await setup();
    await runSession(core, routine.id, { [press.id]: [4, 3] });
    expect(core.getExercise(press.id).weight).toBe(60);
  });

  it("lowers by one increment from the session weight when chosen, and records the choice", async () => {
    const { core, routine, press } = await setup();
    const { session } = await runSession(core, routine.id, { [press.id]: [10, 8] });
    await core.lowerWeightAfterSession(session.id, press.id);
    expect(core.getExercise(press.id).weight).toBe(57.5);
    const saved = core.listSessions()[0].entries.find((e) => e.exerciseId === press.id);
    expect(saved?.lowered).toBe(true);
    // Only once.
    await expect(core.lowerWeightAfterSession(session.id, press.id)).rejects.toThrow(CoreError);
    expect(core.getExercise(press.id).weight).toBe(57.5);
  });

  it("clamps the lowered weight at 0 kg", async () => {
    const { core, routine, press } = await setup();
    await core.updateExercise(press.id, { weight: 1 });
    const { session, summary } = await runSession(core, routine.id, { [press.id]: [5, 5] });
    expect(summary.belowRange[0].lowerToKg).toBe(0);
    await core.lowerWeightAfterSession(session.id, press.id);
    expect(core.getExercise(press.id).weight).toBe(0);
  });

  it("isn't offered for bodyweight exercises", async () => {
    const { core, routine, pullUp } = await setup();
    const { session } = await runSession(core, routine.id, { [pullUp.id]: [5, 5] });
    await expect(core.lowerWeightAfterSession(session.id, pullUp.id)).rejects.toThrow(CoreError);
  });

  it("is rejected for entries that weren't below range, were skipped, or aren't the most recent", async () => {
    const { core, routine, press, curl } = await setup();
    const first = await runSession(core, routine.id, { [press.id]: [5, 5] });
    await expect(core.lowerWeightAfterSession(first.session.id, curl.id)).rejects.toThrow(CoreError); // skipped
    const second = await runSession(core, routine.id, { [press.id]: [10, 10] });
    await expect(core.lowerWeightAfterSession(second.session.id, press.id)).rejects.toThrow(CoreError); // in range
    await expect(core.lowerWeightAfterSession(first.session.id, press.id)).rejects.toThrow(CoreError); // older
    await expect(core.lowerWeightAfterSession("nope", press.id)).rejects.toThrow(CoreError);
    expect(core.getExercise(press.id).weight).toBe(60);
  });
});

describe("last time's results", () => {
  it("is empty for an exercise never done", async () => {
    const { core, press } = await setup();
    expect(core.lastResult(press.id)).toBeNull();
    expect(core.weightChangeSinceLastTime(press.id)).toBeNull();
  });

  it("is the latest done or incomplete entry from any routine, ignoring skipped ones", async () => {
    const { core, routine, press, curl } = await setup();
    const other = await core.createRoutine("Other", [curl.id, press.id]);
    await runSession(core, routine.id, { [press.id]: [10, 11] });
    await runSession(core, other.id, { [press.id]: [12] }); // incomplete
    await runSession(core, routine.id, { [curl.id]: [10] }); // press skipped
    expect(core.lastResult(press.id)?.entry).toMatchObject({ state: "incomplete", loggedSets: [{ reps: 12, weight: 60 }] });
    expect(core.lastResult(press.id)?.date).toBe("2026-10-24T18:00:00.000Z");
  });

  it("reports how far the weight went up since last time", async () => {
    const { core, routine, press, pullUp } = await setup();
    await runSession(core, routine.id, { [press.id]: [13, 13], [pullUp.id]: [8, 8] });
    expect(core.weightChangeSinceLastTime(press.id)).toBe(2.5);
    expect(core.weightChangeSinceLastTime(pullUp.id)).toBeNull();
    // Shown during the next session too.
    await core.startSession(routine.id);
    expect(core.lastResult(press.id)?.entry.loggedSets).toEqual([
      { reps: 13, weight: 60 },
      { reps: 13, weight: 60 },
    ]);
    expect(core.weightChangeSinceLastTime(press.id)).toBe(2.5);
  });

  it("reports no change when the weight stayed the same", async () => {
    const { core, routine, press } = await setup();
    await runSession(core, routine.id, { [press.id]: [10, 10] });
    expect(core.weightChangeSinceLastTime(press.id)).toBe(0);
  });
});
