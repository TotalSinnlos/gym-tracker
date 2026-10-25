import { type FormEvent, useState } from "react";
import { useCore } from "./CoreContext";
import { formatExerciseNames } from "./format";
import { Icon } from "./icons";
import { RoutineEditor } from "./RoutineEditor";
import { useAction } from "./useAction";

/** All routines, each opening into its editor (`onOpen`), plus a field to add a new one. */
export function RoutineList({ onOpen }: { onOpen: (routineId: string) => void }) {
  const core = useCore();
  const routines = core.listRoutines();
  const [newName, setNewName] = useState("");
  const { error, run } = useAction();

  async function create(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const routine = await core.createRoutine(newName);
      setNewName("");
      onOpen(routine.id);
    });
  }

  return (
    <>
      {routines.map((routine) => (
        <button key={routine.id} className="rc rc-row" onClick={() => onOpen(routine.id)}>
          <span className="rc-body">
            <b>{routine.name}</b>
            <span className="x">
              {routine.exerciseIds.length === 0 ? "No exercises yet" : formatExerciseNames(core.routineExercises(routine.id))}
            </span>
          </span>
          <span className="chev">
            <Icon name="next" />
          </span>
        </button>
      ))}
      <form className="new-routine" onSubmit={create}>
        <label className="new-routine-field">
          <span className="visually-hidden">New routine name</span>
          <input className="in" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New routine name" />
        </label>
        <button type="submit" className="btn dark">
          <Icon name="plus" />
          New routine
        </button>
      </form>
      {error && (
        <p className="errmsg section-msg">
          <Icon name="error" />
          {error}
        </p>
      )}
    </>
  );
}

/** A routine's editor as its own screen, with "Delete routine" (confirmed in a dialog). */
export function RoutineScreen({ routineId, onClose }: { routineId: string; onClose: () => void }) {
  const core = useCore();
  const [confirming, setConfirming] = useState(false);
  const { error, run } = useAction();
  // Gone for a moment after "Delete routine", before the screen closes.
  const exists = core.listRoutines().some((r) => r.id === routineId);
  if (!exists) return null;
  const problem = core.routineDeleteProblem(routineId);

  async function remove() {
    if (await run(() => core.deleteRoutine(routineId))) onClose();
  }

  return (
    <main className="screen">
      <div className="top">
        <button className="ib" aria-label="Back to settings" onClick={onClose}>
          <Icon name="back" />
        </button>
      </div>
      <div className="page">
        <h1 className="page-t flush">Edit routine</h1>
        <div>
          <RoutineEditor routineId={routineId} />
          <p className="hint">Changes apply from the next session.</p>
        </div>
        <div>
          <button className="btn dngo w" disabled={problem !== null} onClick={() => setConfirming(true)}>
            <Icon name="trash" />
            Delete routine
          </button>
          {problem && <p className="hint">{problem}, so it can't be deleted.</p>}
        </div>
      </div>
      {confirming && (
        <>
          <div className="scrim" onClick={() => setConfirming(false)} />
          <div className="dlg" role="alertdialog" aria-labelledby="routine-delete-title">
            <div className="dlg-t" id="routine-delete-title">
              Delete this routine?
            </div>
            <div className="dlg-b">Your exercises and past sessions are kept.</div>
            {error && <p className="errmsg">{error}</p>}
            <button className="btn lg out" onClick={() => setConfirming(false)}>
              Keep it
            </button>
            <button className="btn lg dng" onClick={remove}>
              Delete routine
            </button>
          </div>
        </>
      )}
    </main>
  );
}
