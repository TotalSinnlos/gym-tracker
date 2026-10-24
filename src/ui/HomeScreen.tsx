import { useCore } from "./CoreContext";
import { describeExercise } from "./ExerciseList";

export function HomeScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const core = useCore();
  const routine = core.listRoutines()[0];

  return (
    <main className="screen">
      <header className="row header">
        <h1 className="grow">Gym Tracker</h1>
        <button className="secondary" onClick={onOpenSettings}>
          Settings
        </button>
      </header>

      {routine && (
        <section className="stack">
          <h2>{routine.name}</h2>
          <ol className="stack routine-list">
            {core.routineExercises(routine.id).map((exercise, index) => (
              <li key={exercise.id} className="card">
                <strong>
                  {index + 1}. {exercise.name}
                </strong>
                <span className="muted">{describeExercise(exercise)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <button className="primary wide" disabled>
        Start session
      </button>
      <p className="muted center">Sessions arrive in the next update.</p>
    </main>
  );
}
