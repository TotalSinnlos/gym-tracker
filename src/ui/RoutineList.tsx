import { type FormEvent, useState } from "react";
import { useCore } from "./CoreContext";
import { formatExerciseNames } from "./format";
import { RoutineEditor } from "./RoutineEditor";
import { useAction } from "./useAction";

/** All routines, each opening into its editor, plus a form to add a new one. */
export function RoutineList() {
  const core = useCore();
  const routines = core.listRoutines();
  const [openId, setOpenId] = useState<string | null>(routines.length === 1 ? routines[0].id : null);
  const [newName, setNewName] = useState("");
  const { error, run } = useAction();

  async function create(event: FormEvent) {
    event.preventDefault();
    const ok = await run(async () => {
      const routine = await core.createRoutine(newName);
      setOpenId(routine.id);
    });
    if (ok) setNewName("");
  }

  return (
    <div className="stack">
      {routines.map((routine) =>
        openId === routine.id ? (
          <div key={routine.id} className="stack open-routine">
            <RoutineEditor routineId={routine.id} />
            <RoutineActions routineId={routine.id} onClose={() => setOpenId(null)} />
          </div>
        ) : (
          <button key={routine.id} className="card list-item" onClick={() => setOpenId(routine.id)}>
            <strong>{routine.name}</strong>
            <span className="muted">
              {routine.exerciseIds.length === 0 ? "No exercises yet" : formatExerciseNames(core.routineExercises(routine.id))}
            </span>
          </button>
        ),
      )}

      <form className="row" onSubmit={create}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Legs" />
        <button type="submit" className="secondary">
          New routine
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

/** Delete (with confirmation) and close buttons under an open routine. */
function RoutineActions({ routineId, onClose }: { routineId: string; onClose: () => void }) {
  const core = useCore();
  const [confirming, setConfirming] = useState(false);
  const { error, run } = useAction();
  const problem = core.routineDeleteProblem(routineId);

  async function remove() {
    if (await run(() => core.deleteRoutine(routineId))) onClose();
  }

  if (confirming) {
    return (
      <div className="stack">
        <p>Delete this routine? Your exercises and past sessions are kept.</p>
        <div className="row">
          <button className="secondary" onClick={() => setConfirming(false)}>
            Keep it
          </button>
          <button className="primary" onClick={remove}>
            Delete routine
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="stack">
      {problem && <p className="muted">{problem}, so it can't be deleted.</p>}
      <div className="row">
        <button className="secondary" disabled={problem !== null} onClick={() => setConfirming(true)}>
          Delete
        </button>
        <button className="secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
