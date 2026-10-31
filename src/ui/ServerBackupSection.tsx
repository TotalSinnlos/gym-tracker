import { type FormEvent, useCallback, useState } from "react";
import type { BackupInfo } from "../core";
import { useAutoBackup } from "./autoBackup";
import { useCore } from "./CoreContext";
import { formatDateTime } from "./format";
import { Icon } from "./icons";
import { RestoreDialog } from "./RestoreDialog";
import { Snack } from "./Snack";
import { useAction } from "./useAction";

/** Settings' "Server backup": set up the user's own server, back up to it and restore from it. */
export function ServerBackupSection() {
  const core = useCore();
  const { error, run, clearError } = useAction();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"connecting" | "backing-up" | "fetching" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fetched, setFetched] = useState<{ text: string; info: BackupInfo } | null>(null);
  const closeMessage = useCallback(() => setMessage(null), []);
  const server = core.serverBackup();
  const autoRunning = useAutoBackup().running;

  /** Runs a server command, showing it as busy and keeping one action at a time. */
  async function runBusy(kind: NonNullable<typeof busy>, action: () => Promise<unknown>) {
    if (busy) return false;
    setMessage(null);
    setBusy(kind);
    try {
      return await run(action);
    } finally {
      setBusy(null);
    }
  }

  async function connect(address: string, token: string) {
    if (await runBusy("connecting", () => core.connectServer(address, token))) {
      setEditing(false);
      setMessage("Connected to your server.");
    }
  }

  async function backUp() {
    if (await runBusy("backing-up", () => core.backUpToServer())) setMessage("Backed up to your server.");
  }

  async function fetchLatest() {
    await runBusy("fetching", async () => setFetched(await core.fetchServerBackup()));
  }

  async function restore() {
    if (!fetched) return;
    if (await run(() => core.restoreBackup(fetched.text))) setMessage("Backup restored.");
    setFetched(null);
  }

  async function disconnect() {
    if (await run(() => core.disconnectServer())) setMessage("Server backup removed.");
  }

  let content;
  if (editing) {
    content = (
      <ConnectForm
        currentUrl={server?.url ?? null}
        busy={busy === "connecting"}
        onSubmit={connect}
        onCancel={() => {
          setEditing(false);
          clearError();
        }}
      />
    );
  } else if (!server) {
    content = (
      <div className="list">
        <button className="li" onClick={() => setEditing(true)}>
          <Icon name="plus" />
          <span className="li-m">
            <span className="li-t">Set up server backup</span>
            <span className="li-s">Back up to your own server, such as a home server reached through Tailscale.</span>
          </span>
        </button>
      </div>
    );
  } else {
    content = (
      <>
        <div className="list">
          <div className="li backup-row">
            <span className="li-m">
              <span className="li-s">Last backed up to server</span>
              <span className="li-t">
                {autoRunning ? "Backing up…" : server.lastBackupAt ? formatDateTime(server.lastBackupAt) : "Not yet"}
              </span>
            </span>
            <button className="btn sm out" onClick={backUp} disabled={busy !== null || autoRunning}>
              {busy === "backing-up" ? "Backing up…" : "Back up now"}
            </button>
          </div>
          <button className="li" onClick={fetchLatest} disabled={busy !== null}>
            <Icon name="upload" />
            <span className="li-m">
              <span className="li-t">{busy === "fetching" ? "Getting the newest backup…" : "Restore from server"}</span>
              <span className="li-s">Replace the data on this phone with the server's newest backup</span>
            </span>
          </button>
          <button className="li" onClick={() => setEditing(true)} disabled={busy !== null}>
            <Icon name="edit" />
            <span className="li-m">
              <span className="li-t">Change server</span>
              <span className="li-s">{server.url}</span>
            </span>
          </button>
          <button className="li li-action dng" onClick={disconnect} disabled={busy !== null}>
            <Icon name="trash" />
            <span className="li-m li-t">Remove server backup</span>
          </button>
        </div>
        {!error && !autoRunning && (server.lastError || server.overdue) && (
          <div className="banner section-msg" role="status">
            <Icon name="error" />
            <span>
              {server.lastError
                ? `The last backup to your server failed: ${server.lastError}. The app tries again whenever it's open.`
                : "Your latest changes have waited over a day to reach your server. Open the app with Tailscale on to send them."}
            </span>
          </div>
        )}
        <p className="hint">
          The app backs up to your server by itself after each session. Removing only forgets the server on this phone; the
          backups on it stay there.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="h2">Server backup</div>
      {content}
      {error && (
        <p className="errmsg section-msg" role="alert">
          <Icon name="error" />
          {error}
        </p>
      )}
      {fetched && <RestoreDialog info={fetched.info} onCancel={() => setFetched(null)} onRestore={restore} />}
      {message && <Snack message={message} onClose={closeMessage} />}
    </>
  );
}

interface ConnectFormProps {
  /** The address in use, when changing an existing setup. */
  currentUrl: string | null;
  busy: boolean;
  onSubmit: (address: string, token: string) => void;
  onCancel: () => void;
}

/** The server's address and token. When changing, an empty token keeps the current one. */
function ConnectForm({ currentUrl, busy, onSubmit, onCancel }: ConnectFormProps) {
  const [address, setAddress] = useState(currentUrl ?? "");
  const [token, setToken] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(address, token);
  }

  return (
    <form className="card form-card" onSubmit={submit}>
      <label className="fld">
        Address
        <input
          className="in"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="name.tailnet.ts.net"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <label className="fld">
        Token
        <input
          className="in"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={currentUrl ? "Leave empty to keep the current one" : undefined}
          autoComplete="off"
        />
      </label>
      <div className="note">
        <Icon name="info" />
        <span>Chrome may ask whether this app can access devices on your local network. Tap Allow, or backups can't reach your server.</span>
      </div>
      <div className="g2">
        <button type="button" className="btn lg out" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn lg pri" disabled={busy}>
          {busy ? "Connecting…" : "Connect"}
        </button>
      </div>
    </form>
  );
}
