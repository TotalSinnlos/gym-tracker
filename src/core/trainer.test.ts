import { describe, expect, it } from "vitest";
import {
  type BackupServer,
  type ServerProblem,
  type TrainerServer,
  CoreError,
  ServerError,
  createCore,
  createMemoryStore,
} from ".";

const ADDRESS = "https://home.example.ts.net";
const TOKEN = "a-token-that-is-long-enough";

/** A stand-in for the trainer on the server: answers with numbered summaries and remembers the briefs. */
function createFakeTrainer() {
  const fake: { briefs: string[]; failWith: ServerProblem | null; maxChars: number; trainer: TrainerServer } = {
    briefs: [],
    failWith: null,
    /** Briefs longer than this get "too large", like the real server's size limit. */
    maxChars: Infinity,
    trainer: {
      async summarize(_connection, brief) {
        fake.briefs.push(brief);
        if (fake.failWith) throw new ServerError(fake.failWith);
        if (brief.length > fake.maxChars) throw new ServerError("tooLarge");
        return `Summary ${fake.briefs.length}`;
      },
    },
  };
  return fake;
}

const backupServer: BackupServer = { upload: async () => {}, latest: async () => null };

async function setup({ connect = true, trainerOn = true } = {}) {
  let counter = 0;
  let clock = new Date("2026-10-01T18:00:00Z");
  const fake = createFakeTrainer();
  const store = createMemoryStore();
  const core = await createCore(store, {
    newId: () => `id-${++counter}`,
    now: () => clock,
    server: backupServer,
    trainer: fake.trainer,
  });
  const nextDay = (days = 1) => (clock = new Date(clock.getTime() + days * 24 * 60 * 60 * 1000));
  const press = await core.createExercise({ name: "Leg press", type: "machine", weight: 60 });
  const row = await core.createExercise({ name: "Seated row", type: "machine", weight: 40 });
  const dips = await core.createExercise({ name: "Dips", type: "bodyweight" });
  const routine = await core.createRoutine("Full body", [press.id, row.id, dips.id]);
  if (connect) await core.connectServer(ADDRESS, TOKEN);
  if (connect && trainerOn) await core.setTrainerEnabled(true);
  return { core, fake, store, nextDay, press, row, dips, routine };
}

type Core = Awaited<ReturnType<typeof setup>>["core"];

/** Starts a session, logs the given reps per entry and ends it. */
async function runSession(core: Core, routineId: string, log: Record<string, number[]>) {
  await core.startSession(routineId);
  for (const [entryId, sets] of Object.entries(log)) {
    for (const reps of sets) await core.logSet(entryId, { reps });
  }
  const result = await core.endSession();
  if (!result.session) throw new Error("Session was discarded");
  return result.session;
}

describe("turning the trainer on and off", () => {
  it("is off at first, and can only be turned on with server backup set up", async () => {
    const { core } = await setup({ connect: false });
    expect(core.trainer()).toEqual({ available: false, enabled: false, goals: "" });
    await expect(core.setTrainerEnabled(true)).rejects.toThrow(CoreError);

    await core.connectServer(ADDRESS, TOKEN);
    expect(core.trainer()).toMatchObject({ available: true, enabled: false });
    await core.setTrainerEnabled(true);
    expect(core.trainer()).toMatchObject({ available: true, enabled: true });
  });

  it("keeps goals and notes, which may be empty", async () => {
    const { core } = await setup();
    await core.setTrainerGoals("  Build muscle. Sore left shoulder.  ");
    expect(core.trainer().goals).toBe("Build muscle. Sore left shoulder.");
    await core.setTrainerGoals("");
    expect(core.trainer().goals).toBe("");
  });

  it("goes off when the server is removed", async () => {
    const { core } = await setup();
    await core.disconnectServer();
    expect(core.trainer()).toMatchObject({ available: false, enabled: false });
  });
});

