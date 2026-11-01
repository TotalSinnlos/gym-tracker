import { type FormEvent, useState } from "react";
import { useCore } from "./CoreContext";
import { Icon } from "./icons";
import { useAction } from "./useAction";

/** Settings' "Trainer": turn the AI trainer on or off, and tell it about yourself. */
export function TrainerSection() {
  const core = useCore();
  const { error, run } = useAction();
  const trainer = core.trainer();

  return (
    <>
      <div className="h2">Trainer</div>
      {!trainer.available ? (
        <div className="list">
          <div className="li">
            <span className="li-m">
              <span className="li-t">AI trainer</span>
              <span className="li-s">Needs server backup</span>
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="list">
            <label className="li">
              <span className="li-m">
                <span className="li-t">Summary after each session</span>
              </span>
              <input
                type="checkbox"
                className="switch"
                checked={trainer.enabled}
                onChange={(e) => run(() => core.setTrainerEnabled(e.target.checked))}
              />
            </label>
          </div>
          <GoalsForm key={trainer.goals} saved={trainer.goals} onSave={(goals) => run(() => core.setTrainerGoals(goals))} />
          <p className="hint">
            Your training, these notes and your chat messages are sent to Google Gemini.
          </p>
        </>
      )}
      {error && (
        <p className="errmsg section-msg" role="alert">
          <Icon name="error" />
          {error}
        </p>
      )}
    </>
  );
}

/** The "Goals and notes" box. Save appears once something has changed. */
function GoalsForm({ saved, onSave }: { saved: string; onSave: (goals: string) => Promise<boolean> }) {
  const [goals, setGoals] = useState(saved);
  const changed = goals.trim() !== saved;

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave(goals);
  }

  return (
    <form className="card form-card section-msg" onSubmit={submit}>
      <label className="fld">
        Goals and notes for the trainer
        <textarea
          className="in area"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder="e.g. build muscle, sore left shoulder"
          rows={3}
        />
      </label>
      {changed && (
        <button type="submit" className="btn out">
          Save
        </button>
      )}
    </form>
  );
}
