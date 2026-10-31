import { describe, expect, it } from "vitest";
import {
  type AppData,
  type BackupServer,
  type ServerConnection,
  type ServerProblem,
  CoreError,
  ServerError,
  createCore,
  createMemoryStore,
} from ".";

const ADDRESS = "https://home.example.ts.net";
const TOKEN = "a-token-that-is-long-enough";

/** A stand-in for the backup service: keeps uploads in memory, or fails with `failWith`. */
function createFakeServer() {
  const fake = {
    uploads: [] as string[],
    seen: [] as ServerConnection[],
    failWith: null as ServerProblem | null,
    server: {
      async upload(connection, text) {
        check(connection);
        fake.uploads.push(text);
      },
      async latest(connection): Promise<string | null> {
        check(connection);
        return fake.uploads.at(-1) ?? null;
      },
    } satisfies BackupServer,
  };
  function check(connection: ServerConnection) {
    fake.seen.push(connection);
    if (fake.failWith) throw new ServerError(fake.failWith, fake.failWith === "failed" ? 500 : undefined);
  }
  return fake;
}

async function setup(initial: AppData | null = null) {
  let time = new Date("2026-10-31T18:00:00Z");
  const fake = createFakeServer();
  const store = createMemoryStore(initial);
  const core = await createCore(store, { now: () => time, server: fake.server });
  const setTime = (iso: string) => (time = new Date(iso));
  return { core, fake, store, setTime };
}

/** A core connected to the fake server, with one exercise. */
async function setupConnected() {
  const context = await setup();
  await context.core.createExercise({ name: "Leg press", type: "machine", weight: 60 });
  await context.core.connectServer(ADDRESS, TOKEN);
  context.fake.seen.length = 0;
  return context;
}

describe("setting up server backup", () => {
  it("isn't set up at first", async () => {
    const { core } = await setup();
    expect(core.serverBackup()).toBeNull();
  });

  it("saves the address once the server has answered", async () => {
    const { core, fake } = await setup();
    await core.connectServer(ADDRESS, TOKEN);

    expect(fake.seen).toEqual([{ url: ADDRESS, token: TOKEN }]);
    expect(core.serverBackup()).toEqual({ url: ADDRESS, lastBackupAt: null, due: true, overdue: false, lastError: null });
  });

  it("tidies the address and token", async () => {
    const { core, fake } = await setup();
    await core.connectServer("  home.example.ts.net/ ", `  ${TOKEN} `);
    expect(fake.seen[0]).toEqual({ url: ADDRESS, token: TOKEN });
  });

  it("refuses addresses and tokens that can't work, without asking the server", async () => {
    const { core, fake } = await setup();
    const attempts: [string, string, string][] = [
      ["", TOKEN, "Enter your server's address"],
      ["http://home.example.ts.net", TOKEN, "The address must start with https://"],
      ["https://not a host", TOKEN, "That isn't a web address"],
      [ADDRESS, " ", "Enter your server's token"],
      [ADDRESS, "short", "That token is too short. Check you copied all of it"],
    ];
    for (const [address, token, message] of attempts) {
      await expect(core.connectServer(address, token)).rejects.toThrow(new CoreError(message));
    }
    expect(fake.seen).toEqual([]);
    expect(core.serverBackup()).toBeNull();
  });

  it("doesn't save anything when the server can't be reached or refuses the token", async () => {
    const { core, fake } = await setup();
    const problems: [ServerProblem, string][] = [
      ["unreachable", "Couldn't reach your server. Check you're online and Tailscale is on"],
      ["blocked", "Chrome is blocking the app from reaching your server. Allow local network access for this app in Chrome's site settings"],
      ["unauthorized", "Your server didn't accept the token. Check you copied all of it"],
      ["failed", "Your server ran into a problem (error 500). Try again later"],
    ];
    for (const [problem, message] of problems) {
      fake.failWith = problem;
      await expect(core.connectServer(ADDRESS, TOKEN)).rejects.toThrow(new CoreError(message));
    }
    expect(core.serverBackup()).toBeNull();
  });

  it("can change the address and keep the token", async () => {
    const { core, fake } = await setupConnected();
    await core.connectServer("https://other.example.ts.net", "");
    expect(fake.seen).toEqual([{ url: "https://other.example.ts.net", token: TOKEN }]);
    expect(core.serverBackup()?.url).toBe("https://other.example.ts.net");
  });

  it("forgets the last server backup time only when the address changes", async () => {
    const { core } = await setupConnected();
    await core.backUpToServer();
    await core.connectServer(ADDRESS, "another-token-that-is-long-enough");
    expect(core.serverBackup()?.lastBackupAt).toBe("2026-10-31T18:00:00.000Z");

    await core.connectServer("https://other.example.ts.net", "");
    expect(core.serverBackup()?.lastBackupAt).toBeNull();
  });

  it("can be removed again", async () => {
    const { core } = await setupConnected();
    await core.disconnectServer();
    expect(core.serverBackup()).toBeNull();
    await expect(core.backUpToServer()).rejects.toThrow(new CoreError("Set up server backup first"));
  });

  it("keeps the connection on this phone after a restart", async () => {
    const { store, fake } = await setupConnected();
    const restarted = await createCore(store, { server: fake.server });
    expect(restarted.serverBackup()).toMatchObject({ url: ADDRESS, lastBackupAt: null, due: true });
  });

  it("needs a server to talk to", async () => {
    const core = await createCore(createMemoryStore());
    await expect(core.connectServer(ADDRESS, TOKEN)).rejects.toThrow(new CoreError("Server backup isn't available here"));
  });
});

