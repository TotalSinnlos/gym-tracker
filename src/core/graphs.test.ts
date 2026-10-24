import { describe, expect, it } from "vitest";
import { TREND_SESSIONS, createCore, createMemoryStore } from ".";

/** Day `n` of the tests, as the ISO time a session started that day. */
const day = (n: number) => new Date(Date.UTC(2026, 9, n, 18)).toISOString();

/** A core whose clock moves to the next day before each session. */
async function setup() {
  let counter = 0;
  let today = 1;
  const store = createMemoryStore();
  const core = await createCore(store, {
    newId: () => `id-${++counter}`,
    now: () => new Date(day(today)),
  });
  // 2 sets of 9–12 by default, so 13+ reps on both sets qualifies.
  const press = await core.createExercise({ name: "Leg press", type: "machine", weight: 60 });
  const curl = await core.createExercise({ name: "Curl", type: "freeWeight", weight: 12, increment: 2, sets: 3 });
  const pullUp = await core.createExercise({ name: "Pull-ups", type: "bodyweight" });
  const routine = await core.createRoutine("My routine", [press.id, curl.id, pullUp.id]);

  /** Starts a session on the next day, logs the given reps per entry and ends it. */
  async function runSession(log: Record<string, number[]>, routineId = routine.id) {
    today++;
    const session = await core.startSession(routineId);
    for (const [entryId, reps] of Object.entries(log)) {
      for (const r of reps) await core.logSet(entryId, { reps: r });
    }
    const result = await core.endSession();
    if (!result.session) throw new Error("Session was discarded");
    return session;
  }

  return { core, press, curl, pullUp, routine, runSession, nextDay: () => today++ };
}

describe("an exercise's history for its graphs", () => {
  it("is empty before the exercise has been done", async () => {
    const { core, press, pullUp } = await setup();
    expect(core.exerciseHistory(press.id)).toEqual({ weight: [], reps: [] });
    expect(core.exerciseHistory(pullUp.id)).toEqual({ weight: null, reps: [] });
  });

  it("has one point per session, oldest first, with the session weight and each set's reps", async () => {
    const { core, press, runSession } = await setup();
    const first = await runSession({ [press.id]: [13, 14] });
    const second = await runSession({ [press.id]: [10, 9] });

    const history = core.exerciseHistory(press.id);
    expect(history.weight).toEqual([
      { sessionId: first.id, date: day(2), value: 60, incomplete: false },
      { sessionId: second.id, date: day(3), value: 62.5, incomplete: false },
    ]);
    expect(history.reps).toEqual([
      { sessionId: first.id, date: day(2), reps: [13, 14], incomplete: false },
      { sessionId: second.id, date: day(3), reps: [10, 9], incomplete: false },
    ]);
  });

  it("marks incomplete sessions and leaves out skipped ones", async () => {
    const { core, press, curl, runSession } = await setup();
    await runSession({ [press.id]: [12, 12], [curl.id]: [10] }); // curl: 1 of 3 sets
    await runSession({ [press.id]: [12, 12] }); // curl skipped
    await runSession({ [curl.id]: [10, 10, 10] });

    const history = core.exerciseHistory(curl.id);
    expect(history.weight?.map((p) => [p.date, p.incomplete])).toEqual([
      [day(2), true],
      [day(4), false],
    ]);
    expect(history.reps.map((p) => [p.reps, p.incomplete])).toEqual([
      [[10], true],
      [[10, 10, 10], false],
    ]);
  });

  it("gives a bodyweight exercise reps but no weight graph", async () => {
    const { core, pullUp, runSession } = await setup();
    await runSession({ [pullUp.id]: [8, 7] });
    const history = core.exerciseHistory(pullUp.id);
    expect(history.weight).toBeNull();
    expect(history.reps.map((p) => p.reps)).toEqual([[8, 7]]);
  });

  it("uses the session weight changed on the session screen, not single-set drops", async () => {
    const { core, press, routine, nextDay } = await setup();
    nextDay();
    await core.startSession(routine.id);
    await core.setSessionWeight(press.id, 70);
    await core.logSet(press.id, { reps: 12 });
    await core.logSet(press.id, { reps: 12, weight: 65 });
    await core.endSession();
    expect(core.exerciseHistory(press.id).weight?.map((p) => p.value)).toEqual([70]);
  });

  it("gives one point when the exercise appears twice in a session, from its last done or incomplete entry", async () => {
    const { core, press, runSession } = await setup();
    const twice = await core.createRoutine("Twice", [press.id, press.id]);
    await runSession({ [press.id]: [12, 12], [`${press.id}#2`]: [8] }, twice.id);
    expect(core.exerciseHistory(press.id).reps).toMatchObject([{ reps: [8], incomplete: true }]);

    await runSession({ [press.id]: [11, 11] }, twice.id); // second entry skipped
    expect(core.exerciseHistory(press.id).reps.map((p) => p.reps)).toEqual([[8], [11, 11]]);
  });

  it("leaves out the running session", async () => {
    const { core, press, routine, runSession } = await setup();
    await runSession({ [press.id]: [12, 12] });
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 10 });
    expect(core.exerciseHistory(press.id).reps).toHaveLength(1);
  });

  it("keeps an archived exercise's history", async () => {
    const { core, press, runSession } = await setup();
    await runSession({ [press.id]: [12, 12] });
    await core.archiveExercise(press.id);
    expect(core.exerciseHistory(press.id).reps).toHaveLength(1);
  });

  it("skips weightless sessions from before an exercise switched to a weighted type", async () => {
    const { core, pullUp, runSession } = await setup();
    await runSession({ [pullUp.id]: [8, 8] });
    await core.updateExercise(pullUp.id, { type: "freeWeight", weight: 10 });
    await runSession({ [pullUp.id]: [8, 8] });
    const history = core.exerciseHistory(pullUp.id);
    expect(history.weight?.map((p) => [p.date, p.value])).toEqual([[day(3), 10]]);
    expect(history.reps).toHaveLength(2);
  });
});

