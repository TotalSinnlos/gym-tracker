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
    expect(core.serverBackup()).toEqual({ url: ADDRESS, lastBackupAt: null });
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
    expect(restarted.serverBackup()).toEqual({ url: ADDRESS, lastBackupAt: null });
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
    expect(core.getData()).toEqual(before);
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
