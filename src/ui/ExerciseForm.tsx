import { type FormEvent, useState } from "react";
import {
  DEFAULT_INCREMENT,
  DEFAULT_REP_MAX,
  DEFAULT_REP_MIN,
  DEFAULT_SETS,
  type Exercise,
  type ExerciseInput,
  type ExerciseType,
  EXERCISE_TYPES,
  EXERCISE_TYPE_LABELS,
  isWeighted,
} from "../core";
import { parseNumber } from "./format";
import { useAction } from "./useAction";

interface Props {
  initial?: Exercise;
  submitLabel: string;
  onSubmit: (input: ExerciseInput) => Promise<unknown>;
  onCancel?: () => void;
}

export function ExerciseForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ExerciseType>(initial?.type ?? "machine");
  const [weight, setWeight] = useState(String(initial?.weight ?? ""));
  const [increment, setIncrement] = useState(String(initial?.increment ?? DEFAULT_INCREMENT));
  const [sets, setSets] = useState(String(initial?.sets ?? DEFAULT_SETS));
  const [repMin, setRepMin] = useState(String(initial?.repMin ?? DEFAULT_REP_MIN));
  const [repMax, setRepMax] = useState(String(initial?.repMax ?? DEFAULT_REP_MAX));
  const { error, run } = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input: ExerciseInput = {
      name,
      type,
      sets: parseNumber(sets),
      repMin: parseNumber(repMin),
      repMax: parseNumber(repMax),
    };
    if (isWeighted(type)) {
      input.weight = weight.trim() === "" ? 0 : parseNumber(weight);
      input.increment = parseNumber(increment);
    }
    const ok = await run(() => onSubmit(input));
    if (ok && !initial) {
      setName("");
      setWeight("");
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Leg press" />
      </label>

      <div className="segmented" role="radiogroup" aria-label="Type">
        {EXERCISE_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            className={type === t ? "selected" : ""}
            onClick={() => setType(t)}
          >
            {EXERCISE_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {isWeighted(type) && (
        <div className="row">
          <label>
            Weight (kg)
            <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" />
          </label>
          <label>
            Increment (kg)
            <input inputMode="decimal" value={increment} onChange={(e) => setIncrement(e.target.value)} />
          </label>
        </div>
      )}

      <div className="row">
        <label>
          Sets
          <input inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
        </label>
        <label>
          Min reps
          <input inputMode="numeric" value={repMin} onChange={(e) => setRepMin(e.target.value)} />
        </label>
        <label>
          Max reps
          <input inputMode="numeric" value={repMax} onChange={(e) => setRepMax(e.target.value)} />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="row">
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