describe("the date of the last increase", () => {
  it("is null before any session, and for bodyweight exercises", async () => {
    const { core, press, pullUp, runSession } = await setup();
    expect(core.lastIncreaseDate(press.id)).toBeNull();
    await runSession({ [pullUp.id]: [20, 20] });
    expect(core.lastIncreaseDate(pullUp.id)).toBeNull();
  });

  it("is null while the weight has never gone up", async () => {
    const { core, press, runSession } = await setup();
    await runSession({ [press.id]: [12, 12] });
    await runSession({ [press.id]: [12, 11] });
    expect(core.lastIncreaseDate(press.id)).toBeNull();
  });

  it("is the session that earned the increase, straight after it ends", async () => {
    const { core, press, runSession } = await setup();
    await runSession({ [press.id]: [12, 12] });
    await runSession({ [press.id]: [13, 13] });
    expect(core.lastIncreaseDate(press.id)).toBe(day(3));
  });

  it("stays on that session while later sessions keep the weight", async () => {
    const { core, press, runSession } = await setup();
    await runSession({ [press.id]: [13, 13] });
    await runSession({ [press.id]: [10, 10] });
    await runSession({ [press.id]: [11, 12] });
    expect(core.lastIncreaseDate(press.id)).toBe(day(2));
  });

  it("moves to the latest of several increases", async () => {
    const { core, press, runSession } = await setup();
    await runSession({ [press.id]: [13, 13] });
    await runSession({ [press.id]: [10, 10] });
    await runSession({ [press.id]: [13, 14] });
    await runSession({ [press.id]: [9, 9] });
    expect(core.lastIncreaseDate(press.id)).toBe(day(4));
  });

  it("counts a weight raised in settings, dated by the last session before it", async () => {
    const { core, press, runSession } = await setup();
    await runSession({ [press.id]: [12, 12] });
    await core.updateExercise(press.id, { weight: 65 });
    expect(core.lastIncreaseDate(press.id)).toBe(day(2));
  });

  it("counts a weight raised on the session screen, dated by the session before", async () => {
    const { core, press, routine, runSession, nextDay } = await setup();
    await runSession({ [press.id]: [12, 12] });
    nextDay();
    await core.startSession(routine.id);
    await core.setSessionWeight(press.id, 65);
    await core.logSet(press.id, { reps: 10 });
    await core.logSet(press.id, { reps: 10 });
    await core.endSession();
    expect(core.lastIncreaseDate(press.id)).toBe(day(2));
  });

  it("doesn't count lowering, and an increase after lowering counts again", async () => {
    const { core, press, runSession } = await setup();
    await runSession({ [press.id]: [13, 13] }); // day 2: 60 → 62.5
    const low = await runSession({ [press.id]: [8, 8] }); // day 3 at 62.5, lowered to 60
    await core.lowerWeightAfterSession(low.id, press.id);
    expect(core.lastIncreaseDate(press.id)).toBe(day(2));
    await runSession({ [press.id]: [12, 12] }); // day 4 at 60
    await core.updateExercise(press.id, { weight: 50 });
    expect(core.lastIncreaseDate(press.id)).toBe(day(2));
    await runSession({ [press.id]: [13, 13] }); // day 5 at 50 → 52.5
    expect(core.lastIncreaseDate(press.id)).toBe(day(5));
  });
});

describe("the overview", () => {
  it("lists active exercises with their last increase and trend", async () => {
    const { core, press, curl, pullUp, runSession } = await setup();
    await runSession({ [press.id]: [13, 13], [pullUp.id]: [8, 7] });
    await runSession({ [press.id]: [12, 12], [curl.id]: [10], [pullUp.id]: [9, 9] });
    await core.archiveExercise(curl.id);

    const rows = core.overview();
    expect(rows.map((r) => r.exercise.name)).toEqual(["Leg press", "Pull-ups"]);
    expect(rows[0].exercise.weight).toBe(62.5);
    expect(rows[0].lastIncrease).toBe(day(2));
    expect(rows[0].trend.map((p) => p.value)).toEqual([60, 62.5]);
    // Bodyweight: no increases, and the trend is the total reps per session.
    expect(rows[1].lastIncrease).toBeNull();
    expect(rows[1].trend.map((p) => p.value)).toEqual([15, 18]);
  });

  it("gives an exercise without history an empty trend", async () => {
    const { core } = await setup();
    expect(core.overview().map((r) => r.trend)).toEqual([[], [], []]);
  });

  it("keeps the trend to the most recent sessions, with incomplete ones marked", async () => {
    const { core, curl, runSession } = await setup();
    for (let i = 0; i < TREND_SESSIONS + 2; i++) await runSession({ [curl.id]: i === TREND_SESSIONS + 1 ? [8] : [8, 8, 8] });
    const trend = core.exerciseTrend(curl.id);
    expect(trend).toHaveLength(TREND_SESSIONS);
    expect(trend[0].date).toBe(day(4));
    expect(trend.map((p) => p.incomplete).filter(Boolean)).toHaveLength(1);
    expect(trend.at(-1)?.incomplete).toBe(true);
  });
});
