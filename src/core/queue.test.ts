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

describe("flipping between exercises", () => {
  const neighbours = (core: Core) => {
    const { previous, next } = core.neighbourEntries();
    return [previous?.exerciseName ?? null, next?.exerciseName ?? null];
  };

  it("gives the exercises before and after the one on screen, in queue order", async () => {
    const { core, press, curl, pullUp } = await setup();
    expect(neighbours(core)).toEqual([null, "Curl"]);
    await core.goToEntry(curl.id);
    expect(neighbours(core)).toEqual(["Leg press", "Pull-ups"]);
    await core.goToEntry(pullUp.id);
    expect(neighbours(core)).toEqual(["Curl", null]);
    // Finished exercises can be flipped back to as well.
    await core.goToEntry(press.id);
    await finish(core, press.id);
    expect(neighbours(core)).toEqual(["Leg press", "Pull-ups"]);
  });

  it("gives no neighbours once everything is done or when no session is running", async () => {
    const { core, press, curl, pullUp } = await setup();
    for (const id of [press.id, curl.id, pullUp.id]) await finish(core, id);
    expect(neighbours(core)).toEqual([null, null]);
    await core.endSession();
    expect(neighbours(core)).toEqual([null, null]);
  });

  it("makes the exercise flipped to current while the queue keeps its order", async () => {
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
    expect(upNext(core)).toEqual(["Leg press", "Pull-ups"]);
    await core.goToEntry(press.id);
    await core.logSet(press.id, { reps: 11 });
    expect(entry(core, press.id).state).toBe("done");
  });

  it("moves on to the first exercise still to do after finishing one out of order", async () => {
    const { core, press, curl, pullUp } = await setup();
    // Leg press is busy, so Pull-ups first.
    await core.goToEntry(pullUp.id);
    await finish(core, pullUp.id);
    expect(current(core)).toBe("Leg press");
    await finish(core, press.id);
    expect(current(core)).toBe("Curl");
    await finish(core, curl.id);
    expect(core.currentEntry()).toBeNull();
    expect(upNext(core)).toEqual([]);
  });

  it("isn't thrown off by flipping through exercises just to look at them", async () => {
    const { core, press, curl, pullUp } = await setup();
    await core.goToEntry(curl.id);
    await core.goToEntry(pullUp.id);
    await core.goToEntry(curl.id);
    await finish(core, curl.id);
    expect(current(core)).toBe("Leg press");
    await finish(core, press.id);
    expect(current(core)).toBe("Pull-ups");
    await finish(core, pullUp.id);
    expect(core.currentEntry()).toBeNull();
  });

  it("stays on a finished exercise reopened to correct it", async () => {
    const { core, press, curl } = await setup();
    await finish(core, press.id);
    await core.logSet(curl.id, { reps: 10 });
    await core.goToEntry(press.id);
    await core.editSet(press.id, 0, { reps: 12 });
    expect(current(core)).toBe("Leg press");
    expect(upNext(core)).toEqual(["Curl", "Pull-ups"]);
  });

  it("loads a session saved with an exercise to go back to (from \"Skip for now\") without it", async () => {
    const { store, core, curl } = await setup();
    await core.goToEntry(curl.id);
    const saved = (await store.load())!;
    await store.save({ ...saved, activeSession: { ...saved.activeSession!, returnToEntryId: "id-1" } as never });
    const reloaded = await createCore(store);
    expect(reloaded.activeSession()).not.toHaveProperty("returnToEntryId");
    expect(reloaded.currentEntry()?.exerciseName).toBe("Curl");
  });
});

describe("ending with exercises left", () => {
  it("marks partly logged exercises incomplete and untouched ones skipped", async () => {
    const { core, press, curl, pullUp } = await setup();
    await core.logSet(press.id, { reps: 12 });
    await core.goToEntry(curl.id);
    await finish(core, curl.id);
    const { session } = await core.endSession();
    expect(session!.entries.map((e) => [e.exerciseName, e.state])).toEqual([
      ["Leg press", "incomplete"],
      ["Curl", "done"],
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
