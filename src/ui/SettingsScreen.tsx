import { useCore } from "./CoreContext";
import { ExerciseList } from "./ExerciseList";
import { RoutineEditor } from "./RoutineEditor";

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const core = useCore();
  const routine = core.listRoutines()[0];

  return (
    <main className="screen">
      <header className="row header">
        <button className="secondary" onClick={onBack}>
          ← Back
        </button>
        <h1 className="grow">Settings</h1>
      </header>

      {routine && (
        <section className="stack">
          <h2>Routine</h2>
          <RoutineEditor routineId={routine.id} />
        </section>
      )}

      <section className="stack">
        <h2>Exercises</h2>
        <p className="muted">Tap an exercise to edit it.</p>
        <ExerciseList />
      </section>
    </main>
  );
}