describe("backing up to the server", () => {
  it("uploads the same backup a file would hold, and records the time", async () => {
    const { core, fake, setTime } = await setupConnected();
    setTime("2026-10-31T19:30:00Z");
    await core.backUpToServer();

    expect(fake.uploads).toHaveLength(1);
    expect(core.checkBackup(fake.uploads[0])).toEqual({ createdAt: "2026-10-31T19:30:00.000Z", exercises: 1, sessions: 0 });
    expect(core.serverBackup()?.lastBackupAt).toBe("2026-10-31T19:30:00.000Z");
    expect(core.lastBackupAt()).toBe("2026-10-31T19:30:00.000Z");
  });

  it("never puts the address or token into a backup", async () => {
    const { core, fake } = await setupConnected();
    await core.backUpToServer();
    for (const text of [fake.uploads[0], core.createBackup().text]) {
      expect(text).not.toContain(TOKEN);
      expect(text).not.toContain("home.example");
    }
  });

  it("records nothing when the upload fails", async () => {
    const { core, fake } = await setupConnected();
    fake.failWith = "unreachable";
    await expect(core.backUpToServer()).rejects.toThrow(CoreError);
    expect(core.serverBackup()?.lastBackupAt).toBeNull();
    expect(core.lastBackupAt()).toBeNull();
  });
});

describe("restoring from the server", () => {
  it("fetches the newest backup and says what's in it", async () => {
    const { core, setTime } = await setupConnected();
    await core.backUpToServer();
    setTime("2026-11-02T18:00:00Z");
    await core.createExercise({ name: "Pull-ups", type: "bodyweight" });
    await core.backUpToServer();

    const fetched = await core.fetchServerBackup();
    expect(fetched.info).toEqual({ createdAt: "2026-11-02T18:00:00.000Z", exercises: 2, sessions: 0 });
  });

  it("restores everything and keeps this phone's connection", async () => {
    const { core } = await setupConnected();
    await core.backUpToServer();
    const before = core.getData();
    await core.createExercise({ name: "Pull-ups", type: "bodyweight" });

    await core.restoreBackup((await core.fetchServerBackup()).text);
    expect(core.listExercises().map((e) => e.name)).toEqual(["Leg press"]);
    const { serverBackup: _, ...restored } = core.getData();
    const { serverBackup: __, ...expected } = before;
    expect(restored).toEqual(expected);
    expect(core.serverBackup()?.url).toBe(ADDRESS);
  });

  it("says when the server has no backups yet", async () => {
    const { core } = await setupConnected();
    await expect(core.fetchServerBackup()).rejects.toThrow(new CoreError("There are no backups on your server yet"));
  });

  it("explains when the server can't be reached", async () => {
    const { core, fake } = await setupConnected();
    fake.failWith = "unauthorized";
    await expect(core.fetchServerBackup()).rejects.toThrow(
      new CoreError("Your server didn't accept the token. Check you copied all of it"),
    );
  });

  it("restoring a backup file also keeps this phone's connection", async () => {
    const { core } = await setupConnected();
    const file = core.createBackup();
    await core.disconnectServer();
    await core.connectServer("https://other.example.ts.net", TOKEN);

    await core.restoreBackup(file.text);
    expect(core.serverBackup()?.url).toBe("https://other.example.ts.net");
  });
});

