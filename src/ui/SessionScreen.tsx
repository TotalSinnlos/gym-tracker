import { type FormEvent, useState } from "react";
import type { EndSessionResult, SessionEntry } from "../core";
import { useCore } from "./CoreContext";
import { formatKg, formatReps, formatSet, parseNumber } from "./format";
import { useAction } from "./useAction";

interface Props {
  onLeave: () => void;
  onEnded: (result: EndSessionResult) => void;
}

export function SessionScreen({ onLeave, onEnded }: Props) {
  const core = useCore();
  const session = core.activeSession();
  const current = core.currentEntry();
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const { error, run } = useAction();

  if (!session) return null;
  const pending = core.pendingCount();
  const upNext = core.upNext();
  const finished = session.entries.filter((e) => e.state === "done" && e.exerciseId !== current?.exerciseId);

  async function end() {
    let result: EndSessionResult | undefined;
    if (await run(async () => (result = await core.endSession()))) onEnded(result!);
  }

  return (
    <main className="screen">
      <header className="row header">
        <button className="secondary" onClick={onLeave}>
          ← Home
        </button>
        <span className="grow muted center">
          {session.routineName} · {session.entries.length - pending} of {session.entries.length} done
        </span>
      </header>

      {current ? (
        <CurrentExercise key={current.exerciseId} entry={current} />
      ) : (
        <section className="card center">
          <h2>All exercises done!</h2>
          <p className="muted">Correct anything below, or end the session.</p>
        </section>
      )}

      {core.canSkip() && (
        <button className="secondary wide" onClick={() => run(() => core.skipCurrent())}>
          Skip for now
        </button>
      )}

      {upNext.length > 0 && (
        <section className="stack">
          <h3>Up next</h3>
          {upNext.map((entry) => (
            <button
              key={entry.exerciseId}
              className="card list-item"
              onClick={() => run(() => core.goToExercise(entry.exerciseId))}
            >
              <strong>{entry.exerciseName}</strong>
              <span className="muted">
                {entry.loggedSets.length > 0
                  ? `${entry.loggedSets.length} of ${entry.sets} sets logged · tap to continue`
                  : "Tap to do this now"}
              </span>
            </button>
          ))}
        </section>
      )}

      {finished.length > 0 && (
        <section className="stack">
          <h3>Finished</h3>
          {finished.map((entry) => (
            <button
              key={entry.exerciseId}
              className="card list-item"
              onClick={() => run(() => core.goToExercise(entry.exerciseId))}
            >
              <strong>✓ {entry.exerciseName}</strong>
              <span className="muted">{formatReps(entry)} reps · tap to correct</span>
            </button>
          ))}
        </section>
      )}

      {error && <p className="error">{error}</p>}

      {confirmingEnd ? (
        <section className="card">
          <p>
            {pending} {pending === 1 ? "exercise" : "exercises"} not done. End anyway?
          </p>
          <div className="row">
            <button className="secondary" onClick={() => setConfirmingEnd(false)}>
              Keep going
            </button>
            <button className="primary" onClick={end}>
              End session
            </button>
          </div>
        </section>
      ) : (
        <button
          className={current ? "secondary wide" : "primary wide"}
          onClick={() => (pending > 0 ? setConfirmingEnd(true) : end())}
        >
          End session
        </button>
      )}
    </main>
  );
}

