import { describe, expect, it } from "vitest";
import { CoreError, createCore, createMemoryStore } from ".";

async function setup() {
  let counter = 0;
  const store = createMemoryStore();
  const core = await createCore(store, {
    newId: () => `id-${++counter}`,
    now: () => new Date("2026-10-24T18:00:00Z"),
  });
  const press = await core.createExercise({ name: "Leg press", type: "machine", weight: 60 });
  const curl = await core.createExercise({ name: "Curl", type: "freeWeight", weight: 12, increment: 2 });
  const squat = await core.createExercise({ name: "Squat", type: "freeWeight", weight: 80, increment: 5 });
  const upper = await core.createRoutine("Upper body", [press.id, curl.id]);
  const legs = await core.createRoutine("Legs", [press.id, squat.id]);
  return { store, core, press, curl, squat, upper, legs };
}

type Core = Awaited<ReturnType<typeof setup>>["core"];

/** Starts a session from the routine, does every exercise with `reps` on each set, and ends it. */
async function train(core: Core, routineId: string, reps: number) {
  const session = await core.startSession(routineId);
  for (const entry of session.entries) {
    for (let i = 0; i < entry.sets; i++) await core.logSet(entry.id, { reps });
  }
  return core.endSession();
}

describe("several routines", () => {
  it("lists every routine, and only those with exercises as startable", async () => {
    const { core, upper, legs } = await setup();
    const empty = await core.createRoutine("Empty");
    expect(core.listRoutines().map((r) => r.id)).toEqual([upper.id, legs.id, empty.id]);
    expect(core.startableRoutines().map((r) => r.id)).toEqual([upper.id, legs.id]);
  });

  it("starts a session from whichever routine is picked", async () => {
    const { core, legs } = await setup();
    const session = await core.startSession(legs.id);
    expect(session.routineName).toBe("Legs");
    expect(session.entries.map((e) => e.exerciseName)).toEqual(["Leg press", "Squat"]);
  });

  it("shares one history and current weight for an exercise in several routines", async () => {
    const { core, press, upper, legs } = await setup();
    await train(core, upper.id, 13);
    expect(core.getExercise(press.id).weight).toBe(62.5);

    const session = await core.startSession(legs.id);
    expect(session.entries[0]).toMatchObject({ exerciseId: press.id, sessionWeight: 62.5 });
    expect(core.lastResult(press.id)?.entry.sessionWeight).toBe(60);
    await core.logSet(press.id, { reps: 13 });
    await core.logSet(press.id, { reps: 13 });
    await core.endSession();

    expect(core.getExercise(press.id).weight).toBe(65);
    expect(core.lastResult(press.id)?.entry.sessionWeight).toBe(62.5);
  });
});

describe("renaming a routine", () => {
  it("renames its past sessions and the running one, but not other routines' sessions", async () => {
    const { core, upper, legs } = await setup();
    await train(core, upper.id, 10);
    await train(core, legs.id, 10);
    await core.startSession(upper.id);
    await core.renameRoutine(upper.id, "Push day");
    expect(core.listSessions().map((s) => s.routineName)).toEqual(["Legs", "Push day"]);
    expect(core.activeSession()?.routineName).toBe("Push day");
  });

  it("brings sessions saved under an earlier name up to date when the data is loaded", async () => {
    const { store, core, upper } = await setup();
    await train(core, upper.id, 10);
    const saved = (await store.load())!;
    await store.save({ ...saved, routines: saved.routines.map((r) => (r.id === upper.id ? { ...r, name: "Push day" } : r)) });
    const reloaded = await createCore(store);
    expect(reloaded.listSessions()[0].routineName).toBe("Push day");
  });
});

describe("deleting a routine", () => {
  it("removes it and keeps its exercises and past sessions", async () => {
    const { core, press, upper, legs } = await setup();
    await train(core, upper.id, 10);
    await core.deleteRoutine(upper.id);

    expect(core.listRoutines().map((r) => r.id)).toEqual([legs.id]);
    expect(core.getExercise(press.id).name).toBe("Leg press");
    expect(core.listSessions()[0].routineName).toBe("Upper body");
    expect(core.lastResult(press.id)?.entry.loggedSets).toHaveLength(2);
  });

  it("is rejected for the routine of the running session, but allowed for another", async () => {
    const { core, upper, legs } = await setup();
    await core.startSession(upper.id);
    expect(core.canDeleteRoutine(upper.id)).toBe(false);
    await expect(core.deleteRoutine(upper.id)).rejects.toThrow(CoreError);

    expect(core.canDeleteRoutine(legs.id)).toBe(true);
    await core.deleteRoutine(legs.id);
    expect(core.listRoutines().map((r) => r.id)).toEqual([upper.id]);
  });

  it("is rejected for the last routine", async () => {
    const { core, upper, legs } = await setup();
    await core.deleteRoutine(legs.id);
    expect(core.canDeleteRoutine(upper.id)).toBe(false);
    await expect(core.deleteRoutine(upper.id)).rejects.toThrow(CoreError);
    expect(core.listRoutines()).toHaveLength(1);
  });
});

