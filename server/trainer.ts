// POST /trainer: the app sends a trainer brief, the AI writes the session summary.
// The AI itself sits behind `AiWriter`, so tests use a stand-in and the AI can be swapped.

import type { ServerResponse } from "node:http";

export type AiResult =
  | { ok: true; text: string }
  /** too-large: the brief doesn't fit. busy: try again later. failed: needs fixing on the server. */
  | { ok: false; reason: "too-large" | "busy" | "failed"; detail: string };

export interface AiWriter {
  write(request: { instructions: string; brief: string; signal: AbortSignal }): Promise<AiResult>;
}

export interface TrainerConfig {
  writer: AiWriter;
  instructions: string;
  /** Briefs longer than this many characters get "too large" without asking the AI. */
  maxChars: number;
  /** How long to wait for the AI before giving up. */
  timeoutMs: number;
}

/** What the app gets back when there's no summary. `reason` tells it what to do next. */
type Refusal = { status: number; reason: "too-large" | "busy" | "failed" | "invalid" | "not-set-up"; error: string };

export async function handleTrainer(
  readBody: () => Promise<string | null>,
  trainer: TrainerConfig | undefined,
  response: ServerResponse,
) {
  const refuse = ({ status, reason, error }: Refusal) => send(response, status, { reason, error });
  if (!trainer) {
    return refuse({ status: 501, reason: "not-set-up", error: "The trainer isn't set up on the server (no AI key)." });
  }

  const text = await readBody();
  if (text === null) return refuse(tooLarge);
  const brief = readBrief(text);
  if (brief === null) return refuse({ status: 400, reason: "invalid", error: "This isn't a trainer brief from the app." });
  if (brief.length > trainer.maxChars) return refuse(tooLarge);

  const result = await trainer.writer.write({
    instructions: trainer.instructions,
    brief,
    signal: AbortSignal.timeout(trainer.timeoutMs),
  });
  if (result.ok) return send(response, 200, { summary: result.text });

  console.error(`Trainer: ${result.detail}`);
  if (result.reason === "too-large") return refuse(tooLarge);
  if (result.reason === "busy") {
    return refuse({ status: 503, reason: "busy", error: "The AI is busy or out of free requests right now. Try again later." });
  }
  return refuse({ status: 502, reason: "failed", error: "The AI couldn't write a summary. Check the server's AI settings." });
}

const tooLarge: Refusal = { status: 413, reason: "too-large", error: "The trainer brief is too large." };

/** The brief's text, or null if the request isn't `{ "brief": "<some text>" }`. */
function readBrief(text: string): string | null {
  try {
    const data = JSON.parse(text);
    const brief = typeof data === "object" && data !== null ? data.brief : undefined;
    return typeof brief === "string" && brief.trim() !== "" ? brief : null;
  } catch {
    return null;
  }
}

function send(response: ServerResponse, status: number, body: object) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
