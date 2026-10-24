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
  return { store, core, press, curl, pullUp, routine };
}

const entry = (core: Awaited<ReturnType<typeof setup>>["core"], exerciseId: string) =>
  core.activeSession()!.entries.find((e) => e.exerciseId === exerciseId)!;

describe("starting a session", () => {
  it("queues the routine's exercises with their current settings, first one on screen", async () => {
    const { core, routine, press } = await setup();
    const session = await core.startSession(routine.id);
    expect(session).toMatchObject({ routineName: "My routine", startedAt: "2026-10-24T18:00:00.000Z" });
    expect(session.entries.map((e) => [e.exerciseName, e.sessionWeight, e.sets, e.state])).toEqual([
      ["Leg press", 60, 2, "pending"],
      ["Curl", 12, 3, "pending"],
      ["Pull-ups", undefined, 2, "pending"],
    ]);
    expect(core.currentEntry()?.exerciseId).toBe(press.id);
    expect(core.pendingCount()).toBe(3);
  });

  it("allows only one session at a time and rejects empty routines", async () => {
    const { core, routine } = await setup();
    const empty = await core.createRoutine("Empty");
    await expect(core.startSession(empty.id)).rejects.toThrow(CoreError);
    await core.startSession(routine.id);
    await expect(core.startSession(routine.id)).rejects.toThrow(CoreError);
  });
});

describe("logging sets", () => {
  it("fills in the session weight and moves on once all sets are logged", async () => {
    const { core, routine, press, curl } = await setup();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 12 });
    expect(entry(core, press.id)).toMatchObject({ state: "pending", loggedSets: [{ reps: 12, weight: 60 }] });
    expect(core.currentEntry()?.exerciseId).toBe(press.id);
    await core.logSet(press.id, { reps: 10, weight: 55 });
    expect(entry(core, press.id)).toMatchObject({
      state: "done",
      loggedSets: [
        { reps: 12, weight: 60 },
        { reps: 10, weight: 55 },
      ],
    });
    expect(core.currentEntry()?.exerciseId).toBe(curl.id);
  });

  it("uses a changed session weight for the following sets", async () => {
    const { core, routine, press } = await setup();
    await core.startSession(routine.id);
    await core.setSessionWeight(press.id, 57.5);
    await core.logSet(press.id, { reps: 11 });
    expect(entry(core, press.id).loggedSets).toEqual([{ reps: 11, weight: 57.5 }]);
  });

  it("records bodyweight sets without weight", async () => {
    const { core, routine, pullUp } = await setup();
    await core.startSession(routine.id);
    await core.logSet(pullUp.id, { reps: 8, weight: 20 });
    expect(entry(core, pullUp.id).loggedSets).toEqual([{ reps: 8 }]);
    await expect(core.setSessionWeight(pullUp.id, 10)).rejects.toThrow(CoreError);
  });

  it("rejects invalid reps and weights", async () => {
    const { core, routine, press } = await setup();
    await core.startSession(routine.id);
    await expect(core.logSet(press.id, { reps: -1 })).rejects.toThrow(CoreError);
    await expect(core.logSet(press.id, { reps: 2.5 })).rejects.toThrow(CoreError);
    await expect(core.logSet(press.id, { reps: 10, weight: -5 })).rejects.toThrow(CoreError);
    await expect(core.setSessionWeight(press.id, -5)).rejects.toThrow(CoreError);
    expect(entry(core, press.id).loggedSets).toEqual([]);
  });

  it("requires a running session", async () => {
    const { core, press } = await setup();
    await expect(core.logSet(press.id, { reps: 10 })).rejects.toThrow(CoreError);
  });
});

