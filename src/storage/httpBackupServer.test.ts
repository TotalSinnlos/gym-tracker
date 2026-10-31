import { afterEach, describe, expect, it, vi } from "vitest";
import { ServerError } from "../core";
import { createHttpBackupServer } from "./httpBackupServer";

const connection = { url: "https://home.example.ts.net", token: "a-token-that-is-long-enough" };

/** Replaces the browser's fetch with one that answers `reply`, and records the requests. */
function answer(reply: () => Response | Promise<Response>) {
  const requests: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return reply();
  });
  return requests;
}

const problemOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: ServerError) => ({ problem: error.problem, status: error.status }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the HTTP backup server", () => {
  it("uploads with PUT and the token", async () => {
    const requests = answer(() => new Response('{"savedAs":"x"}', { status: 200 }));
    await createHttpBackupServer().upload(connection, '{"version":1}');

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://home.example.ts.net/backup");
    expect(requests[0].init.method).toBe("PUT");
    expect(requests[0].init.body).toBe('{"version":1}');
    expect(requests[0].init.headers).toMatchObject({
      Authorization: "Bearer a-token-that-is-long-enough",
      "Content-Type": "application/json",
    });
  });

  it("fetches the newest backup, or null when there is none", async () => {
    const requests = answer(() => new Response('{"version":1}', { status: 200 }));
    expect(await createHttpBackupServer().latest(connection)).toBe('{"version":1}');
    expect(requests[0].url).toBe("https://home.example.ts.net/backup/latest");

    answer(() => new Response('{"error":"none"}', { status: 404 }));
    expect(await createHttpBackupServer().latest(connection)).toBeNull();
  });

  it("tells a refused token from a server error", async () => {
    answer(() => new Response("", { status: 401 }));
    expect(await problemOf(createHttpBackupServer().upload(connection, "{}"))).toEqual({ problem: "unauthorized" });

    answer(() => new Response("", { status: 500 }));
    expect(await problemOf(createHttpBackupServer().upload(connection, "{}"))).toEqual({ problem: "failed", status: 500 });
    expect(await problemOf(createHttpBackupServer().latest(connection))).toEqual({ problem: "failed", status: 500 });
  });

  it("says the server is unreachable when the request fails", async () => {
    answer(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(await problemOf(createHttpBackupServer().latest(connection))).toEqual({ problem: "unreachable" });
  });

  it("says the request was blocked when Chrome's local network permission was refused", async () => {
    answer(() => Promise.reject(new TypeError("Failed to fetch")));
    vi.stubGlobal("navigator", { permissions: { query: async () => ({ state: "denied" }) } });
    expect(await problemOf(createHttpBackupServer().latest(connection))).toEqual({ problem: "blocked" });
  });
});
