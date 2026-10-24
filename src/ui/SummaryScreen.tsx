import type { EndSessionResult, ProgressionSummary } from "../core";
import { BackupSection } from "./BackupSection";
import { useCore } from "./CoreContext";
import { STATE_LABELS, formatEntryWeight, formatKg, formatReps } from "./format";
import { useAction } from "./useAction";

export function SummaryScreen({ result, onDone }: { result: EndSessionResult; onDone: () => void }) {
  return (
    <main className="screen">
      {result.session ? (
        <>
          <h1>Session saved</h1>
          <Progression sessionId={result.session.id} summary={result.summary} />
          <ol className="stack routine-list">
            {result.session.entries.map((entry) => (
              <li key={entry.exerciseId} className="card">
                <strong>{entry.exerciseName}</strong>
                <span className="muted">
                  {STATE_LABELS[entry.state]}
                  {entry.loggedSets.length > 0 && ` · ${formatEntryWeight(entry)} · ${formatReps(entry)} reps`}
                </span>
              </li>
            ))}
          </ol>
          <BackupSection />
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

/** Increases, bodyweight "rep range beaten" and below-range exercises, with the "lower weight" button. */
function Progression({ sessionId, summary }: { sessionId: string; summary: ProgressionSummary }) {
  const core = useCore();
  const { error, run } = useAction();
  const { increases, repRangeBeaten, belowRange } = summary;
  if (increases.length + repRangeBeaten.length + belowRange.length === 0) return null;

  return (
    <section className="stack">
      {increases.map((item) => (
        <div key={item.exerciseId} className="card">
          <strong>↑ {item.name}</strong>
          <span className="muted">
            Up to {formatKg(item.toKg)} next time (was {formatKg(item.fromKg)})
          </span>
        </div>
      ))}
      {repRangeBeaten.map((item) => (
        <div key={item.exerciseId} className="card">
          <strong>★ {item.name}</strong>
          <span className="muted">Rep range beaten: time for a harder variation?</span>
        </div>
      ))}
      {belowRange.map((item) => (
        <div key={item.entryId} className="card">
          <strong>↓ {item.name}</strong>
          <span className="muted">A set was below the rep range.</span>
          {item.lowerToKg !== undefined &&
            (core.wasLowered(sessionId, item.entryId) ? (
              <span>Lowered to {formatKg(item.lowerToKg)} for next time.</span>
            ) : (
              <button className="secondary" onClick={() => run(() => core.lowerWeightAfterSession(sessionId, item.entryId))}>
                Lower to {formatKg(item.lowerToKg)} next time?
              </button>
            ))}
        </div>
      ))}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
