import { describe, expect, it } from "vitest";
import { createCore, createMemoryStore } from ".";

// Times are built in the computer's own time zone, like the phone's, so the dates below hold anywhere.
const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

async function setup() {
  let counter = 0;
  let time = local(24, 18);
  const store = createMemoryStore();
  const core = await createCore(store, {
    newId: () => `id-${++counter}`,
    now: () => time,
  });
  const setTime = (date: Date) => (time = date);
  const press = await core.createExercise({ name: "Leg press", type: "machine", weight: 60 });
  const curl = await core.createExercise({ name: "Curl", type: "freeWeight", weight: 12.5, increment: 1.25 });
  const pullUp = await core.createExercise({ name: "Pull-ups", type: "bodyweight" });
  const routine = await core.createRoutine("Day A", [press.id, curl.id, pullUp.id]);
  await core.completeSetup();
  return { store, core, setTime, press, curl, pullUp, routine };
}

/** The file's lines after the byte order mark, without the line endings. */
const lines = (text: string) => text.slice(1).split("\r\n").slice(0, -1);

describe("exporting to a spreadsheet", () => {
  it("has a header row with the columns, then one row per set", async () => {
    const { core, routine, press, curl, pullUp } = await setup();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 12 });
    await core.logSet(press.id, { reps: 10, weight: 62.5 });
    await core.logSet(curl.id, { reps: 9 });
    await core.logSet(curl.id, { reps: 8 });
    await core.logSet(pullUp.id, { reps: 7 });
    await core.logSet(pullUp.id, { reps: 6 });
    await core.endSession();

    const exported = core.exportSpreadsheet()!;
    expect(lines(exported.text)).toEqual([
      "Date,Routine,Exercise,Exercise type,Set,Weight (kg),Reps",
      "2026-10-24,Day A,Leg press,Machine,1,60,12",
      "2026-10-24,Day A,Leg press,Machine,2,62.5,10",
      "2026-10-24,Day A,Curl,Free weight,1,12.5,9",
      "2026-10-24,Day A,Curl,Free weight,2,12.5,8",
      "2026-10-24,Day A,Pull-ups,Bodyweight,1,,7",
      "2026-10-24,Day A,Pull-ups,Bodyweight,2,,6",
    ]);
    expect(exported.sets).toBe(6);
    expect(exported.createdAt).toBe(local(24, 18).toISOString());
  });

  it("opens cleanly in Excel: a byte order mark first and Windows line endings", async () => {
    const { core, routine, press } = await setup();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 12 });
    await core.endSession();

    const { text } = core.exportSpreadsheet()!;
    expect(text.startsWith("﻿Date,")).toBe(true);
    expect(text.endsWith("12\r\n")).toBe(true);
    expect(text.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  });

  it("leaves out skipped exercises but keeps the sets of incomplete ones", async () => {
    const { core, routine, press, curl } = await setup();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 12 });
    await core.logSet(press.id, { reps: 11 });
    await core.logSet(curl.id, { reps: 9 });
    await core.endSession();
    const session = core.listSessions()[0];
    expect(session.entries.map((e) => e.state)).toEqual(["done", "incomplete", "skipped"]);

    expect(lines(core.exportSpreadsheet()!.text).slice(1)).toEqual([
      "2026-10-24,Day A,Leg press,Machine,1,60,12",
      "2026-10-24,Day A,Leg press,Machine,2,60,11",
      "2026-10-24,Day A,Curl,Free weight,1,12.5,9",
    ]);
  });

  it("lists sessions oldest first, dated by the local day they started, and leaves out the running session", async () => {
    const { core, setTime, routine, press } = await setup();
    setTime(local(20, 23, 30));
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 12 });
    setTime(local(21, 0, 30));
    await core.endSession();
    setTime(local(22, 7));
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 9 });
    await core.endSession();
    setTime(local(24, 18));
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 5 });

    expect(lines(core.exportSpreadsheet()!.text).slice(1)).toEqual([
      "2026-10-20,Day A,Leg press,Machine,1,60,12",
      "2026-10-22,Day A,Leg press,Machine,1,60,9",
    ]);
  });

  it("puts sessions in date order even if the saved list isn't", async () => {
    const { core, setTime, routine, press } = await setup();
    for (const day of [20, 22]) {
      setTime(local(day, 10));
      await core.startSession(routine.id);
      await core.logSet(press.id, { reps: day - 10 });
      await core.endSession();
    }
    const data = core.getData();
    const reordered = await createCore(createMemoryStore({ ...data, sessions: [...data.sessions].reverse() }));
    expect(lines(reordered.exportSpreadsheet()!.text).slice(1)).toEqual([
      "2026-10-20,Day A,Leg press,Machine,1,60,10",
      "2026-10-22,Day A,Leg press,Machine,1,60,12",
    ]);
  });

  it("uses the names as they were in each session, even after renaming an exercise or deleting a routine", async () => {
    const { core, setTime, routine, press, curl } = await setup();
    const other = await core.createRoutine("Day B", [curl.id]);
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 12 });
    await core.endSession();
    await core.updateExercise(press.id, { name: "Leg press (new machine)" });
    await core.deleteRoutine(routine.id);
    setTime(local(25, 18));
    await core.startSession(other.id);
    await core.logSet(curl.id, { reps: 9 });
    await core.endSession();

    expect(lines(core.exportSpreadsheet()!.text).slice(1)).toEqual([
      "2026-10-24,Day A,Leg press,Machine,1,60,12",
      "2026-10-25,Day B,Curl,Free weight,1,12.5,9",
    ]);
  });

  it("quotes names with commas, quotes or line breaks, and keeps other letters as they are", async () => {
    const { core } = await setup();
    const squat = await core.createExercise({ name: 'Squat, "high bar"', type: "freeWeight", weight: 80 });
    const routine = await core.createRoutine("Legs\nand back", [squat.id]);
    await core.startSession(routine.id);
    await core.logSet(squat.id, { reps: 8 });
    await core.endSession();
    const other = await core.createRoutine("Beine & Rücken", [squat.id]);
    await core.startSession(other.id);
    await core.logSet(squat.id, { reps: 9 });
    await core.endSession();

    const text = core.exportSpreadsheet()!.text;
    expect(text).toContain('\r\n2026-10-24,"Legs\nand back","Squat, ""high bar""",Free weight,1,80,8\r\n');
    expect(text).toContain('\r\n2026-10-24,Beine & Rücken,"Squat, ""high bar""",Free weight,1,80,9\r\n');
  });

  it("writes weights with a dot for decimals and no thousands separator", async () => {
    const { core } = await setup();
    const sled = await core.createExercise({ name: "Sled", type: "machine", weight: 1250.25, increment: 0.1 });
    const routine = await core.createRoutine("Heavy", [sled.id]);
    await core.startSession(routine.id);
    await core.logSet(sled.id, { reps: 5 });
    await core.logSet(sled.id, { reps: 5, weight: 0.1 + 0.2 });
    await core.endSession();

    expect(lines(core.exportSpreadsheet()!.text).slice(1)).toEqual([
      "2026-10-24,Heavy,Sled,Machine,1,1250.25,5",
      "2026-10-24,Heavy,Sled,Machine,2,0.3,5",
    ]);
  });

  it("has nothing to export before the first session is finished", async () => {
    const { core, routine, press } = await setup();
    expect(core.exportSpreadsheet()).toBeNull();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 12 });
    expect(core.exportSpreadsheet()).toBeNull();
  });
});
