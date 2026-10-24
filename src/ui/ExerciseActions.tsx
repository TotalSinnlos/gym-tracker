import { useState } from "react";
import { useCore } from "./CoreContext";
import { describeExercise } from "./ExerciseList";
import { useAction } from "./useAction";

/**
 * Archive and delete buttons for an exercise being edited, each asking for confirmation.
 * Delete is only offered when the exercise has no history.
 */
export function ExerciseActions({ exerciseId, onDone }: { exerciseId: string; onDone: () => void }) {
  const core = useCore();
  const exercise = core.getExercise(exerciseId);
  const canDelete = !core.hasHistory(exerciseId);
  const routineNames = core.routinesWithExercise(exerciseId).map((r) => r.name);
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null);
  const { error, run } = useAction();

  async function confirm() {
    const action = confirming === "archive" ? core.archiveExercise : core.deleteExercise;
    if (await run(() => action(exerciseId))) onDone();
  }

  if (confirming) {
    const inRoutines = routineNames.length > 0 ? ` It will be taken out of: ${routineNames.join(", ")}.` : "";
    return (
      <div className="card stack">
        <p>
          {confirming === "archive"
            ? `Archive ${exercise.name}? It's hidden from your lists and its history is kept.${inRoutines}`
            : `Delete ${exercise.name} for good?${inRoutines}`}
        </p>
        <div className="row">
          <button className="secondary" onClick={() => setConfirming(null)}>
            Cancel
          </button>
          <button className="primary" onClick={confirm}>
            {confirming === "archive" ? "Archive" : "Delete"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row">
        <button className="secondary" onClick={() => setConfirming("archive")}>
          Archive
        </button>
        {canDelete && (
          <button className="secondary" onClick={() => setConfirming("delete")}>
            Delete
          </button>
        )}
      </div>
      {!canDelete && <p className="muted">This exercise has history, so it can be archived but not deleted.</p>}
    </div>
  );
}

/** Archived exercises, each with a button to bring it back. */
export function ArchivedExercises() {
  const core = useCore();
  const archived = core.listArchivedExercises();
  const { error, run } = useAction();

  if (archived.length === 0) return <p className="muted">No archived exercises.</p>;
  return (
    <div className="stack">
      {archived.map((exercise) => (
        <div key={exercise.id} className="card routine-item">
          <span className="grow">
            <strong>{exercise.name}</strong>
            <span className="muted">{describeExercise(exercise)}</span>
          </span>
          <button className="secondary" onClick={() => run(() => core.unarchiveExercise(exercise.id))}>
            Unarchive
          </button>
        </div>
      ))}
      <p className="muted">Unarchived exercises come back without a routine; add them to one above.</p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
