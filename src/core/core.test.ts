import { describe, expect, it } from "vitest";
import { CoreError, createCore, createMemoryStore } from ".";

let counter = 0;
const ids = () => `id-${++counter}`;

async function setup() {
  const store = createMemoryStore();
  const core = await createCore(store, { newId: ids });
  return { store, core };
}

describe("exercises", () => {
  it("creates a weighted exercise with defaults for sets, reps and increment", async () => {
    const { core } = await setup();
    const exercise = await core.createExercise({ name: "Leg press", type: "machine", weight: 60 });
    expect(exercise).toMatchObject({
      name: "Leg press",
      type: "machine",
      weight: 60,
      increment: 2.5,
      sets: 2,
      repMin: 9,
      repMax: 12,
      archived: false,
    });
    expect(core.listExercises()).toEqual([exercise]);
  });

  it("creates a bodyweight exercise without weight or increment", async () => {
    const { core } = await setup();
    const exercise = await core.createExercise({ name: "Pull-ups", type: "bodyweight", weight: 50, increment: 5 });
    expect(exercise.weight).toBeUndefined();
    expect(exercise.increment).toBeUndefined();
  });

  it("trims names and rejects empty ones", async () => {
    const { core } = await setup();
    expect((await core.createExercise({ name: "  Row  ", type: "machine" })).name).toBe("Row");
    await expect(core.createExercise({ name: "   ", type: "machine" })).rejects.toThrow(CoreError);
  });

  it("rejects invalid numbers", async () => {
    const { core } = await setup();
    const bad = [
      { weight: -2.5 },
      { increment: 0 },
      { sets: 0 },
      { sets: 1.5 },
      { repMin: 0 },
      { repMin: 13, repMax: 12 },
    ];
    for (const input of bad) {
      await expect(core.createExercise({ name: "X", type: "machine", ...input })).rejects.toThrow(CoreError);
    }
    expect(core.listExercises()).toEqual([]);
  });

  it("edits an exercise", async () => {
    const { core } = await setup();
    const { id } = await core.createExercise({ name: "Chest press", type: "machine", weight: 40 });
    await core.updateExercise(id, { name: "Chest press (seated)", weight: 42.5, increment: 5, sets: 3, repMax: 15 });
    expect(core.getExercise(id)).toMatchObject({
      name: "Chest press (seated)",
      weight: 42.5,
      increment: 5,
      sets: 3,
      repMin: 9,
      repMax: 15,
    });
  });

  it("drops weight when switched to bodyweight and starts at 0 kg when switched back", async () => {
    const { core } = await setup();
    const { id } = await core.createExercise({ name: "Dips", type: "machine", weight: 30, increment: 5 });
    await core.updateExercise(id, { type: "bodyweight" });
    expect(core.getExercise(id).weight).toBeUndefined();
    await core.updateExercise(id, { type: "freeWeight" });
    expect(core.getExercise(id)).toMatchObject({ weight: 0, increment: 2.5 });
  });

  it("rejects an invalid edit and keeps the old values", async () => {
    const { core } = await setup();
    const { id } = await core.createExercise({ name: "Row", type: "machine", weight: 40 });
    await expect(core.updateExercise(id, { weight: -1 })).rejects.toThrow(CoreError);
    expect(core.getExercise(id).weight).toBe(40);
  });
});

describe("routines", () => {
  async function withExercises() {
    const env = await setup();
    const a = await env.core.createExercise({ name: "A", type: "machine" });
    const b = await env.core.createExercise({ name: "B", type: "freeWeight" });
    const c = await env.core.createExercise({ name: "C", type: "bodyweight" });
    return { ...env, a, b, c };
  }

  it("builds a routine in order", async () => {
    const { core, a, b, c } = await withExercises();
    const routine = await core.createRoutine("My routine", [b.id, a.id]);
    await core.addExerciseToRoutine(routine.id, c.id);
    expect(core.routineExercises(routine.id).map((e) => e.name)).toEqual(["B", "A", "C"]);
  });

  it("reorders, removes and renames", async () => {
    const { core, a, b, c } = await withExercises();
    const routine = await core.createRoutine("Day", [a.id, b.id, c.id]);
    await core.moveExerciseInRoutine(routine.id, 2, 0);
    expect(core.routineExercises(routine.id).map((e) => e.name)).toEqual(["C", "A", "B"]);
    await core.moveExerciseInRoutine(routine.id, 0, 1);
    expect(core.routineExercises(routine.id).map((e) => e.name)).toEqual(["A", "C", "B"]);
    await core.removeExerciseFromRoutine(routine.id, 1);
    expect(core.routineExercises(routine.id).map((e) => e.name)).toEqual(["A", "B"]);
    await core.renameRoutine(routine.id, "Upper body");
    expect(core.getRoutine(routine.id).name).toBe("Upper body");
  });

  it("keeps the exercise when it's removed from a routine", async () => {
    const { core, a } = await withExercises();
    const routine = await core.createRoutine("Day", [a.id]);
    await core.removeExerciseFromRoutine(routine.id, 0);
    expect(core.getExercise(a.id).name).toBe("A");
  });

  it("allows the same exercise twice and removes by position", async () => {
    const { core, a, b } = await withExercises();
    const routine = await core.createRoutine("Day", [a.id, b.id]);
    await core.addExerciseToRoutine(routine.id, a.id);
    expect(core.routineExercises(routine.id).map((e) => e.name)).toEqual(["A", "B", "A"]);
    await core.removeExerciseFromRoutine(routine.id, 0);
    expect(core.routineExercises(routine.id).map((e) => e.name)).toEqual(["B", "A"]);
  });

  it("rejects unknown exercises and out-of-range positions", async () => {
    const { core, a } = await withExercises();
    const routine = await core.createRoutine("Day", [a.id]);
    await expect(core.addExerciseToRoutine(routine.id, "nope")).rejects.toThrow(CoreError);
    await expect(core.createRoutine("Other", ["nope"])).rejects.toThrow(CoreError);
    await expect(core.moveExerciseInRoutine(routine.id, 0, 5)).rejects.toThrow(CoreError);
    await expect(core.removeExerciseFromRoutine(routine.id, 3)).rejects.toThrow(CoreError);
  });
});

describe("setup", () => {
  it("can only be completed once a routine has an exercise", async () => {
    const { core } = await setup();
    expect(core.isSetupComplete()).toBe(false);
    const routine = await core.createRoutine("My routine");
    await expect(core.completeSetup()).rejects.toThrow(CoreError);
    const exercise = await core.createExercise({ name: "Row", type: "machine" });
    await core.addExerciseToRoutine(routine.id, exercise.id);
    await core.completeSetup();
    expect(core.isSetupComplete()).toBe(true);
  });
});

describe("persistence", () => {
  it("restores everything from the same store", async () => {
    const { store, core } = await setup();
    const exercise = await core.createExercise({ name: "Row", type: "machine", weight: 45 });
    const routine = await core.createRoutine("My routine", [exercise.id]);
    await core.completeSetup();

    const reopened = await createCore(store, { newId: ids });
    expect(reopened.getExercise(exercise.id).weight).toBe(45);
    expect(reopened.routineExercises(routine.id).map((e) => e.name)).toEqual(["Row"]);
    expect(reopened.isSetupComplete()).toBe(true);
  });

  it("notifies subscribers after each change", async () => {
    const { core } = await setup();
    let calls = 0;
    core.subscribe(() => calls++);
    await core.createExercise({ name: "Row", type: "machine" });
    await expect(core.createExercise({ name: "", type: "machine" })).rejects.toThrow();
    expect(calls).toBe(1);
  });
});
