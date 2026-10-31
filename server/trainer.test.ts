import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createHandler } from "./app.ts";
import type { BackupStore } from "./backupStore.ts";
import type { AiResult, AiWriter } from "./trainer.ts";

const TOKEN = "a-test-token-that-is-long-enough";
const APP = "https://totalsinnlos.github.io";
const INSTRUCTIONS = "Review the session.";

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve));
  server = undefined;
});

/** A stand-in AI that answers with `result` and remembers what it was asked. */
function standInAi(result: AiResult = { ok: true, text: "A good session." }) {
  const asked: { instructions: string; brief: string }[] = [];
  const writer: AiWriter = {
    async write({ instructions, brief }) {
      asked.push({ instructions, brief });
      return result;
    },
  };
  return { writer, asked };
}

const noStore: BackupStore = {
  save: async () => "unused",
  latest: async () => null,
  list: async () => [],
};

/** A running service on a free port. Without a writer, the trainer isn't set up. */
async function start(options: { writer?: AiWriter; maxChars?: number; timeoutMs?: number } = {}) {
  const trainer = options.writer && {
    writer: options.writer,
    instructions: INSTRUCTIONS,
    maxChars: options.maxChars ?? 1000,
    timeoutMs: options.timeoutMs ?? 5000,
  };
  server = createServer(createHandler({ token: TOKEN, allowedOrigin: APP, maxBytes: 10_000, trainer }, noStore));
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return async (body: unknown, token = TOKEN) => {
    const response = await fetch(`${base}/trainer`, {
      method: "POST",
      headers: { Origin: APP, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
}

describe("trainer", () => {
  it("returns the AI's summary of the brief", async () => {
    const ai = standInAi({ ok: true, text: "Chest press went up." });
    const ask = await start({ writer: ai.writer });

    const answer = await ask({ brief: "This session: chest press 45 kg: 13, 13" });

    expect(answer).toEqual({ status: 200, body: { summary: "Chest press went up." } });
    expect(ai.asked).toEqual([{ instructions: INSTRUCTIONS, brief: "This session: chest press 45 kg: 13, 13" }]);
  });

  it("refuses requests without the right token and doesn't ask the AI", async () => {
    const ai = standInAi();
    const ask = await start({ writer: ai.writer });

    expect((await ask({ brief: "a session" }, "wrong")).status).toBe(401);
    expect(ai.asked).toEqual([]);
  });

  it("says so when the trainer isn't set up on the server", async () => {
    const ask = await start();
    expect(await ask({ brief: "a session" })).toMatchObject({ status: 501, body: { reason: "not-set-up" } });
  });

  it("refuses requests that aren't a trainer brief", async () => {
    const ai = standInAi();
    const ask = await start({ writer: ai.writer });

    for (const body of ["not json", [], {}, { brief: "" }, { brief: "   " }, { brief: 5 }]) {
      expect(await ask(body)).toMatchObject({ status: 400, body: { reason: "invalid" } });
    }
    expect(ai.asked).toEqual([]);
  });

  it("answers 'too large' for a long brief without asking the AI", async () => {
    const ai = standInAi();
    const ask = await start({ writer: ai.writer, maxChars: 100 });

    expect(await ask({ brief: "x".repeat(100) })).toMatchObject({ status: 200 });
    expect(await ask({ brief: "x".repeat(101) })).toMatchObject({ status: 413, body: { reason: "too-large" } });
    expect(ai.asked).toHaveLength(1);
  });

  it("passes on the AI saying the brief is too large", async () => {
    const ask = await start({ writer: standInAi({ ok: false, reason: "too-large", detail: "too many tokens" }).writer });
    expect(await ask({ brief: "a session" })).toMatchObject({ status: 413, body: { reason: "too-large" } });
  });

  it("tells the app to try again later when the AI is busy", async () => {
    const ask = await start({ writer: standInAi({ ok: false, reason: "busy", detail: "503 high demand" }).writer });
    expect(await ask({ brief: "a session" })).toMatchObject({ status: 503, body: { reason: "busy" } });
  });

  it("reports a problem the server has to fix, such as a wrong AI key", async () => {
    const ask = await start({ writer: standInAi({ ok: false, reason: "failed", detail: "403 bad key" }).writer });
    const answer = await ask({ brief: "a session" });
    expect(answer).toMatchObject({ status: 502, body: { reason: "failed" } });
    expect(JSON.stringify(answer.body)).not.toContain("403 bad key");
  });

  it("gives the AI a deadline", async () => {
    // A stand-in AI that only answers when its deadline passes, like a real one cut off by the timeout.
    const slow: AiWriter = {
      write: ({ signal }) =>
        new Promise((resolve) =>
          signal.addEventListener("abort", () => resolve({ ok: false, reason: "busy", detail: "timed out" })),
        ),
    };
    const ask = await start({ writer: slow, timeoutMs: 50 });
    expect(await ask({ brief: "a session" })).toMatchObject({ status: 503, body: { reason: "busy" } });
  });

  it("lets the app's website send briefs", async () => {
    await start({ writer: standInAi().writer });
    const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
    const preflight = await fetch(`${base}/trainer`, { method: "OPTIONS", headers: { Origin: APP } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
