import { type FormEvent, useState } from "react";
import { parseNumber } from "./format";
import { useAction } from "./useAction";

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

/** Reps (and weight, for weighted exercises) of one set: logging a new one, or correcting one. */
export function SetForm({ label, submitLabel, weighted, initialReps, initialWeight, autoFocus, onSubmit, onCancel }: SetFormProps) {
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
