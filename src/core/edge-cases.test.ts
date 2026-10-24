import { describe, expect, it } from "vitest";
import { createCore, createMemoryStore } from ".";

async function setup() {
  let counter = 0;
  const store = createMemoryStore();
  const core = await createCore(store, {
    newId: () => `id-${++counter}`,
    now: () => new Date("2026-10-24T18:00:00Z"),
  });
  const press = await core.createExercise({ name: "Leg press", type: "machine", weight: 60 });
  const curl = await core.createExercise({ name: "Curl", type: "freeWeight", weight: 12, increment: 2 });
  return { store, core, press, curl };
}

describe("the same exercise twice in a routine", () => {
  it("gives each occurrence its own entry in the session", async () => {
    const { core, press, curl } = await setup();
    const routine = await core.createRoutine("Day", [press.id, curl.id, press.id]);
    const session = await core.startSession(routine.id);
    expect(session.entries.map((e) => e.id)).toEqual([press.id, curl.id, `${press.id}#2`]);

    await core.logSet(press.id, { reps: 10 });
    await core.logSet(press.id, { reps: 10 });
    await core.logSet(curl.id, { reps: 10 });
    await core.logSet(curl.id, { reps: 10 });
    expect(core.currentEntry()?.id).toBe(`${press.id}#2`);
    expect(core.currentEntry()?.loggedSets).toEqual([]);
  });

  it("uses the last finished occurrence for the new weight", async () => {
    const { core, press } = await setup();
    const routine = await core.createRoutine("Day", [press.id, press.id]);
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 13 });
    await core.logSet(press.id, { reps: 13 });
    await core.setSessionWeight(`${press.id}#2`, 50);
    await core.logSet(`${press.id}#2`, { reps: 10 });
    await core.logSet(`${press.id}#2`, { reps: 10 });
    const result = await core.endSession();
    expect(core.getExercise(press.id).weight).toBe(50);
    expect(result.session && result.summary.increases).toEqual([]);
    expect(core.lastResult(press.id)?.entry.id).toBe(`${press.id}#2`);
  });
});

describe("weight changed in settings during a session", () => {
  it("wins over the session's result when the exercise was already done", async () => {
    const { core, press } = await setup();
    const routine = await core.createRoutine("Day", [press.id]);
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 13 });
    await core.logSet(press.id, { reps: 13 });
    await core.updateExercise(press.id, { weight: 70 });
    const result = await core.endSession();
    expect(core.getExercise(press.id).weight).toBe(70);
    expect(result.session && result.summary.increases).toEqual([]);
  });

  it("still lets progression run when the exercise hadn't been done yet", async () => {
    const { core, press } = await setup();
    const routine = await core.createRoutine("Day", [press.id]);
    await core.startSession(routine.id);
    await core.updateExercise(press.id, { weight: 70 });
    await core.logSet(press.id, { reps: 13 });
    await core.logSet(press.id, { reps: 13 });
    await core.endSession();
    expect(core.getExercise(press.id).weight).toBe(72.5);
  });
});

describe("exercise switched to bodyweight during a session", () => {
  it("doesn't get a weight back when the session ends", async () => {
    const { core, press } = await setup();
    const routine = await core.createRoutine("Day", [press.id]);
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 13 });
    await core.logSet(press.id, { reps: 13 });
    await core.updateExercise(press.id, { type: "bodyweight" });
    const result = await core.endSession();
    expect(core.getExercise(press.id).weight).toBeUndefined();
    expect(result.session && result.summary.increases).toEqual([]);
  });
});

describe("data saved by an earlier version", () => {
  it("gets entry ids, the current entry and default settings", async () => {
    const legacyEntry = (exerciseId: string, state: string) => ({
      exerciseId,
      exerciseName: exerciseId,
      type: "machine",
      sets: 2,
      repMin: 9,
      repMax: 12,
      sessionWeight: 60,
      loggedSets: state === "done" ? [{ reps: 10, weight: 60 }, { reps: 10, weight: 60 }] : [],
      state,
    });
    const store = createMemoryStore({
      version: 1,
      exercises: [
        { id: "a", name: "A", type: "machine", sets: 2, repMin: 9, repMax: 12, weight: 60, increment: 2.5, archived: false },
        { id: "b", name: "B", type: "machine", sets: 2, repMin: 9, repMax: 12, weight: 60, increment: 2.5, archived: false },
      ],
      routines: [{ id: "r", name: "Day", exerciseIds: ["a", "b"] }],
      settings: {},
      activeSession: {
        id: "s2",
        routineId: "r",
        routineName: "Day",
        startedAt: "2026-10-24T18:00:00Z",
        entries: [legacyEntry("a", "done"), legacyEntry("b", "pending")],
        currentExerciseId: "b",
      },
      sessions: [
        {
          id: "s1",
          routineId: "r",
          routineName: "Day",
          startedAt: "2026-10-23T18:00:00Z",
          endedAt: "2026-10-23T19:00:00Z",
          entries: [legacyEntry("a", "done"), legacyEntry("b", "skipped")],
          currentExerciseId: null,
        },
      ],
    } as never);
    const core = await createCore(store);
    expect(core.isSetupComplete()).toBe(false);
    expect(core.currentEntry()?.id).toBe("b");
    expect(core.lastResult("a")?.entry.id).toBe("a");
    await core.logSet("b", { reps: 10 });
    expect(core.currentEntry()?.loggedSets).toHaveLength(1);
  });
});
