// The user's own backup server: what the core needs from it, checking what the user enters, and
// turning what went wrong into a message the screens show as it is.

import { CoreError } from "./validation";

export interface ServerConnection {
  url: string;
  token: string;
}

/**
 * - unreachable: no answer (offline, Tailscale off, server down, wrong address).
 * - blocked: Chrome's local network permission was refused.
 * - unauthorized: the server didn't accept the token.
 * - failed: the server answered with an error.
 */
export type ServerProblem = "unreachable" | "blocked" | "unauthorized" | "failed";

/** Thrown by a `BackupServer` when a request doesn't work out. */
export class ServerError extends Error {
  readonly problem: ServerProblem;
  /** The server's status code, for "failed". */
  readonly status?: number;

  constructor(problem: ServerProblem, status?: number) {
    super(status === undefined ? problem : `${problem} (${status})`);
    this.problem = problem;
    this.status = status;
  }
}

/** Talks to the backup service in `server/`. The app uses HTTP; tests use a stand-in. */
export interface BackupServer {
  upload(connection: ServerConnection, text: string): Promise<void>;
  /** The newest backup, or null if the server has none yet. */
  latest(connection: ServerConnection): Promise<string | null>;
}

/** The server's tokens are at least this long (see server/main.ts). */
const MIN_TOKEN_LENGTH = 20;

/** Tidies and checks an address and token. "name.ts.net" becomes "https://name.ts.net". */
export function buildConnection(address: string, token: string): ServerConnection {
  const trimmed = address.trim();
  if (trimmed === "") throw new CoreError("Enter your server's address");
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new CoreError("That isn't a web address");
  }
  // The app runs on https, and Chrome blocks it from calling plain http addresses.
  if (url.protocol !== "https:") throw new CoreError("The address must start with https://");
  const cleanToken = token.trim();
  if (cleanToken === "") throw new CoreError("Enter your server's token");
  if (cleanToken.length < MIN_TOKEN_LENGTH) throw new CoreError("That token is too short. Check you copied all of it");
  return { url: url.origin + url.pathname.replace(/\/+$/, ""), token: cleanToken };
}

/** Rethrows a `ServerError` as a CoreError with a message for the user. Other errors pass through. */
export function explainServerError(error: unknown): never {
  if (!(error instanceof ServerError)) throw error;
  switch (error.problem) {
    case "unreachable":
      throw new CoreError("Couldn't reach your server. Check you're online and Tailscale is on");
    case "blocked":
      throw new CoreError(
        "Chrome is blocking the app from reaching your server. Allow local network access for this app in Chrome's site settings",
      );
    case "unauthorized":
      throw new CoreError("Your server didn't accept the token. Check you copied all of it");
    case "failed":
      throw new CoreError(`Your server ran into a problem (error ${error.status ?? "unknown"}). Try again later`);
  }
}
