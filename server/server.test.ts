import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHandler } from "./app.ts";
import { createBackupStore } from "./backupStore.ts";

const TOKEN = "a-test-token-that-is-long-enough";
const APP = "https://totalsinnlos.github.io";

let server: Server;
let folder: string;

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(folder, { recursive: true, force: true });
});

/** A running service on a free port, with a clock the test moves forward one minute per backup. */
async function start(options: { keep?: number; maxBytes?: number } = {}) {
  folder = await mkdtemp(join(tmpdir(), "gym-backup-"));
  let time = new Date("2026-10-31T10:00:00.000Z").getTime();
  const now = () => new Date((time += 60_000));
  const store = createBackupStore(folder, options.keep ?? 3, now);
  const handler = createHandler({ token: TOKEN, allowedOrigin: APP, maxBytes: options.maxBytes ?? 1000 }, store);
  server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return (path: string, init: RequestInit & { token?: string } = {}) =>
    fetch(base + path, {
      ...init,
      headers: { Origin: APP, Authorization: `Bearer ${init.token ?? TOKEN}`, ...init.headers },
    });
}

function backup(label: string) {
  return JSON.stringify({ version: 1, exercises: [], routines: [], settings: { label }, sessions: [] });
}

const upload = (text: string, token?: string) => ({ method: "PUT", body: text, token });

describe("backup service", () => {
  it("returns the backup that was uploaded last", async () => {
    const call = await start();
    expect((await call("/backup", upload(backup("first")))).status).toBe(200);
    expect((await call("/backup", upload(backup("second")))).status).toBe(200);

    const response = await call("/backup/latest");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(backup("second"));
  });

  it("says when there are no backups yet", async () => {
    const call = await start();
    expect((await call("/backup/latest")).status).toBe(404);
  });

  it("keeps only the newest backups", async () => {
    const call = await start({ keep: 3 });
    for (const label of ["1", "2", "3", "4", "5"]) await call("/backup", upload(backup(label)));

    expect(await readdir(folder)).toEqual([
      "backup-20261031T100300000Z.json",
      "backup-20261031T100400000Z.json",
      "backup-20261031T100500000Z.json",
    ]);
    expect(await (await call("/backup/latest")).text()).toBe(backup("5"));
  });

  it("ignores other files in the folder", async () => {
    const call = await start();
    await call("/backup", upload(backup("real")));
    await writeFile(join(folder, "notes.txt"), "not a backup");
    await writeFile(join(folder, "backup-99999999T999999999Z.json.tmp"), "half written");

    expect(await (await call("/backup/latest")).text()).toBe(backup("real"));
  });

  it("refuses requests without the right token and stores nothing", async () => {
    const call = await start();
    expect((await call("/backup", upload(backup("x"), "wrong"))).status).toBe(401);
    expect((await call("/backup", { method: "PUT", body: backup("x"), headers: { Authorization: "" } })).status).toBe(401);
    expect((await call("/backup/latest", { token: "wrong" })).status).toBe(401);
    expect(await readdir(folder)).toEqual([]);
  });

  it("refuses uploads that are too large", async () => {
    const call = await start({ maxBytes: 100 });
    const large = JSON.stringify({ ...JSON.parse(backup("x")), padding: "x".repeat(200) });
    expect((await call("/backup", upload(large))).status).toBe(413);
    expect(await readdir(folder)).toEqual([]);
  });

  it("refuses uploads that aren't a backup", async () => {
    const call = await start();
    for (const text of ["not json", "[]", "{}", JSON.stringify({ version: 1, exercises: [] })]) {
      expect((await call("/backup", upload(text))).status).toBe(400);
    }
    expect(await readdir(folder)).toEqual([]);
  });

  it("lets the app's website ask for permission, and no other website", async () => {
    const call = await start();
    const preflight = await call("/backup", { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(APP);
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(preflight.headers.get("Access-Control-Allow-Private-Network")).toBe("true");

    const other = await call("/backup", { method: "OPTIONS", headers: { Origin: "https://example.com" } });
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("lets the app read error replies too", async () => {
    const call = await start();
    const response = await call("/backup/latest", { token: "wrong" });
    expect(response.status).toBe(401);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(APP);
  });

  it("answers unknown paths and methods with errors", async () => {
    const call = await start();
    expect((await call("/other")).status).toBe(404);
    expect((await call("/backup", { method: "DELETE" })).status).toBe(405);
  });
});
