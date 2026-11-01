// POST /trainer: the app sends a trainer brief, the AI writes the trainer summary.
// POST /trainer/chat: the app sends a chat brief and the recent trainer chat, the AI writes the reply.
// The AI itself sits behind `AiWriter`, so tests use a stand-in and the AI can be swapped.

import type { ServerResponse } from "node:http";

export type AiResult =
  | { ok: true; text: string }
  /** too-large: the brief doesn't fit. busy: try again later. failed: needs fixing on the server. */
  | { ok: false; reason: "too-large" | "busy" | "failed"; detail: string };

/** One message of a conversation with the AI: from the user (or the app, for a trainer brief) or from the trainer. */
export interface AiMessage {
  role: "user" | "trainer";
  text: string;
}

/** The AI: given its instructions and a conversation ending with the user's message, it writes the trainer's next one. */
export interface AiWriter {
  write(request: { instructions: string; messages: AiMessage[]; signal: AbortSignal }): Promise<AiResult>;
}

export interface TrainerConfig {
  writer: AiWriter;
  /** For trainer summaries. */
  instructions: string;
  /** For the trainer chat. The chat brief is added after them. */
  chatInstructions: string;
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
  if (!trainer) return refuse(notSetUp);

  const text = await readBody();
  if (text === null) return refuse(tooLarge);
  const brief = readBrief(text);
  if (brief === null) return refuse({ status: 400, reason: "invalid", error: "This isn't a trainer brief from the app." });
  if (brief.length > trainer.maxChars) return refuse(tooLarge);

  const result = await trainer.writer.write({
    instructions: trainer.instructions,
    messages: [{ role: "user", text: brief }],
    signal: AbortSignal.timeout(trainer.timeoutMs),
  });
  if (result.ok) return send(response, 200, { summary: result.text });
  return refuse(aiRefusal(result));
}

const notSetUp: Refusal = { status: 501, reason: "not-set-up", error: "The trainer isn't set up on the server (no AI key)." };
const tooLarge: Refusal = { status: 413, reason: "too-large", error: "The request is too large for the AI." };

/** What the app is told when the AI didn't answer. The details only go to the server's log. */
function aiRefusal(result: Extract<AiResult, { ok: false }>): Refusal {
  console.error(`Trainer: ${result.detail}`);
  if (result.reason === "too-large") return tooLarge;
  if (result.reason === "busy") {
    return { status: 503, reason: "busy", error: "The AI is busy or out of free requests right now. Try again later." };
  }
  return { status: 502, reason: "failed", error: "The AI couldn't answer. Check the server's AI settings." };
}

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

/** POST /trainer/chat: `{ brief, messages }` (the chat brief and the recent trainer chat) → `{ reply }`. */
export async function handleTrainerChat(
  readBody: () => Promise<string | null>,
  trainer: TrainerConfig | undefined,
  response: ServerResponse,
) {
  const refuse = ({ status, reason, error }: Refusal) => send(response, status, { reason, error });
  if (!trainer) return refuse(notSetUp);

  const text = await readBody();
  if (text === null) return refuse(tooLarge);
  const chat = readChat(text);
  if (chat === null) return refuse({ status: 400, reason: "invalid", error: "This isn't a trainer chat message from the app." });
  const { brief, messages } = chat;
  const size = brief.length + messages.reduce((sum, m) => sum + m.text.length, 0);
  if (size > trainer.maxChars) return refuse(tooLarge);
  const result = await trainer.writer.write({
    instructions: `${trainer.chatInstructions}\n\nThe lifter's training (the chat brief):\n\n${brief}`,
    messages,
    signal: AbortSignal.timeout(trainer.timeoutMs),
  });
  if (result.ok) return send(response, 200, { reply: result.text });
  return refuse(aiRefusal(result));
}

/**
 * The chat brief and conversation, or null unless the request is `{ "brief": "<some text>", "messages": [...] }`
 * with messages from the user and the trainer that end with the user's.
 */
function readChat(text: string): { brief: string; messages: AiMessage[] } | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const { brief, messages } = data as { brief?: unknown; messages?: unknown };
  if (typeof brief !== "string" || brief.trim() === "" || !Array.isArray(messages) || messages.length === 0) return null;
  const isMessage = (m: unknown): m is AiMessage =>
    typeof m === "object" && m !== null &&
    ((m as AiMessage).role === "user" || (m as AiMessage).role === "trainer") &&
    typeof (m as AiMessage).text === "string" && (m as AiMessage).text.trim() !== "";
  if (!messages.every(isMessage) || messages.at(-1)?.role !== "user") return null;
  return { brief, messages: messages.map(({ role, text }) => ({ role, text })) };
}
