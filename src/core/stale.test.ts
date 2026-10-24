import { describe, expect, it } from "vitest";
import { CoreError, createCore, createMemoryStore } from ".";

const START = "2026-10-24T18:00:00.000Z";
const hoursAfterStart = (hours: number) => new Date(new Date(START).getTime() + hours * 60 * 60 * 1000);

/** A core whose clock the test moves with `setNow`. */
async function setup() {
  let counter = 0;
  let clock = new Date(START);
  const store = createMemoryStore();
  const options = { newId: () => `id-${++counter}`, now: () => clock };
  const core = await createCore(store, options);
  const press = await core.createExercise({ name: "Leg press", type: "machine", weight: 60 });
  const curl = await core.createExercise({ name: "Curl", type: "freeWeight", weight: 12, increment: 2 });
  const routine = await core.createRoutine("My routine", [press.id, curl.id]);
  const setNow = (date: Date) => (clock = date);
  const reopen = () => createCore(store, options);
  return { core, press, curl, routine, setNow, reopen };
}

describe("forgotten sessions", () => {
  it("are stale once started more than 6 hours ago", async () => {
    const { core, routine, setNow } = await setup();
    expect(core.isSessionStale()).toBe(false);
    await core.startSession(routine.id);
    expect(core.isSessionStale()).toBe(false);
    setNow(hoursAfterStart(6));
    expect(core.isSessionStale()).toBe(false);
    setNow(hoursAfterStart(6.01));
    expect(core.isSessionStale()).toBe(true);
  });

  it("are reported as stale when the app is reopened later", async () => {
    const { core, routine, press, setNow, reopen } = await setup();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 12 });

    setNow(hoursAfterStart(1));
    expect((await reopen()).isSessionStale()).toBe(false);
    setNow(hoursAfterStart(20));
    const reopened = await reopen();
    expect(reopened.isSessionStale()).toBe(true);
    expect(reopened.activeSession()?.startedAt).toBe(START);
  });

  it("are saved as normal when ended, dated by their start", async () => {
    const { core, routine, press, curl, setNow } = await setup();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 13 });
    await core.logSet(press.id, { reps: 13 });
    await core.logSet(curl.id, { reps: 10 });
    setNow(hoursAfterStart(20));

    const result = await core.endStaleSession();
    expect(result.session).toMatchObject({ startedAt: START, endedAt: START });
    expect(result.session?.entries.map((e) => e.state)).toEqual(["done", "incomplete"]);
    expect(result.session && result.summary.increases).toEqual([
      { exerciseId: press.id, name: "Leg press", fromKg: 60, toKg: 62.5 },
    ]);
    expect(core.activeSession()).toBeNull();
    expect(core.isSessionStale()).toBe(false);
    expect(core.getExercise(press.id).weight).toBe(62.5);
    expect(core.listSessions()).toEqual([result.session]);
    expect(core.lastResult(press.id)?.date).toBe(START);
  });

  it("are discarded when ended with nothing logged", async () => {
    const { core, routine, setNow } = await setup();
    await core.startSession(routine.id);
    setNow(hoursAfterStart(7));
    expect(await core.endStaleSession()).toEqual({ session: null });
    expect(core.activeSession()).toBeNull();
    expect(core.listSessions()).toEqual([]);
  });

  it("can't be ended this way while still recent, or when there's no session", async () => {
    const { core, routine } = await setup();
    await expect(core.endStaleSession()).rejects.toThrow(CoreError);
    await core.startSession(routine.id);
    await expect(core.endStaleSession()).rejects.toThrow(CoreError);
    expect(core.activeSession()).not.toBeNull();
  });

  it("keep going unchanged when continued", async () => {
    const { core, routine, press, setNow } = await setup();
    await core.startSession(routine.id);
    setNow(hoursAfterStart(8));
    await core.logSet(press.id, { reps: 12 });
    expect(core.activeSession()?.entries[0].loggedSets).toEqual([{ reps: 12, weight: 60 }]);
    const result = await core.endSession();
    expect(result.session?.endedAt).toBe(hoursAfterStart(8).toISOString());
  });
});