describe("summaries after a session", () => {
  it("makes a summary due when a session ends with the trainer on", async () => {
    const { core, press } = await setup();
    const session = await runSession(core, (await core.listRoutines())[0].id, { [press.id]: [10, 10] });
    expect(core.trainerDue()).toEqual([{ sessionId: session.id }]);
    expect(core.trainerSummaryStatus(session.id)).toEqual({ state: "due", lastError: null, temporary: false });
  });

  it("makes nothing due and sends nothing with the trainer off", async () => {
    const { core, fake, press, routine } = await setup({ trainerOn: false });
    const session = await runSession(core, routine.id, { [press.id]: [10, 10] });
    expect(core.trainerDue()).toEqual([]);
    expect(core.trainerSummaryStatus(session.id)).toEqual({ state: "none" });
    await expect(core.writeTrainerSummary(session.id)).rejects.toThrow(CoreError);
    expect(fake.briefs).toEqual([]);
  });

  it("stores the written summary on the session and clears it from due", async () => {
    const { core, press, routine } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 10] });
    await core.writeTrainerSummary(session.id);

    expect(core.trainerDue()).toEqual([]);
    expect(core.trainerSummaryStatus(session.id)).toEqual({
      state: "written",
      summary: { text: "Summary 1", writtenAt: "2026-10-01T18:00:00.000Z" },
    });
    expect(core.getSession(session.id).trainerSummary?.text).toBe("Summary 1");
  });

  it("keeps a failed summary due, saying whether it's worth waiting", async () => {
    const { core, fake, press, routine } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 10] });

    fake.failWith = "busy";
    await expect(core.writeTrainerSummary(session.id)).rejects.toThrow("The AI is busy");
    expect(core.trainerSummaryStatus(session.id)).toMatchObject({ state: "due", temporary: true });

    fake.failWith = "notSetUp";
    await expect(core.writeTrainerSummary(session.id)).rejects.toThrow("isn't set up on your server");
    expect(core.trainerSummaryStatus(session.id)).toMatchObject({
      state: "due",
      lastError: expect.stringContaining("isn't set up on your server"),
      temporary: false,
    });

    fake.failWith = null;
    await core.writeTrainerSummary(session.id);
    expect(core.trainerSummaryStatus(session.id).state).toBe("written");
  });

  it("cancels due summaries when the trainer is turned off, and keeps written ones", async () => {
    const { core, nextDay, press, routine } = await setup();
    const first = await runSession(core, routine.id, { [press.id]: [10, 10] });
    await core.writeTrainerSummary(first.id);
    nextDay();
    const second = await runSession(core, routine.id, { [press.id]: [10, 10] });

    await core.setTrainerEnabled(false);
    expect(core.trainerDue()).toEqual([]);
    expect(core.trainerSummaryStatus(first.id).state).toBe("written");
    expect(core.trainerSummaryStatus(second.id).state).toBe("none");
  });

  it("cancels due summaries when the server is removed", async () => {
    const { core, press, routine } = await setup();
    await runSession(core, routine.id, { [press.id]: [10, 10] });
    await core.disconnectServer();
    expect(core.trainerDue()).toEqual([]);
  });

  it("writes again on request, replacing the old summary, or writes one for a session without", async () => {
    const { core, nextDay, press, routine } = await setup({ trainerOn: false });
    const before = await runSession(core, routine.id, { [press.id]: [10, 10] });
    await core.setTrainerEnabled(true);
    nextDay();
    const session = await runSession(core, routine.id, { [press.id]: [10, 10] });
    await core.writeTrainerSummary(session.id);
    await core.editPastSet(session.id, press.id, 0, { reps: 13 });
    // Correcting doesn't rewrite the summary by itself.
    expect(core.getSession(session.id).trainerSummary?.text).toBe("Summary 1");

    await core.writeTrainerSummary(session.id);
    expect(core.getSession(session.id).trainerSummary?.text).toBe("Summary 2");
    // Turning the trainer on didn't write one for the older session, but it can be asked for.
    expect(core.trainerSummaryStatus(before.id).state).toBe("none");
    await core.writeTrainerSummary(before.id);
    expect(core.trainerSummaryStatus(before.id).state).toBe("written");
  });

  it("deletes a summary, and a due one, with its session", async () => {
    const { core, nextDay, press, routine } = await setup();
    const written = await runSession(core, routine.id, { [press.id]: [10, 10] });
    await core.writeTrainerSummary(written.id);
    nextDay();
    const due = await runSession(core, routine.id, { [press.id]: [10, 10] });

    await core.deleteSession(due.id);
    expect(core.trainerDue()).toEqual([]);
    await core.deleteSession(written.id);
    expect(core.listSessions()).toEqual([]);
  });

  it("drops a summary that arrives after its session was deleted", async () => {
    const { core, fake, press, routine } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 10] });
    let finish = () => {};
    fake.trainer.summarize = async () => {
      await new Promise<void>((resolve) => (finish = resolve));
      return "Too late";
    };
    const writing = core.writeTrainerSummary(session.id);
    await core.deleteSession(session.id);
    finish();
    await writing;
    expect(core.listSessions()).toEqual([]);
  });

  it("keeps summaries and goals through backup and restore, but not what's still due", async () => {
    const { core, nextDay, press, routine } = await setup();
    await core.setTrainerGoals("Build muscle");
    const written = await runSession(core, routine.id, { [press.id]: [10, 10] });
    await core.writeTrainerSummary(written.id);
    nextDay();
    await runSession(core, routine.id, { [press.id]: [10, 10] });

    const backup = core.createBackup();
    expect(backup.text).not.toContain("trainerDue");
    await core.restoreBackup(backup.text);
    expect(core.getSession(written.id).trainerSummary?.text).toBe("Summary 1");
    expect(core.trainer()).toMatchObject({ enabled: true, goals: "Build muscle" });
    expect(core.trainerDue()).toEqual([]);
  });

  it("rejects a backup with a damaged summary", async () => {
    const { core, press, routine } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 10] });
    await core.writeTrainerSummary(session.id);
    const damaged = core.createBackup().text.replace('"writtenAt": "2026-10-01T18:00:00.000Z"', '"writtenAt": 5');
    expect(() => core.checkBackup(damaged)).toThrow(CoreError);
  });
});

