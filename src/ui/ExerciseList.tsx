import { useState } from "react";
import { type Exercise, isWeighted } from "../core";
import { useCore } from "./CoreContext";
import { ExerciseForm, TYPE_LABELS } from "./ExerciseForm";

export function describeExercise(exercise: Exercise) {
  const load = isWeighted(exercise.type) ? `${exercise.weight} kg (+${exercise.increment})` : "Bodyweight";
  return `${TYPE_LABELS[exercise.type]} · ${load} · ${exercise.sets} × ${exercise.repMin}–${exercise.repMax}`;
}

/** All exercises, each tappable to edit, plus a form to add new ones. */
export function ExerciseList() {
  const core = useCore();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="stack">
      {core.listExercises().map((exercise) =>
        editingId === exercise.id ? (
          <ExerciseForm
            key={exercise.id}
            initial={exercise}
            submitLabel="Save"
            onSubmit={async (input) => {
              await core.updateExercise(exercise.id, input);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
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
