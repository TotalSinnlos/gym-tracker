import { type FormEvent, type ReactNode, useState } from "react";
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
import { Icon } from "./icons";
import { useAction } from "./useAction";

interface Props {
  /** The exercise being edited. Without it, the form adds a new one and clears itself after each. */
  initial?: Exercise;
  onSubmit: (input: ExerciseInput) => Promise<unknown>;
  /** Editing: Cancel and Save sit at the bottom of the screen. */
  onCancel?: () => void;
  /** Shown between the fields and the buttons (archive and delete, when editing). */
  children?: ReactNode;
}

/** An exercise's name, type, weight, weight step, sets and rep range. */
export function ExerciseForm({ initial, onSubmit, onCancel, children }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ExerciseType>(initial?.type ?? "machine");
  const [weight, setWeight] = useState(String(initial?.weight ?? ""));
  const [increment, setIncrement] = useState(String(initial?.increment ?? DEFAULT_INCREMENT));
  const [sets, setSets] = useState(String(initial?.sets ?? DEFAULT_SETS));
  const [repMin, setRepMin] = useState(String(initial?.repMin ?? DEFAULT_REP_MIN));
  const [repMax, setRepMax] = useState(String(initial?.repMax ?? DEFAULT_REP_MAX));
  const { error, run } = useAction();
  const adding = !onCancel;

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
    if (ok && adding) {
      setName("");
      setWeight("");
    }
  }

  const fields = (
    <>
      <label className="fld">
        Name
        <input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Leg press" />
      </label>

      <div className="fld">
        Type
        <div className="seg" role="radiogroup" aria-label="Type">
          {EXERCISE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              className={type === t ? "on" : undefined}
              onClick={() => setType(t)}
            >
              {EXERCISE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {isWeighted(type) && (
        <div className="g2">
          <label className="fld">
            Weight (kg)
            <input
              className="in"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0"
            />
          </label>
          <label className="fld">
            Weight step (kg)
            <input className="in" inputMode="decimal" value={increment} onChange={(e) => setIncrement(e.target.value)} />
          </label>
        </div>
      )}

      <div className="g3">
        <label className="fld">
          Sets
          <input className="in" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
        </label>
        <label className="fld">
          Min reps
          <input className="in" inputMode="numeric" value={repMin} onChange={(e) => setRepMin(e.target.value)} />
        </label>
        <label className="fld">
          Max reps
          <input className="in" inputMode="numeric" value={repMax} onChange={(e) => setRepMax(e.target.value)} />
        </label>
      </div>

      {error && (
        <p className="errmsg" role="alert">
          <Icon name="error" />
          {error}
        </p>
      )}
    </>
  );

  if (adding) {
    return (
      <form className="card form-card" onSubmit={submit}>
        {fields}
        <button type="submit" className="btn dark w">
          <Icon name="plus" />
          Add exercise
        </button>
      </form>
    );
  }

  return (
    <form className="form-page" onSubmit={submit}>
      {fields}
      {children}
      <div className="dock push-down">
        <div className="g2">
          <button type="button" className="btn lg out" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn lg pri">
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
