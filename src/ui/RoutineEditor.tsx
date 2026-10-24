import { useState } from "react";
import { useCore } from "./CoreContext";
import { describeExercise } from "./ExerciseList";
import { useAction } from "./useAction";

/** Rename a routine, put its exercises in order, and add or remove exercises. */
export function RoutineEditor({ routineId }: { routineId: string }) {
  const core = useCore();
  const routine = core.getRoutine(routineId);
  const exercises = core.routineExercises(routineId);
  const available = core.listExercises();
  const [name, setName] = useState(routine.name);
  const { error, run } = useAction();

  return (
    <div className="stack">
      <label>
        Routine name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== routine.name && run(() => core.renameRoutine(routineId, name))}
        />
      </label>

      {exercises.length === 0 && <p className="muted">No exercises yet. Add some from the list below.</p>}
      <ol className="stack routine-list">
        {exercises.map((exercise, index) => (
          // The same exercise can appear twice, so its position is the key.
          <li key={index} className="card routine-item">
            <span className="grow">
              <strong>
                {index + 1}. {exercise.name}
              </strong>
              <span className="muted">{describeExercise(exercise)}</span>
            </span>
            <button
              className="icon"
              aria-label={`Move ${exercise.name} up`}
              disabled={index === 0}
              onClick={() => run(() => core.moveExerciseInRoutine(routineId, index, index - 1))}
            >
              ↑
            </button>
            <button
              className="icon"
              aria-label={`Move ${exercise.name} down`}
              disabled={index === exercises.length - 1}
              onClick={() => run(() => core.moveExerciseInRoutine(routineId, index, index + 1))}
            >
              ↓
            </button>
            <button
              className="icon"
              aria-label={`Remove ${exercise.name} from routine`}
              onClick={() => run(() => core.removeExerciseFromRoutine(routineId, index))}
            >
              ✕
            </button>
          </li>
        ))}
      </ol>

      {available.length > 0 && (
        <>
          <h3>Add to routine</h3>
          {available.map((exercise) => (
            <button
              key={exercise.id}
              className="card list-item"
              onClick={() => run(() => core.addExerciseToRoutine(routineId, exercise.id))}
            >
              <strong>+ {exercise.name}</strong>
              <span className="muted">
                {describeExercise(exercise)}
                {routine.exerciseIds.includes(exercise.id) && " · already in routine, adds it again"}
              </span>
            </button>
          ))}
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
