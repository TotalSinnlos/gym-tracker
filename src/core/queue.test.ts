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
  const curl = await core.createExercise({ name: "Curl", type: "freeWeight", weight: 12, increment: 2, sets: 3 });
  const pullUp = await core.createExercise({ name: "Pull-ups", type: "bodyweight" });
  const routine = await core.createRoutine("My routine", [press.id, curl.id, pullUp.id]);
  await core.startSession(routine.id);
  return { store, core, press, curl, pullUp };
}

type Core = Awaited<ReturnType<typeof setup>>["core"];

const queue = (core: Core) => core.activeSession()!.entries.map((e) => e.exerciseName);
const current = (core: Core) => core.currentEntry()?.exerciseName;
const upNext = (core: Core) => core.upNext().map((e) => e.exerciseName);
const entry = (core: Core, exerciseId: string) => core.activeSession()!.entries.find((e) => e.exerciseId === exerciseId)!;

async function finish(core: Core, exerciseId: string) {
  while (entry(core, exerciseId).state === "pending") await core.logSet(exerciseId, { reps: 10 });
}

describe("skip for now", () => {
  it("swaps the current exercise with the next pending one", async () => {
    const { core } = await setup();
    expect(core.canSkip()).toBe(true);
    await core.skipCurrent();
    expect(queue(core)).toEqual(["Curl", "Leg press", "Pull-ups"]);
    expect(current(core)).toBe("Curl");
    expect(upNext(core)).toEqual(["Leg press", "Pull-ups"]);
  });

  it("brings the skipped exercise back straight after the one done instead", async () => {
    const { core, curl } = await setup();
    await core.skipCurrent();
    await finish(core, curl.id);
    expect(current(core)).toBe("Leg press");
  });

  it("jumps over finished exercises to the next pending one", async () => {
    const { core, press, curl } = await setup();
    await finish(core, press.id);
    await core.goToEntry(press.id);
    await core.goToEntry(curl.id);
    // Queue: Leg press (done), Curl (current), Pull-ups. Skipping Curl puts it after Pull-ups.
    await core.skipCurrent();
    expect(queue(core)).toEqual(["Leg press", "Pull-ups", "Curl"]);
    expect(current(core)).toBe("Pull-ups");
  });

  it("wraps round to an earlier pending exercise", async () => {
    const { core, pullUp } = await setup();
    await core.goToEntry(pullUp.id);
    await core.skipCurrent();
    expect(queue(core)).toEqual(["Leg press", "Pull-ups", "Curl"]);
    expect(current(core)).toBe("Leg press");
  });

  it("keeps the sets already logged for the skipped exercise", async () => {
    const { core, press } = await setup();
    await core.logSet(press.id, { reps: 12 });
    await core.skipCurrent();
    expect(entry(core, press.id)).toMatchObject({ state: "pending", loggedSets: [{ reps: 12, weight: 60 }] });
  });

  it("is rejected when the current exercise is the only one left", async () => {
    const { core, press, curl } = await setup();
    await finish(core, press.id);
    await finish(core, curl.id);
    expect(current(core)).toBe("Pull-ups");
    expect(core.canSkip()).toBe(false);
    await expect(core.skipCurrent()).rejects.toThrow(CoreError);
    expect(queue(core)).toEqual(["Leg press", "Curl", "Pull-ups"]);
  });

  it("is rejected when the exercise on screen is already finished", async () => {
    const { core, press } = await setup();
    await finish(core, press.id);
    await core.goToEntry(press.id);
    expect(core.canSkip()).toBe(false);
    await expect(core.skipCurrent()).rejects.toThrow(CoreError);
  });

  it("is rejected once everything is done or when no session is running", async () => {
    const { core, press, curl, pullUp } = await setup();
    for (const id of [press.id, curl.id, pullUp.id]) await finish(core, id);
    expect(core.currentEntry()).toBeNull();
    expect(core.canSkip()).toBe(false);
    await expect(core.skipCurrent()).rejects.toThrow(CoreError);
    await core.endSession();
    expect(core.canSkip()).toBe(false);
    await expect(core.skipCurrent()).rejects.toThrow(CoreError);
  });
});

describe("jump to", () => {
  it("makes a pending exercise current while the previous one keeps its place", async () => {
    const { core, pullUp } = await setup();
    await core.goToEntry(pullUp.id);
    expect(current(core)).toBe("Pull-ups");
    expect(queue(core)).toEqual(["Leg press", "Curl", "Pull-ups"]);
    expect(upNext(core)).toEqual(["Leg press", "Curl"]);
  });

  it("keeps the sets of a partly logged exercise, which stays pending and in up next", async () => {
    const { core, press, curl } = await setup();
    await core.logSet(press.id, { reps: 12 });
    await core.goToEntry(curl.id);
    expect(entry(core, press.id)).toMatchObject({ state: "pending", loggedSets: [{ reps: 12, weight: 60 }] });
    // The exercise left behind comes up first.
    expect(upNext(core)).toEqual(["Leg press", "Pull-ups"]);
    await core.goToEntry(press.id);
    await core.logSet(press.id, { reps: 11 });
    expect(entry(core, press.id).state).toBe("done");
  });

  it("goes back to the exercise left behind, then continues in queue order", async () => {
    const { core, press, curl, pullUp } = await setup();
    await core.goToEntry(pullUp.id);
    expect(upNext(core)).toEqual(["Leg press", "Curl"]);
    await finish(core, pullUp.id);
    expect(current(core)).toBe("Leg press");
    await finish(core, press.id);
    expect(current(core)).toBe("Curl");
    await finish(core, curl.id);
    expect(core.currentEntry()).toBeNull();
    expect(upNext(core)).toEqual([]);
  });

  it("goes back to the most recently left exercise after several jumps", async () => {
    const { core, curl, pullUp } = await setup();
    await core.goToEntry(curl.id);
    await core.goToEntry(pullUp.id);
    expect(upNext(core)).toEqual(["Curl", "Leg press"]);
    await finish(core, pullUp.id);
    expect(current(core)).toBe("Curl");
    await finish(core, curl.id);
    expect(current(core)).toBe("Leg press");
  });

  it("keeps the exercise to go back to while a finished one is corrected", async () => {
    const { core, press, curl } = await setup();
    await finish(core, press.id);
    await core.logSet(curl.id, { reps: 10 });
    await core.goToEntry(press.id);
    await core.editSet(press.id, 0, { reps: 12 });
    expect(upNext(core)[0]).toBe("Curl");
  });
});

describe("ending with exercises left", () => {
  it("marks partly logged exercises incomplete and untouched ones skipped", async () => {
    const { core, press, curl, pullUp } = await setup();
    await core.logSet(press.id, { reps: 12 });
    await core.skipCurrent();
    await finish(core, curl.id);
    const { session } = await core.endSession();
    expect(session!.entries.map((e) => [e.exerciseName, e.state])).toEqual([
      ["Curl", "done"],
      ["Leg press", "incomplete"],
      ["Pull-ups", "skipped"],
    ]);
    expect(session!.entries.find((e) => e.exerciseId === press.id)!.loggedSets).toEqual([{ reps: 12, weight: 60 }]);
    expect(session!.entries.find((e) => e.exerciseId === pullUp.id)!.loggedSets).toEqual([]);
  });

  it("leaves the weight of an incomplete exercise unchanged", async () => {
    const { core, press } = await setup();
    await core.setSessionWeight(press.id, 65);
    await core.logSet(press.id, { reps: 13 });
    await core.endSession();
    expect(core.getExercise(press.id).weight).toBe(60);
  });
});
