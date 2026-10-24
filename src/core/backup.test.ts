import { describe, expect, it } from "vitest";
import { type AppData, CoreError, createCore, createMemoryStore } from ".";

async function setup(initial: AppData | null = null) {
  let counter = 0;
  let time = new Date("2026-10-24T18:00:00Z");
  const store = createMemoryStore(initial);
  const core = await createCore(store, {
    newId: () => `id-${++counter}`,
    now: () => time,
  });
  const setTime = (iso: string) => (time = new Date(iso));
  return { store, core, setTime };
}

/** A core with exercises, a routine, a saved session and a running one. */
async function setupWithHistory() {
  const context = await setup();
  const { core } = context;
  const press = await core.createExercise({ name: "Leg press", type: "machine", weight: 60 });
  const pullUp = await core.createExercise({ name: "Pull-ups", type: "bodyweight" });
  const routine = await core.createRoutine("My routine", [press.id, pullUp.id, press.id]);
  await core.completeSetup();
  await core.startSession(routine.id);
  await core.logSet(press.id, { reps: 13 });
  await core.logSet(press.id, { reps: 13 });
  await core.logSet(pullUp.id, { reps: 8 });
  await core.endSession();
  await core.startSession(routine.id);
  await core.logSet(press.id, { reps: 7 });
  return { ...context, press, pullUp, routine };
}

/** The backup's data, changed by `change`, as a file. */
function edited(text: string, change: (data: Record<string, any>) => void): string {
  const data = JSON.parse(text);
  change(data);
  return JSON.stringify(data);
}

describe("backing up", () => {
  it("puts all data and the format version in the file, stamped with the time it was made", async () => {
    const { core } = await setupWithHistory();
    const backup = core.createBackup();
    expect(backup.createdAt).toBe("2026-10-24T18:00:00.000Z");
    const data = JSON.parse(backup.text);
    expect(data).toEqual({ ...core.getData(), settings: { setupComplete: true, lastBackupAt: backup.createdAt } });
    expect(data.version).toBe(1);
  });

  it("records the last backup time only once the backup is saved", async () => {
    const { core, store } = await setupWithHistory();
    expect(core.lastBackupAt()).toBeNull();
    const backup = core.createBackup();
    expect(core.lastBackupAt()).toBeNull();
    await core.recordBackup(backup);
    expect(core.lastBackupAt()).toBe("2026-10-24T18:00:00.000Z");
    const reopened = await createCore(store);
    expect(reopened.lastBackupAt()).toBe("2026-10-24T18:00:00.000Z");
  });
});

describe("restoring", () => {
  it("brings back exactly the data from the time of the backup", async () => {
    const { core, setTime, press } = await setupWithHistory();
    const backup = core.createBackup();
    await core.recordBackup(backup);
    const before = structuredClone(core.getData());

    setTime("2026-10-25T10:00:00Z");
    await core.updateExercise(press.id, { weight: 100 });
    await core.endSession();
    await core.createExercise({ name: "Row", type: "machine" });
    await core.recordBackup(core.createBackup());

    await core.restoreBackup(backup.text);
    expect(core.getData()).toEqual(before);
    expect(core.activeSession()?.entries[0].loggedSets).toEqual([{ reps: 7, weight: 62.5 }]);
    expect(core.lastBackupAt()).toBe("2026-10-24T18:00:00.000Z");
  });

  it("replaces all data on another device, and saves it", async () => {
    const { core } = await setupWithHistory();
    const backup = core.createBackup();
    const other = await setup();
    await other.core.createExercise({ name: "Row", type: "machine" });

    await other.core.restoreBackup(backup.text);
    expect(other.core.listExercises().map((e) => e.name)).toEqual(["Leg press", "Pull-ups"]);
    expect(other.core.isSetupComplete()).toBe(true);
    const reopened = await createCore(other.store);
    expect(reopened.getData()).toEqual(other.core.getData());
  });

  it("replaces a running session with none when the backup had none", async () => {
    const { core } = await setup();
    await core.createExercise({ name: "Row", type: "machine" });
    const backup = core.createBackup();
    const other = await setupWithHistory();

    await other.core.restoreBackup(backup.text);
    expect(other.core.activeSession()).toBeNull();
    expect(other.core.listSessions()).toEqual([]);
  });

  it("describes a backup file before restoring it, without changing anything", async () => {
    const { core } = await setupWithHistory();
    const backup = core.createBackup();
    const other = await setup();
    expect(other.core.checkBackup(backup.text)).toEqual({ createdAt: "2026-10-24T18:00:00.000Z", exercises: 2, sessions: 1 });
    expect(other.core.listExercises()).toEqual([]);
  });

  it("upgrades an older backup the same way as older saved data", async () => {
    const { core } = await setupWithHistory();
    // Before entries had ids and settings had a backup time; sessions tracked `currentExerciseId`.
    const old = edited(core.createBackup().text, (data) => {
      delete data.settings.lastBackupAt;
      for (const session of [...data.sessions, data.activeSession]) {
        session.entries = session.entries.slice(0, 2).map(({ id: _, ...entry }: Record<string, unknown>) => entry);
        session.currentExerciseId = session.currentEntryId;
        delete session.currentEntryId;
      }
    });
    const other = await setup();
    await other.core.restoreBackup(old);
    expect(other.core.activeSession()?.entries.map((e) => e.id)).toEqual(["id-1", "id-2"]);
    expect(other.core.currentEntry()?.exerciseId).toBe("id-1");
    expect(other.core.lastBackupAt()).toBeNull();
  });
});