describe("archiving an exercise", () => {
  it("hides it from the exercise list and lists it as archived", async () => {
    const { core, press, curl, squat } = await setup();
    await core.archiveExercise(curl.id);
    expect(core.listExercises().map((e) => e.id)).toEqual([press.id, squat.id]);
    expect(core.listArchivedExercises().map((e) => e.id)).toEqual([curl.id]);
  });

  it("takes it out of every routine, so the next session doesn't include it", async () => {
    const { core, press, squat, upper, legs } = await setup();
    await core.addExerciseToRoutine(upper.id, press.id);
    await core.archiveExercise(press.id);
    expect(core.routinesWithExercise(press.id)).toEqual([]);
    expect(core.routineExercises(upper.id).map((e) => e.name)).toEqual(["Curl"]);
    expect(core.routineExercises(legs.id).map((e) => e.id)).toEqual([squat.id]);
    const session = await core.startSession(legs.id);
    expect(session.entries.map((e) => e.exerciseId)).toEqual([squat.id]);
  });

  it("can't be added to a routine while archived", async () => {
    const { core, curl, legs } = await setup();
    await core.archiveExercise(curl.id);
    await expect(core.addExerciseToRoutine(legs.id, curl.id)).rejects.toThrow(CoreError);
    await expect(core.createRoutine("New", [curl.id])).rejects.toThrow(CoreError);
  });

  it("keeps its history and weight, and unarchiving brings it back without a routine", async () => {
    const { core, curl, upper } = await setup();
    await train(core, upper.id, 13);
    await core.archiveExercise(curl.id);
    expect(core.getExercise(curl.id).weight).toBe(14);
    expect(core.lastResult(curl.id)?.entry.loggedSets).toHaveLength(2);

    await core.unarchiveExercise(curl.id);
    expect(core.listExercises().map((e) => e.id)).toContain(curl.id);
    expect(core.listArchivedExercises()).toEqual([]);
    expect(core.routinesWithExercise(curl.id)).toEqual([]);
    expect(core.lastResult(curl.id)?.entry.loggedSets).toHaveLength(2);
    await core.addExerciseToRoutine(upper.id, curl.id);
    expect(core.routineExercises(upper.id).map((e) => e.name)).toEqual(["Leg press", "Curl"]);
  });

  it("leaves a running session unchanged, and its result still counts", async () => {
    const { core, curl, upper } = await setup();
    await core.startSession(upper.id);
    await core.archiveExercise(curl.id);
    expect(core.activeSession()!.entries.map((e) => e.exerciseId)).toContain(curl.id);
    await core.logSet(curl.id, { reps: 13 });
    await core.logSet(curl.id, { reps: 13 });
    await core.endSession();
    expect(core.getExercise(curl.id).weight).toBe(14);
  });
});

describe("deleting an exercise", () => {
  it("is allowed without history and takes it out of every routine", async () => {
    const { core, press, curl, squat, upper, legs } = await setup();
    expect(core.hasHistory(press.id)).toBe(false);
    await core.deleteExercise(press.id);
    expect(core.listExercises().map((e) => e.id)).toEqual([curl.id, squat.id]);
    expect(core.routineExercises(upper.id).map((e) => e.id)).toEqual([curl.id]);
    expect(core.routineExercises(legs.id).map((e) => e.id)).toEqual([squat.id]);
  });

  it("is rejected once the exercise has history, even a skipped entry", async () => {
    const { core, press, curl, upper } = await setup();
    await core.startSession(upper.id);
    await core.logSet(press.id, { reps: 10 });
    await core.endSession();
    expect(core.lastResult(curl.id)).toBeNull();
    expect(core.hasHistory(curl.id)).toBe(true);
    await expect(core.deleteExercise(curl.id)).rejects.toThrow(CoreError);
    expect(core.getExercise(curl.id).name).toBe("Curl");
  });

  it("is rejected while the exercise is in the running session", async () => {
    const { core, curl, upper } = await setup();
    await core.startSession(upper.id);
    expect(core.hasHistory(curl.id)).toBe(true);
    await expect(core.deleteExercise(curl.id)).rejects.toThrow(CoreError);
  });

  it("works for an archived exercise without history", async () => {
    const { core, squat } = await setup();
    await core.archiveExercise(squat.id);
    await core.deleteExercise(squat.id);
    expect(core.listArchivedExercises()).toEqual([]);
    expect(() => core.getExercise(squat.id)).toThrow(CoreError);
  });
});

describe("managing routines and exercises", () => {
  it("survives reopening the app", async () => {
    const { store, core, curl, squat, upper, legs } = await setup();
    await core.archiveExercise(curl.id);
    await core.deleteExercise(squat.id);
    await core.deleteRoutine(upper.id);

    const reopened = await createCore(store);
    expect(reopened.listRoutines().map((r) => r.id)).toEqual([legs.id]);
    expect(reopened.listArchivedExercises().map((e) => e.id)).toEqual([curl.id]);
    expect(reopened.routineExercises(legs.id).map((e) => e.name)).toEqual(["Leg press"]);
  });
});
