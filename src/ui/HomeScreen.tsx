import { useCore } from "./CoreContext";
import { describeExercise } from "./ExerciseList";
import { useAction } from "./useAction";

interface Props {
  onOpenSettings: () => void;
  onOpenSession: () => void;
}

export function HomeScreen({ onOpenSettings, onOpenSession }: Props) {
  const core = useCore();
  const routines = core.startableRoutines();
  const active = core.activeSession();
  const { error, run } = useAction();

  async function start(routineId: string) {
    if (await run(() => core.startSession(routineId))) onOpenSession();
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
        routines.length === 1 && (
          <button className="primary wide" onClick={() => start(routines[0].id)}>
            Start session
          </button>
        )
      )}
      {error && <p className="error">{error}</p>}

      {routines.length === 0 && <p className="muted">Add exercises to a routine in settings to start a session.</p>}

      {routines.length === 1 && (
        <section className="stack">
          <h2>{routines[0].name}</h2>
          <ol className="stack routine-list">
            {core.routineExercises(routines[0].id).map((exercise, index) => (
              // The same exercise can appear twice, so its position is the key.
              <li key={index} className="card">
                <strong>
                  {index + 1}. {exercise.name}
                </strong>
                <span className="muted">{describeExercise(exercise)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!active && routines.length > 1 && (
        <section className="stack">
          <h2>Start a session</h2>
          <p className="muted">Pick a routine.</p>
          {routines.map((routine) => (
            <button key={routine.id} className="card list-item" onClick={() => start(routine.id)}>
              <strong>{routine.name}</strong>
              <span className="muted">
                {core
                  .routineExercises(routine.id)
                  .map((e) => e.name)
                  .join(" · ")}
              </span>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
