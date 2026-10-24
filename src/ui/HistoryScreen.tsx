import { useState } from "react";
import type { Session, SessionEntry } from "../core";
import { useCore } from "./CoreContext";
import { STATE_LABELS, formatDate, formatEntryWeight, formatKg, formatSet } from "./format";
import { SetForm } from "./SetForm";
import { useAction } from "./useAction";

/** Past sessions, newest first. Tapping one opens it to review, correct or delete it. */
export function HistoryScreen({ onBack }: { onBack: () => void }) {
  const core = useCore();
  const [openId, setOpenId] = useState<string | null>(null);
  const sessions = core.listSessions();
  const open = sessions.find((s) => s.id === openId);

  if (open) return <SessionDetail session={open} onBack={() => setOpenId(null)} />;

  return (
    <main className="screen">
      <header className="row header">
        <button className="secondary" onClick={onBack}>
          ← Back
        </button>
        <h1 className="grow">History</h1>
      </header>

      {sessions.length === 0 && <p className="muted">No sessions yet. They'll appear here once you end one.</p>}

      {sessions.map((session) => {
        const done = session.entries.filter((e) => e.state === "done").length;
        return (
          <button key={session.id} className="card list-item" onClick={() => setOpenId(session.id)}>
            <strong>{formatDate(session.startedAt)}</strong>
            <span className="muted">
              {session.routineName} · {done} of {session.entries.length} done
            </span>
          </button>
        );
      })}
    </main>
  );
}

function SessionDetail({ session, onBack }: { session: Session; onBack: () => void }) {
  const core = useCore();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { error, run } = useAction();
  const locked = !core.canEditHistory();

  async function remove() {
    if (await run(() => core.deleteSession(session.id))) onBack();
  }

  return (
    <main className="screen">
      <header className="row header">
        <button className="secondary" onClick={onBack}>
          ← History
        </button>
        <span className="grow muted center">
          {formatDate(session.startedAt)} · {session.routineName}
        </span>
      </header>

      {locked ? (
        <p className="muted">A session is running. You can correct or delete past sessions once it has ended.</p>
      ) : (
        <p className="muted">Tap a set to correct it.</p>
      )}

      <ol className="stack routine-list">
        {session.entries.map((entry) => (
          <li key={entry.id}>
            <EntryDetail sessionId={session.id} entry={entry} locked={locked} />
          </li>
        ))}
      </ol>

      {error && <p className="error">{error}</p>}

      {!locked &&
        (confirmingDelete ? (
          <section className="card">
            <p>
              Delete this session? Its sets are removed from your history. Exercises whose latest result was in it go
              back to the weight they had before.
            </p>
            <div className="row">
              <button className="secondary" onClick={() => setConfirmingDelete(false)}>
                Keep it
              </button>
              <button className="primary" onClick={remove}>
                Delete session
              </button>
            </div>
          </section>
        ) : (
          <button className="secondary wide" onClick={() => setConfirmingDelete(true)}>
            Delete session
          </button>
        ))}
    </main>
  );
}

/** One exercise of a past session: its state, weight and every set, each tappable to correct. */
function EntryDetail({ sessionId, entry, locked }: { sessionId: string; entry: SessionEntry; locked: boolean }) {
  const core = useCore();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const weighted = entry.sessionWeight !== undefined;
  const recalculates = core.editRecalculatesWeight(sessionId, entry.id);
  const currentWeight = core.getExercise(entry.exerciseId).weight;

  return (
    <section className="card stack">
      <strong>{entry.exerciseName}</strong>
      <span className="muted">
        {STATE_LABELS[entry.state]} · {formatEntryWeight(entry)}
      </span>
      {entry.loggedSets.length > 0 && (
        <ol className="stack routine-list">
          {entry.loggedSets.map((set, index) =>
            editingIndex === index ? (
              <li key={index} className="stack">
                <SetForm
                  label={`Set ${index + 1}`}
                  submitLabel="Save"
                  weighted={weighted}
                  initialReps={String(set.reps)}
                  initialWeight={set.weight}
                  onSubmit={async (reps, weight) => {
                    await core.editPastSet(sessionId, entry.id, index, { reps, weight });
                    setEditingIndex(null);
                  }}
                  onCancel={() => setEditingIndex(null)}
                />
                {recalculates && currentWeight !== undefined && (
                  <p className="muted">
                    This is {entry.exerciseName}'s latest result, so saving works out its current weight (now{" "}
                    {formatKg(currentWeight)}) again.
                  </p>
                )}
              </li>
            ) : (
              <li key={index} className="row logged-set">
                <button className="grow list-item set-button" disabled={locked} onClick={() => setEditingIndex(index)}>
                  Set {index + 1}: {formatSet(set)}
                </button>
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}
