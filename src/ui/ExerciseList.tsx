import { EXERCISE_TYPE_LABELS, type Exercise, isWeighted } from "../core";
import { useCore } from "./CoreContext";
import { useExerciseActions } from "./ExerciseActions";
import { ExerciseForm } from "./ExerciseForm";
import { formatKg } from "./format";
import { Icon } from "./icons";

export function describeExercise(exercise: Exercise) {
  const reps = `${exercise.sets} × ${exercise.repMin}–${exercise.repMax}`;
  if (!isWeighted(exercise.type)) return `${EXERCISE_TYPE_LABELS[exercise.type]} · ${reps}`;
  return `${EXERCISE_TYPE_LABELS[exercise.type]} · ${formatKg(exercise.weight!)} (+${exercise.increment}) · ${reps}`;
}

/** All active exercises; tapping one opens it for editing (`onEdit`). `icon` is the hint at the end of each row. */
export function ExerciseList({ onEdit, icon = "next" }: { onEdit: (id: string) => void; icon?: "next" | "edit" }) {
  const core = useCore();
  const exercises = core.listExercises();
  if (exercises.length === 0) return <div className="empty">Nothing added yet.</div>;
  return (
    <div className="list">
      {exercises.map((exercise) => (
        <button key={exercise.id} className="li" onClick={() => onEdit(exercise.id)}>
          <span className="li-m">
            <span className="li-t">{exercise.name}</span>
            <span className="li-s">{describeExercise(exercise)}</span>
          </span>
          <span className="chev">
            <Icon name={icon} />
          </span>
        </button>
      ))}
    </div>
  );
}

/** A full screen to edit an exercise (with archive and delete), or to add one when `exerciseId` is null. */
export function ExerciseEditor({ exerciseId, onClose }: { exerciseId: string | null; onClose: () => void }) {
  const core = useCore();
  return (
    <main className="screen">
      <div className="top">
        <button className="ib" aria-label="Back" onClick={onClose}>
          <Icon name="back" />
        </button>
      </div>
      {exerciseId ? (
        <EditExercise exerciseId={exerciseId} onClose={onClose} />
      ) : (
        <>
          <h1 className="page-t">Add an exercise</h1>
          <ExerciseForm
            onSubmit={async (input) => {
              await core.createExercise(input);
              onClose();
            }}
          />
        </>
      )}
    </main>
  );
}

function EditExercise({ exerciseId, onClose }: { exerciseId: string; onClose: () => void }) {
  const core = useCore();
  // Gone for a moment after "Delete", before the editor closes.
  const exercise = core.getData().exercises.find((e) => e.id === exerciseId);
  return exercise ? <EditForm exercise={exercise} onClose={onClose} /> : null;
}

function EditForm({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const core = useCore();
  const actions = useExerciseActions(exercise, onClose);
  return (
    <>
      <h1 className="page-t">Edit {exercise.name}</h1>
      <ExerciseForm
        initial={exercise}
        onSubmit={async (input) => {
          await core.updateExercise(exercise.id, input);
          onClose();
        }}
        onCancel={onClose}
      >
        <div className="form-actions">
          <button type="button" className="btn out w" onClick={() => actions.ask("archive")}>
            <Icon name="archive" />
            Archive
          </button>
          {actions.canDelete ? (
            <button type="button" className="btn dngo w" onClick={() => actions.ask("delete")}>
              <Icon name="trash" />
              Delete
            </button>
          ) : (
            <p className="hint">This exercise has history, so it can be archived but not deleted.</p>
          )}
        </div>
      </ExerciseForm>
      {actions.dialog}
    </>
  );
}
