import type { BackupInfo } from "../core";
import { formatDateTime } from "./format";

/** "Replace all your data with this backup?", for a backup file or the server's newest backup. */
export function RestoreDialog({ info, onCancel, onRestore }: { info: BackupInfo; onCancel: () => void; onRestore: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onCancel} />
      <div className="dlg" role="alertdialog" aria-labelledby="restore-title">
        <div className="dlg-t" id="restore-title">
          Replace all your data with this backup?
        </div>
        {info.createdAt && <div className="body mut">From {formatDateTime(info.createdAt)}</div>}
        <div className="g2 stats">
          <div className="stat">
            <b>{info.exercises}</b>
            <span>exercises</span>
          </div>
          <div className="stat">
            <b>{info.sessions}</b>
            <span>sessions</span>
          </div>
        </div>
        <div className="dlg-b">
          Everything on this phone is replaced. This can't be undone.
        </div>
        <button className="btn lg out" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn lg dng" onClick={onRestore}>
          Replace my data
        </button>
      </div>
    </>
  );
}
