import { type ChangeEvent, useCallback, useRef, useState } from "react";
import type { BackupInfo } from "../core";
import { useCore } from "./CoreContext";
import { fileStamp, formatDateTime } from "./format";
import { Icon } from "./icons";
import { shareOrDownload } from "./share";
import { Snack } from "./Snack";
import { useAction } from "./useAction";

// The file holds JSON, but Chrome on Android only shares certain file types and .json isn't one of them, so it's a .txt.
const backupFileName = (iso: string) => `gym-tracker-backup-${fileStamp(iso, true)}.txt`;

/**
 * "Back up" with the last backup time. `allowRestore` (in settings) adds "Restore from backup";
 * without it (on the session summary) it's one compact card.
 */
export function BackupSection({ allowRestore = false }: { allowRestore?: boolean }) {
  const core = useCore();
  const { error, run } = useAction();
  const [message, setMessage] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ text: string; info: BackupInfo } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastBackupAt = core.lastBackupAt();
  const closeMessage = useCallback(() => setMessage(null), []);

  function backUp() {
    setMessage(null);
    // No waiting before the share: the browser only allows it straight after the tap.
    const backup = core.createBackup();
    run(async () => {
      const outcome = await shareOrDownload(backupFileName(backup.createdAt), "text/plain", backup.text);
      if (outcome === "cancelled") return;
      await core.recordBackup(backup);
      setMessage(outcome === "shared" ? "Backup shared." : "Backup downloaded.");
    });
  }

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // So choosing the same file again still counts as a change.
    if (!file) return;
    setMessage(null);
    setPicked(null);
    run(async () => {
      const text = await file.text();
      setPicked({ text, info: core.checkBackup(text) });
    });
  }

  async function restore() {
    if (!picked) return;
    if (await run(() => core.restoreBackup(picked.text))) setMessage("Backup restored.");
    setPicked(null);
  }

  const lastBackup = (
    <span className="li-m">
      <span className="li-s">Last backup</span>
      <span className="li-t">{lastBackupAt ? formatDateTime(lastBackupAt) : "None yet"}</span>
    </span>
  );
  const backUpButton = (
    <button className="btn sm out" onClick={backUp}>
      Back up
    </button>
  );

  return (
    <>
      {allowRestore ? (
        <>
          <div className="h2">Backup</div>
          <div className="list">
            <div className="li backup-row">
              {lastBackup}
              {backUpButton}
            </div>
            <button className="li" onClick={() => fileInput.current?.click()}>
              <Icon name="upload" />
              <span className="li-m">
                <span className="li-t">Restore from backup</span>
                <span className="li-s">Pick a backup file</span>
              </span>
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,.json,text/plain,application/json"
            hidden
            onChange={pickFile}
          />
        </>
      ) : (
        <div className="card backup-row">
          {lastBackup}
          {backUpButton}
        </div>
      )}
      {error && (
        <p className="errmsg section-msg" role="alert">
          <Icon name="error" />
          {error}
        </p>
      )}
      {picked && (
        <>
          <div className="scrim" onClick={() => setPicked(null)} />
          <div className="dlg" role="alertdialog" aria-labelledby="restore-title">
            <div className="dlg-t" id="restore-title">
              Replace all your data with this backup?
            </div>
            {picked.info.createdAt && <div className="body mut">From {formatDateTime(picked.info.createdAt)}</div>}
            <div className="g2 stats">
              <div className="stat">
                <b>{picked.info.exercises}</b>
                <span>exercises</span>
              </div>
              <div className="stat">
                <b>{picked.info.sessions}</b>
                <span>sessions</span>
              </div>
            </div>
            <div className="dlg-b">
              Your current exercises, routines, history and any running session are replaced. This can't be undone.
            </div>
            <button className="btn lg out" onClick={() => setPicked(null)}>
              Cancel
            </button>
            <button className="btn lg dng" onClick={restore}>
              Replace my data
            </button>
          </div>
        </>
      )}
      {message && <Snack message={message} onClose={closeMessage} />}
    </>
  );
}
