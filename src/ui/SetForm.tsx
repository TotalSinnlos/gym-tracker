import { type FormEvent, type ReactNode, useState } from "react";
import { parseNumber } from "./format";
import { Icon } from "./icons";
import { useAction } from "./useAction";

interface SetFormProps {
  /** Shown above the fields when correcting a set, e.g. "Correct set 1". */
  title?: string;
  submitLabel: string;
  weighted: boolean;
  initialReps: string;
  initialWeight?: number;
  autoFocus?: boolean;
  onSubmit: (reps: number, weight: number | undefined) => Promise<unknown>;
  onCancel?: () => void;
  /** An explanation above the buttons, e.g. that saving works out the current weight again. */
  note?: ReactNode;
}

/**
 * Reps (and weight, for weighted exercises) of one set, in the white sheet at the bottom of the screen:
 * logging a new set, or correcting one.
 */
export function SetForm({ title, submitLabel, weighted, initialReps, initialWeight, autoFocus, onSubmit, onCancel, note }: SetFormProps) {
  const [reps, setReps] = useState(initialReps);
  const [weight, setWeight] = useState(initialWeight === undefined ? "" : String(initialWeight));
  const { error, run } = useAction();
  // The core's messages name the field they're about ("Reps must…", "Weight can't…").
  const badField = error === null ? null : error.startsWith("Weight") ? "weight" : "reps";

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => onSubmit(parseNumber(reps), weighted ? parseNumber(weight) : undefined));
  }

  const submitButton = (
    <button type="submit" className="btn lg pri" disabled={reps.trim() === ""}>
      {submitLabel}
    </button>
  );

  return (
    <form className="dock sheet" onSubmit={submit}>
      {title && <div className="sh-t">{title}</div>}
      <div className={weighted ? "g2" : undefined}>
        <label className={badField === "reps" ? "fld bad" : "fld"}>
          Reps
          <input
            inputMode="numeric"
            className={badField === "reps" ? "in big bad" : "in big"}
            placeholder="0"
            value={reps}
            autoFocus={autoFocus}
            aria-invalid={badField === "reps" || undefined}
            onChange={(e) => setReps(e.target.value)}
          />
        </label>
        {weighted && (
          <label className={badField === "weight" ? "fld bad" : "fld"}>
            Weight (kg)
            <input
              inputMode="decimal"
              // Prefilled with the session weight, which usually stays as it is.
              className={badField === "weight" ? "in big bad" : onCancel ? "in big" : "in big pre"}
              value={weight}
              aria-invalid={badField === "weight" || undefined}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
        )}
      </div>
      {error && (
        <p className="errmsg" role="alert">
          <Icon name="error" />
          {error}
        </p>
      )}
      {note && (
        <div className="note">
          <Icon name="info" />
          <span>{note}</span>
        </div>
      )}
      {onCancel ? (
        <div className="g2">
          <button type="button" className="btn lg out" onClick={onCancel}>
            Cancel
          </button>
          {submitButton}
        </div>
      ) : (
        submitButton
      )}
    </form>
  );
}
