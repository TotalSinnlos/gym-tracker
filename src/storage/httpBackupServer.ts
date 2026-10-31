import { type BackupServer, type ServerConnection, ServerError } from "../core";

/** How long to wait for the server before giving up, e.g. on a weak connection at the gym. */
const TIMEOUT_MS = 20_000;

/** Talks to the backup service in `server/` over HTTPS. */
export function createHttpBackupServer(): BackupServer {
  async function call(connection: ServerConnection, path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await fetch(connection.url + path, {
        ...init,
        headers: { Authorization: `Bearer ${connection.token}`, ...init.headers },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
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