describe("correcting during a session", () => {
  it("reopens a finished exercise to edit, add and remove sets", async () => {
    const { core, routine, press, curl } = await setup();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 12 });
    await core.logSet(press.id, { reps: 31 });
    expect(core.currentEntry()?.exerciseId).toBe(curl.id);

    await core.goToExercise(press.id);
    expect(core.currentEntry()?.exerciseId).toBe(press.id);
    await core.editSet(press.id, 1, { reps: 13 });
    await core.logSet(press.id, { reps: 9 });
    expect(entry(core, press.id)).toMatchObject({ state: "done", loggedSets: [{ reps: 12 }, { reps: 13 }, { reps: 9 }] });
    // Still on screen: adding to a finished exercise doesn't jump away.
    expect(core.currentEntry()?.exerciseId).toBe(press.id);

    await core.removeSet(press.id, 2);
    await core.removeSet(press.id, 1);
    expect(entry(core, press.id)).toMatchObject({ state: "pending", loggedSets: [{ reps: 12 }] });
  });

  it("reports when nothing is left", async () => {
    const { core, routine, press, curl, pullUp } = await setup();
    await core.startSession(routine.id);
    for (const [id, sets] of [
      [press.id, 2],
      [curl.id, 3],
      [pullUp.id, 2],
    ] as const) {
      for (let i = 0; i < sets; i++) await core.logSet(id, { reps: 10 });
    }
    expect(core.currentEntry()).toBeNull();
    expect(core.pendingCount()).toBe(0);
  });
});

describe("ending a session", () => {
  it("saves it, marks untouched exercises skipped and partly logged ones incomplete", async () => {
    const { core, routine, press, curl, pullUp } = await setup();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 12 });
    await core.logSet(press.id, { reps: 11 });
    await core.logSet(curl.id, { reps: 10 });
    const { session } = await core.endSession();

    expect(session?.endedAt).toBe("2026-10-24T18:00:00.000Z");
    expect(session?.entries.map((e) => [e.exerciseId, e.state])).toEqual([
      [press.id, "done"],
      [curl.id, "incomplete"],
      [pullUp.id, "skipped"],
    ]);
    expect(core.activeSession()).toBeNull();
    expect(core.listSessions()).toEqual([session]);
  });

  it("keeps a changed session weight as the exercise's weight when finished", async () => {
    const { core, routine, press, curl } = await setup();
    await core.startSession(routine.id);
    await core.setSessionWeight(press.id, 55);
    await core.logSet(press.id, { reps: 10 });
    await core.logSet(press.id, { reps: 10 });
    await core.setSessionWeight(curl.id, 20);
    await core.logSet(curl.id, { reps: 10 });
    await core.endSession();
    expect(core.getExercise(press.id).weight).toBe(55);
    // Unfinished: unchanged.
    expect(core.getExercise(curl.id).weight).toBe(12);
  });

  it("discards a session with nothing logged", async () => {
    const { core, routine } = await setup();
    await core.startSession(routine.id);
    expect(await core.endSession()).toEqual({ session: null });
    expect(core.activeSession()).toBeNull();
    expect(core.listSessions()).toEqual([]);
  });
});

describe("snapshot rules", () => {
  it("ignores routine and sets/rep-range edits made during the session", async () => {
    const { core, routine, press, pullUp } = await setup();
    await core.startSession(routine.id);
    await core.removeExerciseFromRoutine(routine.id, pullUp.id);
    await core.updateExercise(press.id, { sets: 4, repMax: 15, name: "Leg press 2" });
    expect(core.activeSession()!.entries).toHaveLength(3);
    expect(entry(core, press.id)).toMatchObject({ sets: 2, repMax: 12, exerciseName: "Leg press" });
  });

  it("applies weight edits made during the session to exercises not yet finished", async () => {
    const { core, routine, press, curl } = await setup();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 10 });
    await core.logSet(press.id, { reps: 10 });
    await core.updateExercise(curl.id, { weight: 14 });
    await core.updateExercise(press.id, { weight: 70 });
    expect(entry(core, curl.id).sessionWeight).toBe(14);
    expect(entry(core, press.id).sessionWeight).toBe(60);
  });
});

describe("resuming", () => {
  it("continues exactly where it left off after reopening", async () => {
    const { store, core, routine, press, curl } = await setup();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 12 });
    await core.logSet(press.id, { reps: 12 });
    await core.logSet(curl.id, { reps: 9 });
    const before = core.activeSession();

    const reopened = await createCore(store);
    expect(reopened.activeSession()).toEqual(before);
    expect(reopened.currentEntry()?.exerciseId).toBe(curl.id);
  });

  it("opens data saved before sessions existed", async () => {
    const store = createMemoryStore({
      version: 1,
      exercises: [],
      routines: [],
      settings: { setupComplete: true },
    } as never);
    const core = await createCore(store);
    expect(core.activeSession()).toBeNull();
    expect(core.listSessions()).toEqual([]);
  });
});
