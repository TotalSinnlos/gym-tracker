import { useCore } from "./CoreContext";
import { describeExercise } from "./ExerciseList";
import { useAction } from "./useAction";

interface Props {
  onOpenSettings: () => void;
  onOpenSession: () => void;
}

export function HomeScreen({ onOpenSettings, onOpenSession }: Props) {
  const core = useCore();
  const routine = core.listRoutines()[0];
  const active = core.activeSession();
  const { error, run } = useAction();

  async function start() {
    if (await run(() => core.startSession(routine.id))) onOpenSession();
  }

  return (
    <main className="screen">
      <header className="row header">
        <h1 className="grow">Gym Tracker</h1>
        <button className="secondary" onClick={onOpenSettings}>
          Settings
        </button>
      </header>

      {active ? (
        <button className="primary wide" onClick={onOpenSession}>
          Resume session
        </button>
      ) : (
        routine && (
          <button className="primary wide" onClick={start}>
            Start session
          </button>
        )
      )}
      {error && <p className="error">{error}</p>}

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
    </main>
  );
}