describe("rejecting backup files", () => {
  async function expectRejected(text: string, message: RegExp) {
    const { core, store } = await setupWithHistory();
    const before = structuredClone(core.getData());
    expect(() => core.checkBackup(text)).toThrow(message);
    await expect(core.restoreBackup(text)).rejects.toThrow(CoreError);
    await expect(core.restoreBackup(text)).rejects.toThrow(message);
    expect(core.getData()).toEqual(before);
    expect((await createCore(store)).getData()).toEqual(before);
  }

  it("rejects files that aren't JSON", async () => {
    await expectRejected("", /isn't a backup/);
    await expectRejected("hello", /isn't a backup/);
    await expectRejected("{ \"version\": 1, ", /isn't a backup/);
  });

  it("rejects JSON that isn't a backup", async () => {
    await expectRejected("null", /no format version/);
    await expectRejected("[]", /no format version/);
    await expectRejected('{ "name": "something else" }', /no format version/);
    await expectRejected('{ "version": 1 }', /exercises, routines or settings are missing/);
  });

  it("rejects backups from a newer version of the app, or with an unknown version", async () => {
    const { core } = await setupWithHistory();
    const text = core.createBackup().text;
    await expectRejected(edited(text, (data) => (data.version = 2)), /newer version of the app/);
    await expectRejected(edited(text, (data) => (data.version = "1")), /format version \("1"\) isn't supported/);
    await expectRejected(edited(text, (data) => (data.version = 0)), /format version \(0\) isn't supported/);
  });

  it("rejects backups with damaged parts", async () => {
    const { core } = await setupWithHistory();
    const text = core.createBackup().text;
    const damage: [(data: Record<string, any>) => void, RegExp][] = [
      [(data) => (data.exercises[0].weight = -5), /exercise "Leg press" is damaged \(Weight can't be negative\)/],
      [(data) => (data.exercises[0].sets = "2"), /exercise "Leg press" is damaged/],
      [(data) => delete data.exercises[0].weight, /exercise "Leg press" is damaged/],
      [(data) => (data.exercises[1].type = "cardio"), /exercise "Pull-ups" is damaged/],
      [(data) => delete data.exercises[1].archived, /exercise "Pull-ups" is damaged/],
      [(data) => (data.exercises[1].id = data.exercises[0].id), /two exercises share an id/],
      [(data) => (data.exercises[0] = null), /an exercise is damaged/],
      [(data) => data.routines[0].exerciseIds.push("gone"), /routine "My routine" uses an exercise that isn't in the backup/],
      [(data) => (data.routines[0].name = 3), /a routine is damaged/],
      [(data) => (data.settings.setupComplete = "yes"), /settings are damaged/],
      [(data) => (data.settings.lastBackupAt = "yesterday"), /settings are damaged/],
      [(data) => (data.sessions = "none"), /sessions are damaged/],
      [(data) => (data.sessions[0].entries = null), /sessions are damaged/],
      [(data) => (data.sessions[0].entries[0].loggedSets[0].reps = -1), /a saved session is damaged/],
      [(data) => (data.sessions[0].entries[0].state = "great"), /a saved session is damaged/],
      [(data) => delete data.sessions[0].endedAt, /a saved session is damaged/],
      [(data) => (data.activeSession.currentEntryId = "gone"), /the running session is damaged/],
      [(data) => (data.activeSession.entries[1].id = data.activeSession.entries[0].id), /the running session is damaged/],
    ];
    for (const [change, message] of damage) await expectRejected(edited(text, change), message);
  });
});
