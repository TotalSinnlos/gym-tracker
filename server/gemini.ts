// Talks to Google's Gemini API. This is the only file that knows about Gemini:
// switching to another AI means writing another `AiWriter` like this one.

import type { AiWriter, AiResult } from "./trainer.ts";

export function createGeminiWriter(options: { apiKey: string; model: string; fetch?: typeof fetch }): AiWriter {
  const doFetch = options.fetch ?? fetch;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`;

  return {
    async write({ instructions, brief, signal }): Promise<AiResult> {
      let response: Response;
      try {
        response = await doFetch(url, {
          method: "POST",
          headers: { "x-goog-api-key": options.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: instructions }] },
            contents: [{ role: "user", parts: [{ text: brief }] }],
          }),
          signal,
        });
      } catch (error) {
        // No answer at all: a timeout, or no connection to Google. Worth trying again later.
        return { ok: false, reason: "busy", detail: `No answer from Gemini: ${(error as Error).message}` };
      }

      const body = await response.text();
      if (!response.ok) return failure(response.status, body);

      try {
        const data = JSON.parse(body);
        const parts: { text?: string; thought?: boolean }[] = data.candidates?.[0]?.content?.parts ?? [];
        // Thinking models may send their working-out as extra parts marked `thought`; only the answer counts.
        const text = parts.filter((part) => !part.thought).map((part) => part.text ?? "").join("").trim();
        if (text) return { ok: true, text };
        const why = data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? "no text";
        return { ok: false, reason: "failed", detail: `Gemini sent no summary (${why}).` };
      } catch {
        return { ok: false, reason: "failed", detail: "Gemini's answer wasn't readable." };
      }
    },
  };
}

function failure(status: number, body: string): AiResult {
  const message = readMessage(body);
  const detail = `Gemini answered ${status}: ${message}`;
  // 503: the model is overloaded. 429: the free requests per minute or day are used up. 500/504: Google's side.
  if (status === 503 || status === 429 || status === 500 || status === 504) return { ok: false, reason: "busy", detail };
  // 400 with "The input token count (…) exceeds the maximum…": the brief doesn't fit.
  if (status === 400 && /token count.*exceeds/i.test(message)) return { ok: false, reason: "too-large", detail };
  // Anything else (a wrong key, an unknown model, …) won't fix itself.
  return { ok: false, reason: "failed", detail };
}

function readMessage(body: string): string {
  try {
    return JSON.parse(body).error?.message ?? body.slice(0, 300);
  } catch {
    return body.slice(0, 300);
  }
}
