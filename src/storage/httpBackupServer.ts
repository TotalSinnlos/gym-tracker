import { type BackupServer, type ServerConnection, ServerError, type ServerProblem, type TrainerServer } from "../core";

/** How long to wait for the server before giving up, e.g. on a weak connection at the gym. */
const TIMEOUT_MS = 20_000;

/** The trainer waits up to 90 seconds for the AI (see server/README.md), so the app waits a little longer. */
const TRAINER_TIMEOUT_MS = 120_000;

/** What the trainer's error answers mean (see server/README.md). 404: a server version without the trainer. */
const TRAINER_PROBLEMS: Record<number, ServerProblem> = { 404: "notSetUp", 413: "tooLarge", 501: "notSetUp", 502: "aiFailed", 503: "busy" };

/** Talks to the backup service in `server/` over HTTPS: backups, and the trainer. */
export function createHttpBackupServer(): BackupServer & TrainerServer {
  async function call(connection: ServerConnection, path: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS) {
    let response: Response;
    try {
      response = await fetch(connection.url + path, {
        ...init,
        headers: { Authorization: `Bearer ${connection.token}`, ...init.headers },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // The browser doesn't say why a request failed, so ask whether the permission was refused.
      throw new ServerError((await localNetworkRefused()) ? "blocked" : "unreachable");
    }
    if (response.status === 401) throw new ServerError("unauthorized");
    return response;
  }

  return {
    async upload(connection, text) {
      const response = await call(connection, "/backup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      if (!response.ok) throw new ServerError("failed", response.status);
    },

    async latest(connection) {
      const response = await call(connection, "/backup/latest");
      if (response.status === 404) return null;
      if (!response.ok) throw new ServerError("failed", response.status);
      return response.text();
    },

    async summarize(connection, brief) {
      const request = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief }) };
      const response = await call(connection, "/trainer", request, TRAINER_TIMEOUT_MS);
      if (!response.ok) {
        const problem = TRAINER_PROBLEMS[response.status];
        throw problem ? new ServerError(problem) : new ServerError("failed", response.status);
      }
      const { summary } = await response.json();
      if (typeof summary !== "string" || summary.trim() === "") throw new ServerError("aiFailed");
      return summary.trim();
    },
  };
}

/** Whether Chrome's "local network access" permission was refused. False where Chrome can't tell. */
async function localNetworkRefused(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: "local-network-access" as PermissionName });
    return status.state === "denied";
  } catch {
    return false;
  }
}