describe("knowing when the server needs a backup", () => {
  /** Connected and backed up, with a routine ready to start. */
  async function setupUpToDate() {
    const context = await setupConnected();
    const { core } = context;
    const press = core.listExercises()[0];
    const routine = await core.createRoutine("Legs", [press.id]);
    await core.backUpToServer();
    return { ...context, press, routine };
  }

  it("needs one straight after connecting, and not after a backup", async () => {
    const { core } = await setupConnected();
    expect(core.serverBackup()?.due).toBe(true);
    await core.backUpToServer();
    expect(core.serverBackup()?.due).toBe(false);
  });

  it("needs one once a session is saved", async () => {
    const { core, press, routine } = await setupUpToDate();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 10 });
    expect(core.serverBackup()?.due).toBe(false);

    await core.endSession();
    expect(core.serverBackup()?.due).toBe(true);
  });

  it("doesn't need one for a session that was discarded with nothing logged", async () => {
    const { core, routine } = await setupUpToDate();
    await core.startSession(routine.id);
    await core.endSession();
    expect(core.serverBackup()?.due).toBe(false);
  });

  it("needs one after history is corrected or deleted", async () => {
    const { core, press, routine } = await setupUpToDate();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 10 });
    const ended = await core.endSession();
    const sessionId = ended.session!.id;
    await core.backUpToServer();

    await core.editPastSet(sessionId, press.id, 0, { reps: 11 });
    expect(core.serverBackup()?.due).toBe(true);
    await core.backUpToServer();

    await core.deleteSession(sessionId);
    expect(core.serverBackup()?.due).toBe(true);
  });

  it("stays due if a session is saved while the backup is on its way", async () => {
    const { core, fake, press, routine } = await setupUpToDate();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 10 });
    await core.endSession();

    // The upload waits until the next session has ended too.
    let finishUpload = () => {};
    const upload = fake.server.upload;
    fake.server.upload = async (connection, text) => {
      await new Promise<void>((resolve) => (finishUpload = resolve));
      return upload(connection, text);
    };
    const backingUp = core.backUpToServer();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 11 });
    await core.endSession();
    finishUpload();
    await backingUp;

    expect(core.serverBackup()?.due).toBe(true);
  });

  it("remembers why a backup failed until one succeeds, and stays due", async () => {
    const { core, fake, press, routine } = await setupUpToDate();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 10 });
    await core.endSession();

    fake.failWith = "unreachable";
    await expect(core.backUpToServer()).rejects.toThrow(CoreError);
    expect(core.serverBackup()).toMatchObject({
      due: true,
      lastError: "Couldn't reach your server. Check you're online and Tailscale is on",
    });

    fake.failWith = null;
    await core.backUpToServer();
    expect(core.serverBackup()).toMatchObject({ due: false, lastError: null });
  });

  it("is overdue once a backup has waited more than a day", async () => {
    const { core, press, routine, setTime } = await setupUpToDate();
    setTime("2026-11-01T10:00:00Z");
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 10 });
    await core.endSession();

    setTime("2026-11-02T10:00:00Z");
    expect(core.serverBackup()?.overdue).toBe(false);
    setTime("2026-11-02T10:01:00Z");
    expect(core.serverBackup()?.overdue).toBe(true);
  });

  it("remembers a waiting backup after a restart", async () => {
    const { core, store, fake, press, routine } = await setupUpToDate();
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 10 });
    await core.endSession();

    const restarted = await createCore(store, { server: fake.server });
    expect(restarted.serverBackup()?.due).toBe(true);
  });

  it("doesn't track anything without a server set up", async () => {
    const { core } = await setup();
    const press = await core.createExercise({ name: "Leg press", type: "machine", weight: 60 });
    const routine = await core.createRoutine("Legs", [press.id]);
    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 10 });
    await core.endSession();
    expect(core.serverBackup()).toBeNull();
  });
});

describe("more changes the server needs", () => {
  it("needs a backup after a backup file is restored", async () => {
    const { core } = await setupConnected();
    const file = core.createBackup();
    await core.backUpToServer();

    await core.restoreBackup(file.text);
    expect(core.serverBackup()?.due).toBe(true);
  });

  it("needs a backup after exercises or routines change", async () => {
    const { core } = await setupConnected();
    const press = core.listExercises()[0];
    await core.backUpToServer();
    await core.updateExercise(press.id, { weight: 65 });
    expect(core.serverBackup()?.due).toBe(true);

    await core.backUpToServer();
    await core.createRoutine("Legs", [press.id]);
    expect(core.serverBackup()?.due).toBe(true);
  });
});

describe("when to try a backup straight away", () => {
  it("tries a new change, but doesn't retry a failure on its own", async () => {
    const { core, fake } = await setupConnected();
    expect(core.hasUntriedServerChanges()).toBe(true);

    fake.failWith = "unreachable";
    await expect(core.backUpToServer()).rejects.toThrow(CoreError);
    expect(core.serverBackup()?.due).toBe(true);
    expect(core.hasUntriedServerChanges()).toBe(false);
  });

  it("tries again once something new changes, even while a failed one is waiting", async () => {
    const { core, fake } = await setupConnected();
    fake.failWith = "unreachable";
    await expect(core.backUpToServer()).rejects.toThrow(CoreError);

    const press = core.listExercises()[0];
    const routine = await core.createRoutine("Legs", [press.id]);
    expect(core.hasUntriedServerChanges()).toBe(true);
    await expect(core.backUpToServer()).rejects.toThrow(CoreError);

    await core.startSession(routine.id);
    await core.logSet(press.id, { reps: 10 });
    expect(core.hasUntriedServerChanges()).toBe(false);
    await core.endSession();
    expect(core.hasUntriedServerChanges()).toBe(true);
  });

  it("tries again after a backup when something changed during it", async () => {
    const { core, fake } = await setupConnected();
    const press = core.listExercises()[0];
    let finishUpload = () => {};
    const upload = fake.server.upload;
    fake.server.upload = async (connection, text) => {
      await new Promise<void>((resolve) => (finishUpload = resolve));
      return upload(connection, text);
    };
    const backingUp = core.backUpToServer();
    await core.updateExercise(press.id, { weight: 65 });
    finishUpload();
    await backingUp;

    expect(core.hasUntriedServerChanges()).toBe(true);
  });

  it("has nothing to try once the server is up to date", async () => {
    const { core } = await setupConnected();
    await core.backUpToServer();
    expect(core.hasUntriedServerChanges()).toBe(false);
  });
});