describe("the trainer brief", () => {
  it("has the progression rule, the goals, the session, the exercises and routines", async () => {
    const { core, press, row, dips, routine } = await setup();
    await core.setTrainerGoals("Build muscle. Sore left shoulder.");
    const session = await runSession(core, routine.id, { [press.id]: [13, 13], [dips.id]: [12] });
    const brief = core.trainerBrief(session.id);

    expect(brief).toContain("When every set reaches at least one rep above the top of the range");
    expect(brief).toContain("Goals and notes: Build muscle. Sore left shoulder.");
    expect(brief).toContain('This session (2026-10-01, routine "Full body"):');
    expect(brief).toContain("- Leg press (machine, 2 sets of 9-12): 60 kg: 13, 13 (done, increase earned: next time 62.5 kg)");
    expect(brief).toContain(`- ${row.name} (machine, 2 sets of 9-12): skipped`);
    expect(brief).toContain("- Dips (bodyweight, 2 sets of 9-12): 12 (incomplete, 1 of 2 sets)");
    expect(brief).toContain("- Leg press: machine, 2 sets of 9-12 reps, increment 2.5 kg");
    expect(brief).toContain("- Full body: Leg press, Seated row, Dips");
    expect(brief).toContain("Earlier sessions, oldest first:\n(none)");
  });

  it("says when there are no goals", async () => {
    const { core, press, routine } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 10] });
    expect(core.trainerBrief(session.id)).toContain("Goals and notes: (none)");
  });

  it("has the facts worked out per exercise", async () => {
    const { core, nextDay, press, row, routine } = await setup();
    // Leg press: up from 60 to 62.5 kg after the first session, then 4 sessions at 62.5 kg.
    await runSession(core, routine.id, { [press.id]: [13, 13], [row.id]: [10, 10] });
    for (const reps of [10, 11, 11, 10]) {
      nextDay(7);
      await runSession(core, routine.id, { [press.id]: [reps, 9] });
    }
    const last = core.listSessions()[0];
    const brief = core.trainerBrief(last.id);

    expect(brief).toContain(
      "- Leg press: weight last went up 3 weeks before this session (to 62.5 kg); 4 sessions at 62.5 kg including this one; best at 62.5 kg: 11, 9; skipped in 0 of the last 5 sessions it was in; below range in 0 of its last 4 results",
    );
    expect(brief).toContain(
      "- Seated row: weight hasn't gone up since it was first done (2026-10-01); 1 session at 40 kg, not done this session; best at 40 kg: 10, 10",
    );
    expect(brief).toContain("skipped in 4 of the last 5 sessions it was in");
    expect(brief).toContain("Training frequency: 4 sessions in the 4 weeks up to this one; the previous session was 7 days before.");
  });

  it("lists earlier sessions and their summaries, and archived exercises", async () => {
    const { core, nextDay, press, row, routine } = await setup();
    const first = await runSession(core, routine.id, { [press.id]: [10, 9], [row.id]: [12, 11] });
    await core.writeTrainerSummary(first.id);
    await core.archiveExercise(row.id);
    nextDay();
    const second = await runSession(core, routine.id, { [press.id]: [11, 10] });
    const brief = core.trainerBrief(second.id);

    expect(brief).toContain("2026-10-01 Full body: Leg press 60 kg: 10, 9; Seated row 40 kg: 12, 11; Dips skipped");
    expect(brief).toContain("Earlier summaries, oldest first:\n2026-10-01:\nSummary 1");
    expect(brief).toContain("- Seated row: machine, 2 sets of 9-12 reps, increment 2.5 kg (archived; last done 2026-10-01)");
  });

  it("covers only what had happened up to an older session", async () => {
    const { core, nextDay, press, routine } = await setup();
    const first = await runSession(core, routine.id, { [press.id]: [10, 9] });
    nextDay();
    const second = await runSession(core, routine.id, { [press.id]: [12, 12] });
    await core.writeTrainerSummary(second.id);
    await core.setTrainerGoals("Get stronger");

    const brief = core.trainerBrief(first.id);
    expect(brief).toContain('This session (2026-10-01, routine "Full body")');
    expect(brief).not.toContain("2026-10-02");
    expect(brief).not.toContain("Summary 1");
    expect(brief).toContain("Earlier sessions, oldest first:\n(none)");
    // The goals are always the current ones.
    expect(brief).toContain("Goals and notes: Get stronger");
  });

  it("leaves out the oldest sessions when the server says it's too large, keeping the facts", async () => {
    const { core, fake, nextDay, press, routine } = await setup({ trainerOn: false });
    for (let i = 0; i < 12; i++) {
      await runSession(core, routine.id, { [press.id]: [10, 10] });
      nextDay();
    }
    await core.setTrainerEnabled(true);
    const last = await runSession(core, routine.id, { [press.id]: [10, 10] });
    const full = core.trainerBrief(last.id);
    fake.maxChars = full.length - 300;

    await core.writeTrainerSummary(last.id);
    const sent = fake.briefs.at(-1)!;
    expect(fake.briefs.length).toBeGreaterThan(1);
    expect(sent.length).toBeLessThanOrEqual(fake.maxChars);
    expect(sent).toContain("older sessions left out)");
    expect(sent).not.toContain("2026-10-01 Full body");
    expect(sent).toContain("2026-10-12 Full body");
    expect(sent).toContain("- Leg press: weight hasn't gone up since it was first done (2026-10-01); 13 sessions at 60 kg");
    expect(core.trainerSummaryStatus(last.id).state).toBe("written");
  });

  it("gives up when even the shortest brief is too large", async () => {
    const { core, fake, press, routine } = await setup();
    const session = await runSession(core, routine.id, { [press.id]: [10, 10] });
    fake.maxChars = 10;
    await expect(core.writeTrainerSummary(session.id)).rejects.toThrow("too long for the AI");
    expect(fake.briefs).toHaveLength(1);
  });
});
