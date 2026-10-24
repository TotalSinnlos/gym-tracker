import { useState } from "react";
import { EXERCISE_TYPE_LABELS, type Exercise, isWeighted } from "../core";
import { useCore } from "./CoreContext";
import { ExerciseActions } from "./ExerciseActions";
import { ExerciseForm } from "./ExerciseForm";
import { formatKg } from "./format";

export function describeExercise(exercise: Exercise) {
  const reps = `${exercise.sets} × ${exercise.repMin}–${exercise.repMax}`;
  if (!isWeighted(exercise.type)) return `${EXERCISE_TYPE_LABELS[exercise.type]} · ${reps}`;
  return `${EXERCISE_TYPE_LABELS[exercise.type]} · ${formatKg(exercise.weight!)} (+${exercise.increment}) · ${reps}`;
}

/** All exercises, each tappable to edit, plus a form to add new ones. */
export function ExerciseList() {
  const core = useCore();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="stack">
      {core.listExercises().map((exercise) =>
        editingId === exercise.id ? (
          <div key={exercise.id} className="stack">
            <ExerciseForm
              initial={exercise}
              submitLabel="Save"
              onSubmit={async (input) => {
                await core.updateExercise(exercise.id, input);
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
            <ExerciseActions exerciseId={exercise.id} onDone={() => setEditingId(null)} />
          </div>
        ) : (
          <button key={exercise.id} className="card list-item" onClick={() => setEditingId(exercise.id)}>
            <strong>{exercise.name}</strong>
            <span className="muted">{describeExercise(exercise)}</span>
          </button>
        ),
      )}
      <h3>Add an exercise</h3>
      <ExerciseForm submitLabel="Add exercise" onSubmit={(input) => core.createExercise(input)} />
    </div>
  );
}
