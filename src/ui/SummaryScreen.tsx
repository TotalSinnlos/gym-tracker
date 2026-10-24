import type { EndSessionResult, EntryState } from "../core";
import { formatReps } from "./format";
import { formatEntryWeight } from "./SessionScreen";

const STATE_LABELS: Record<EntryState, string> = {
  done: "✓ Done",
  incomplete: "◐ Incomplete",
  skipped: "– Skipped",
  pending: "Pending",
};

export function SummaryScreen({ result, onDone }: { result: EndSessionResult; onDone: () => void }) {
  const { session } = result;

  return (
    <main className="screen">
      {session ? (
        <>
          <h1>Session saved</h1>
          <ol className="stack routine-list">
            {session.entries.map((entry) => (
              <li key={entry.exerciseId} className="card">
                <strong>{entry.exerciseName}</strong>
                <span className="muted">
                  {STATE_LABELS[entry.state]}
                  {entry.loggedSets.length > 0 && ` · ${formatEntryWeight(entry)} · ${formatReps(entry)} reps`}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <h1>Session discarded</h1>
          <p className="muted">Nothing was logged, so there was nothing to save.</p>
        </>
      )}
      <button className="primary wide" onClick={onDone}>
        Done
      </button>
    </main>
  );
}
