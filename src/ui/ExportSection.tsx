import { useCallback, useState } from "react";
import { useCore } from "./CoreContext";
import { fileStamp } from "./format";
import { Icon } from "./icons";
import { shareOrDownload } from "./share";
import { Snack } from "./Snack";
import { useAction } from "./useAction";

// Unlike .json (see BackupSection), .csv with text/csv is on the list of files Chrome on Android can share.
const exportFileName = (iso: string) => `gym-tracker-export-${fileStamp(iso)}.csv`;

/** "Export to spreadsheet": the history as a CSV file, shared or downloaded like a backup. */
export function ExportSection() {
  const core = useCore();
  const { error, run } = useAction();
  const [message, setMessage] = useState<string | null>(null);
  const [nothing, setNothing] = useState(false);
  const closeMessage = useCallback(() => setMessage(null), []);

  function exportHistory() {
    setMessage(null);
    setNothing(false);
    // No waiting before the share: the browser only allows it straight after the tap.
    const exported = core.exportSpreadsheet();
    if (!exported) {
      setNothing(true);
      return;
    }
    run(async () => {
      const outcome = await shareOrDownload(exportFileName(exported.createdAt), "text/csv", exported.text);
      if (outcome === "cancelled") return;
      setMessage(`${outcome === "shared" ? "Shared" : "Downloaded"} a spreadsheet with ${exported.sets} sets.`);
    });
  }

  return (
    <>
      <div className="h2">Export</div>
      <div className="list">
        <button className="li" onClick={exportHistory}>
          <Icon name="table" />
          <span className="li-m">
            <span className="li-t">Export to spreadsheet</span>
            <span className="li-s">All finished sessions as a CSV file, one row per set, for Excel or Google Sheets.</span>
          </span>
        </button>
      </div>
      {nothing && <p className="hint">Nothing to export yet. Finish a session first.</p>}
      {error && (
        <p className="errmsg section-msg" role="alert">
          <Icon name="error" />
          {error}
        </p>
      )}
      {message && <Snack message={message} onClose={closeMessage} />}
    </>
  );
}
