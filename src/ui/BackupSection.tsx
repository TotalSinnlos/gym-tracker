import { type ChangeEvent, useRef, useState } from "react";
import type { BackupInfo } from "../core";
import { useCore } from "./CoreContext";
import { shareOrDownload } from "./share";
import { useAction } from "./useAction";

const formatTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

// The file holds JSON, but Chrome on Android only shares certain file types and .json isn't one of them, so it's a .txt.
const backupFileName = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `gym-tracker-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.txt`;
};

/** "Back up" with the last backup time, plus "Restore from backup" when `allowRestore` is set. */
export function BackupSection({ allowRestore = false }: { allowRestore?: boolean }) {
  const core = useCore();
  const { error, run } = useAction();
  const [message, setMessage] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ text: string; info: BackupInfo } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastBackupAt = core.lastBackupAt();

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

  return (
    <section className="stack">
      <h2>Backup</h2>
      <p className="muted">{lastBackupAt ? `Last backup: ${formatTime(lastBackupAt)}` : "No backup made yet."}</p>
      <button className="secondary wide" onClick={backUp}>
        Back up
      </button>
      {allowRestore && (
        <>
          <button className="secondary wide" onClick={() => fileInput.current?.click()}>
            Restore from backup
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,.json,text/plain,application/json"
            hidden
            onChange={pickFile}
          />
        </>
      )}
      {picked && (
        <div className="card">
          <strong>Replace all your data with this backup?</strong>
          <span className="muted">
            Your current exercises, routines, history and any running session will be replaced by the backup
            {picked.info.createdAt && ` from ${formatTime(picked.info.createdAt)}`} ({picked.info.exercises} exercises,{" "}
            {picked.info.sessions} sessions). This can't be undone.
          </span>
          <div className="row">
            <button className="secondary" onClick={() => setPicked(null)}>
              Cancel
            </button>
            <button className="primary" onClick={restore}>
              Replace my data
            </button>
          </div>
        </div>
      )}
      {message && <p>{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
