import { useState } from "react";
import type { Exercise } from "../core";
import { useCore } from "./CoreContext";
import { describeExercise } from "./ExerciseList";
import { Icon } from "./icons";
import { useAction } from "./useAction";

/**
 * Archiving and deleting an exercise, each confirmed in a dialog. Delete is only possible when the
 * exercise has no history. `ask` opens a dialog; render `dialog` somewhere on the screen.
 */
export function useExerciseActions(exercise: Exercise, onDone: () => void) {
  const core = useCore();
  const exerciseId = exercise.id;
  const canDelete = !core.hasHistory(exerciseId);
  const routineNames = core.routinesWithExercise(exerciseId).map((r) => r.name);
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null);
  const { error, run } = useAction();

  async function confirm() {
    const action = confirming === "archive" ? core.archiveExercise : core.deleteExercise;
    if (await run(() => action(exerciseId))) onDone();
  }

  const dialog = confirming && (
    <>
      <div className="scrim" onClick={() => setConfirming(null)} />
      <div className="dlg" role="alertdialog" aria-labelledby="exercise-action-title">
        <div className="dlg-t" id="exercise-action-title">
          {confirming === "archive" ? `Archive ${exercise.name}?` : `Delete ${exercise.name} for good?`}
        </div>
        {(confirming === "archive" || routineNames.length > 0) && (
          <div className="body mut">
            {confirming === "archive" && "It's hidden and its history is kept. "}
            {routineNames.length > 0 && "It will be taken out of these routines:"}
          </div>
        )}
        {routineNames.length > 0 && (
          <div className="chips">
            {routineNames.map((name, i) => (
              <span key={i}>{name}</span>
            ))}
          </div>
        )}
        {error && <p className="errmsg">{error}</p>}
        <div className="dlg-gap" />
        <button className="btn lg out" onClick={() => setConfirming(null)}>
          Keep it
        </button>
        <button className={confirming === "archive" ? "btn lg dark" : "btn lg dng"} onClick={confirm}>
          {confirming === "archive" ? "Archive" : "Delete"}
        </button>
      </div>
    </>
  );

  return { canDelete, ask: setConfirming, dialog };
}

/** Archived exercises, each with a button to bring it back. */
export function ArchivedExercises() {
  const core = useCore();
  const archived = core.listArchivedExercises();
  const { error, run } = useAction();

  if (archived.length === 0) return <div className="empty">No archived exercises.</div>;
  return (
    <>
      <div className="list">
        {archived.map((exercise) => (
          <div key={exercise.id} className="li">
            <span className="li-m">
              <span className="li-t">{exercise.name}</span>
              <span className="li-s">{describeExercise(exercise)}</span>
            </span>
            <button className="btn sm out" onClick={() => run(() => core.unarchiveExercise(exercise.id))}>
              Unarchive
            </button>
          </div>
        ))}
      </div>
      <p className="hint">Unarchived exercises come back without a routine; add them to one above.</p>
      {error && (
        <p className="errmsg section-msg">
          <Icon name="error" />
          {error}
        </p>
      )}
    </>
  );
}
