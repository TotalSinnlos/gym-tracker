import { useState } from "react";
import { useCore } from "./CoreContext";
import { describeExercise } from "./ExerciseList";
import { Icon } from "./icons";
import { useAction } from "./useAction";

/**
 * Rename a routine, put its exercises in order, and add or remove exercises. `detailed` (in setup) shows
 * each exercise's weight and sets; `withName` adds the name field.
 */
export function RoutineEditor({ routineId, detailed = false, withName = true }: { routineId: string; detailed?: boolean; withName?: boolean }) {
  const core = useCore();
  const routine = core.getRoutine(routineId);
  const exercises = core.routineExercises(routineId);
  const available = core.listExercises();
  const [name, setName] = useState(routine.name);
  const { error, run } = useAction();

  return (
    <>
      {withName && (
        <label className="fld">
          Name
          <input
            className="in"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== routine.name && run(() => core.renameRoutine(routineId, name))}
          />
        </label>
      )}

      <div className="sec">{detailed ? "Routine" : "Exercises, in order"}</div>
      {exercises.length === 0 ? (
        <div className="empty">No exercises yet. Add some from the list below.</div>
      ) : (
        <ol className="list">
          {exercises.map((exercise, index) => (
            // The same exercise can appear twice, so its position is the key.
            <li key={index} className="li routine-row">
              <span className="n num">{index + 1}</span>
              <span className="li-m">
                <span className="li-t">{exercise.name}</span>
                {detailed && <span className="li-s">{describeExercise(exercise)}</span>}
              </span>
              <span className="acts">
                <button
                  className="ib plain"
                  aria-label={`Move ${exercise.name} up`}
                  disabled={index === 0}
                  onClick={() => run(() => core.moveExerciseInRoutine(routineId, index, index - 1))}
                >
                  <Icon name="up" />
                </button>
                <button
                  className="ib plain"
                  aria-label={`Move ${exercise.name} down`}
                  disabled={index === exercises.length - 1}
                  onClick={() => run(() => core.moveExerciseInRoutine(routineId, index, index + 1))}
                >
                  <Icon name="down" />
                </button>
                <button
                  className="ib plain"
                  aria-label={`Remove ${exercise.name} from routine`}
                  onClick={() => run(() => core.removeExerciseFromRoutine(routineId, index))}
                >
                  <Icon name="close" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {available.length > 0 && (
        <>
          <div className="sec">Tap to add</div>
          <div className="list">
            {available.map((exercise) => {
              const again = routine.exerciseIds.includes(exercise.id);
              return (
                <button
                  key={exercise.id}
                  className="li add-row"
                  onClick={() => run(() => core.addExerciseToRoutine(routineId, exercise.id))}
                >
                  <span className={again ? "add again" : "add"}>
                    <Icon name="plus" />
                  </span>
                  <span className="li-m">
                    <span className="li-t">{exercise.name}</span>
                    {again && <span className="li-s again-t">Already in routine, adds it again</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {error && (
        <p className="errmsg section-msg">
          <Icon name="error" />
          {error}
        </p>
      )}
    </>
  );
}
