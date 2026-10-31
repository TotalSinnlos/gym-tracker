import { useAutoBackup } from "./autoBackup";
import { useCore } from "./CoreContext";
import { formatDateTime } from "./format";
import { Icon } from "./icons";

/**
 * The end-of-session summary's line about the automatic server backup, with "Try again" after a failure.
 * Null when server backup isn't set up.
 */
export function ServerBackupCard() {
  const core = useCore();
  const { running, tryNow } = useAutoBackup();
  const server = core.serverBackup();
  if (!server) return null;

  let status: string;
  let detail: string | null = null;
  if (running) {
    status = "Backing up…";
  } else if (!server.due) {
    status = "Backed up";
    detail = server.lastBackupAt && formatDateTime(server.lastBackupAt);
  } else if (server.lastError) {
    status = "Not backed up yet";
    detail = "The app will try again later.";
  } else {
    status = "Waiting to back up";
  }

  return (
    <div className="card backup-row">
      <span className="li-m">
        <span className="li-s">Server backup</span>
        <span className="li-t">{status}</span>
        {detail && <span className="li-s">{detail}</span>}
      </span>
      {server.due && server.lastError && !running ? (
        <button className="btn sm out" onClick={tryNow}>
          Try again
        </button>
      ) : (
        !server.due && <Icon name="check" />
      )}
    </div>
  );
}
