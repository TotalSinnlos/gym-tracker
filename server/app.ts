// The service's web requests: PUT /backup stores a backup, GET /backup/latest returns the newest,
// POST /trainer asks the AI for a session summary (see trainer.ts).

import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { BackupStore } from "./backupStore.ts";
import { handleTrainer, type TrainerConfig } from "./trainer.ts";

export interface AppConfig {
  /** The secret the app sends as "Authorization: Bearer <token>". */
  token: string;
  /** The only website allowed to call the service, e.g. "https://totalsinnlos.github.io". */
  allowedOrigin: string;
  /** Uploads larger than this are refused. */
  maxBytes: number;
  /** The AI trainer, or undefined while no AI key is set up. */
  trainer?: TrainerConfig;
}

export function createHandler(config: AppConfig, store: BackupStore) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (request.headers.origin === config.allowedOrigin) allowOrigin(response, config.allowedOrigin);

    try {
      if (request.method === "OPTIONS") {
        // The browser asks first whether the app may send a token; the CORS headers above answer it.
        return send(response, 204);
      }
      if (path !== "/backup" && path !== "/backup/latest" && path !== "/trainer") {
        return send(response, 404, { error: "Not found." });
      }
      if (!hasToken(request, config.token)) return send(response, 401, { error: "Wrong or missing token." });

      if (path === "/backup" && request.method === "PUT") {
        const text = await readBody(request, config.maxBytes);
        if (text === null) return send(response, 413, { error: "The backup is too large." });
        if (!looksLikeBackup(text)) return send(response, 400, { error: "This isn't a backup from the app." });
        const savedAs = await store.save(text);
        return send(response, 200, { savedAs });
      }
      if (path === "/backup/latest" && request.method === "GET") {
        const text = await store.latest();
        if (text === null) return send(response, 404, { error: "There are no backups yet." });
        response.writeHead(200, { "Content-Type": "application/json" });
        return response.end(text);
      }
      if (path === "/trainer" && request.method === "POST") {
        return await handleTrainer(() => readBody(request, config.maxBytes), config.trainer, response);
      }
      return send(response, 405, { error: "Method not allowed." });
    } catch (error) {
      console.error(error);
      return send(response, 500, { error: "Something went wrong on the server." });
    }
  };
}

function allowOrigin(response: ServerResponse, origin: string) {
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  // Chrome's older private-network check; harmless where Chrome asks the user instead.
  response.setHeader("Access-Control-Allow-Private-Network", "true");
  response.setHeader("Access-Control-Max-Age", "600");
  response.setHeader("Vary", "Origin");
}

function send(response: ServerResponse, status: number, body?: object) {
  if (body === undefined) return response.writeHead(status).end();
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

/** Compares in constant time, so response times don't give away how much of a guess was right. */
function hasToken(request: IncomingMessage, token: string) {
  const given = /^Bearer (.+)$/.exec(request.headers.authorization ?? "")?.[1] ?? "";
  const digest = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(digest(given), digest(token));
}

/** The request body as text, or null if it's larger than `maxBytes`. */
async function readBody(request: IncomingMessage, maxBytes: number): Promise<string | null> {
  if (Number(request.headers["content-length"] ?? 0) > maxBytes) return null;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > maxBytes) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** A quick check of the backup's outline. The app checks every detail itself when restoring. */
function looksLikeBackup(text: string) {
  try {
    const data = JSON.parse(text);
    return (
      typeof data === "object" && data !== null && typeof data.version === "number" &&
      Array.isArray(data.exercises) && Array.isArray(data.routines) &&
      typeof data.settings === "object" && data.settings !== null
    );
  } catch {
    return false;
  }
}
