import { useState } from "react";
import { useCore } from "./CoreContext";
import { shareOrDownload } from "./share";
import { useAction } from "./useAction";

// Unlike .json (see BackupSection), .csv with text/csv is on the list of files Chrome on Android can share.
const exportFileName = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `gym-tracker-export-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
};

/** "Export to spreadsheet": the history as a CSV file, shared or downloaded like a backup. */
export function ExportSection() {
  const core = useCore();
  const { error, run } = useAction();
  const [message, setMessage] = useState<string | null>(null);

  function exportHistory() {
    setMessage(null);
    // No waiting before the share: the browser only allows it straight after the tap.
    const exported = core.exportSpreadsheet();
    if (!exported) {
      setMessage("Nothing to export yet. Finish a session first.");
      return;
    }
    run(async () => {
      const outcome = await shareOrDownload(exportFileName(exported.createdAt), "text/csv", exported.text);
      if (outcome === "cancelled") return;
      setMessage(`${outcome === "shared" ? "Shared" : "Downloaded"} a spreadsheet with ${exported.sets} sets.`);
    });
  }

  return (
    <section className="stack">
      <h2>Export</h2>
      <p className="muted">All finished sessions as a CSV file, one row per set, for Excel or Google Sheets.</p>
      <button className="secondary wide" onClick={exportHistory}>
        Export to spreadsheet
      </button>
      {message && <p>{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
