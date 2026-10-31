import { describe, expect, it } from "vitest";
import { createGeminiWriter } from "./gemini.ts";

/** A stand-in for `fetch` that answers like Gemini would and remembers the request. */
function standInFetch(status: number, body: unknown) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fakeFetch, requests };
}

const ask = (fakeFetch: typeof fetch) =>
  createGeminiWriter({ apiKey: "test-key", model: "gemini-test", fetch: fakeFetch }).write({
    instructions: "Review the session.",
    brief: "Chest press 45 kg: 13, 13",
    signal: new AbortController().signal,
  });

const geminiError = (message: string) => ({ error: { message } });

describe("Gemini", () => {
  it("sends the instructions and the brief to the chosen model, with the key", async () => {
    const { fakeFetch, requests } = standInFetch(200, { candidates: [{ content: { parts: [{ text: "Fine." }] } }] });
    await ask(fakeFetch);

    const [{ url, init }] = requests;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    expect(JSON.parse(init.body as string)).toEqual({
      systemInstruction: { parts: [{ text: "Review the session." }] },
      contents: [{ role: "user", parts: [{ text: "Chest press 45 kg: 13, 13" }] }],
    });
  });

  it("returns the summary without the model's thinking", async () => {
    const parts = [{ text: "Let me think...", thought: true }, { text: "Chest press " }, { text: "went up.\n" }];
    const { fakeFetch } = standInFetch(200, { candidates: [{ content: { parts } }] });
    expect(await ask(fakeFetch)).toEqual({ ok: true, text: "Chest press went up." });
  });

  it("treats an overloaded model or used-up free requests as busy", async () => {
    for (const status of [503, 429, 500, 504]) {
      const { fakeFetch } = standInFetch(status, geminiError("This model is currently experiencing high demand."));
      expect(await ask(fakeFetch)).toMatchObject({ ok: false, reason: "busy" });
    }
  });

  it("treats no answer at all as busy", async () => {
    const offline = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(await ask(offline)).toMatchObject({ ok: false, reason: "busy" });
  });

  it("recognises a brief that's too large", async () => {
    const { fakeFetch } = standInFetch(
      400,
      geminiError("The input token count (1200000) exceeds the maximum number of tokens allowed (1048576)."),
    );
    expect(await ask(fakeFetch)).toMatchObject({ ok: false, reason: "too-large" });
  });

  it("reports a wrong key or an unknown model as a failure", async () => {
    for (const [status, message] of [
      [400, "API key not valid. Please pass a valid API key."],
      [403, "Permission denied."],
      [404, "models/gemini-test is not found."],
    ] as const) {
      const { fakeFetch } = standInFetch(status, geminiError(message));
      expect(await ask(fakeFetch)).toMatchObject({ ok: false, reason: "failed", detail: expect.stringContaining(message) });
    }
  });

  it("reports an answer without a summary as a failure", async () => {
    for (const body of [{ candidates: [] }, { candidates: [{ finishReason: "SAFETY" }] }, "not json"]) {
      const { fakeFetch } = standInFetch(200, body);
      expect(await ask(fakeFetch)).toMatchObject({ ok: false, reason: "failed" });
    }
  });
});