function CurrentExercise({ entry }: { entry: SessionEntry }) {
  const core = useCore();
  const weighted = entry.sessionWeight !== undefined;
  const increment = core.getExercise(entry.exerciseId).increment ?? 2.5;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { error, run } = useAction();

  const nextSetNumber = entry.loggedSets.length + 1;
  const setLabel = nextSetNumber > entry.sets ? "Extra set" : `Set ${nextSetNumber} of ${entry.sets}`;

  return (
    <section className="card stack current">
      <h2>{entry.exerciseName}</h2>
      <p className="muted">
        Target: {entry.sets} × {entry.repMin}–{entry.repMax} reps
      </p>

      {weighted && (
        <WeightStepper
          key={entry.sessionWeight}
          weight={entry.sessionWeight!}
          step={increment}
          onChange={(weight) => run(() => core.setSessionWeight(entry.exerciseId, weight))}
        />
      )}

      {entry.loggedSets.length > 0 && (
        <ol className="stack routine-list">
          {entry.loggedSets.map((set, index) =>
            editingIndex === index ? (
              <li key={index}>
                <SetForm
                  label={`Set ${index + 1}`}
                  submitLabel="Save"
                  weighted={weighted}
                  initialReps={String(set.reps)}
                  initialWeight={set.weight}
                  onSubmit={async (reps, weight) => {
                    await core.editSet(entry.exerciseId, index, { reps, weight });
                    setEditingIndex(null);
                  }}
                  onCancel={() => setEditingIndex(null)}
                />
              </li>
            ) : (
              <li key={index} className="row logged-set">
                <button className="grow list-item set-button" onClick={() => setEditingIndex(index)}>
                  Set {index + 1}: {formatSet(set)}
                </button>
                <button
                  className="icon"
                  aria-label={`Remove set ${index + 1}`}
                  onClick={() => run(() => core.removeSet(entry.exerciseId, index))}
                >
                  ✕
                </button>
              </li>
            ),
          )}
        </ol>
      )}

      {editingIndex === null && (
        <SetForm
          // Re-created after each set and whenever the session weight changes, so the weight field follows it.
          key={`${entry.loggedSets.length}-${entry.sessionWeight}`}
          label={setLabel}
          submitLabel="Log set"
          weighted={weighted}
          initialReps=""
          initialWeight={entry.sessionWeight}
          autoFocus
          onSubmit={(reps, weight) => core.logSet(entry.exerciseId, { reps, weight })}
        />
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}

function WeightStepper({ weight, step, onChange }: { weight: number; step: number; onChange: (kg: number) => void }) {
  const [text, setText] = useState(String(weight));

  function commit(value: number) {
    if (Number.isFinite(value) && value !== weight) onChange(value);
    else setText(String(weight));
  }

  return (
    <div className="row stepper">
      <button className="icon" aria-label="Less weight" disabled={weight - step < 0} onClick={() => onChange(weight - step)}>
        −
      </button>
      <label className="grow">
        Weight (kg)
        <input
          inputMode="decimal"
          className="big"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit(parseNumber(text))}
        />
      </label>
      <button className="icon" aria-label="More weight" onClick={() => onChange(weight + step)}>
        +
      </button>
    </div>
  );
}

interface SetFormProps {
  label: string;
  submitLabel: string;
  weighted: boolean;
  initialReps: string;
  initialWeight?: number;
  autoFocus?: boolean;
  onSubmit: (reps: number, weight: number | undefined) => Promise<unknown>;
  onCancel?: () => void;
}

function SetForm({ label, submitLabel, weighted, initialReps, initialWeight, autoFocus, onSubmit, onCancel }: SetFormProps) {
  const [reps, setReps] = useState(initialReps);
  const [weight, setWeight] = useState(initialWeight === undefined ? "" : String(initialWeight));
  const { error, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => onSubmit(parseNumber(reps), weighted ? parseNumber(weight) : undefined));
  }

  return (
    <form className="stack set-form" onSubmit={submit}>
      <div className="row">
        <label>
          {label}: reps
          <input
            inputMode="numeric"
            className="big"
            value={reps}
            autoFocus={autoFocus}
            onChange={(e) => setReps(e.target.value)}
          />
        </label>
        {weighted && (
          <label>
            at (kg)
            <input inputMode="decimal" className="big" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="primary" disabled={reps.trim() === ""}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function formatEntryWeight(entry: SessionEntry) {
  return entry.sessionWeight === undefined ? "Bodyweight" : formatKg(entry.sessionWeight);
}
