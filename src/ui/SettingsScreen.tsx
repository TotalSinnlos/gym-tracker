import { BackupSection } from "./BackupSection";
import { ArchivedExercises } from "./ExerciseActions";
import { ExerciseList } from "./ExerciseList";
import { RoutineList } from "./RoutineList";

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="screen">
      <header className="row header">
        <button className="secondary" onClick={onBack}>
          ← Back
        </button>
        <h1 className="grow">Settings</h1>
      </header>

      <section className="stack">
        <h2>Routines</h2>
        <p className="muted">Tap a routine to edit it. Changes apply from your next session.</p>
        <RoutineList />
      </section>

      <section className="stack">
        <h2>Exercises</h2>
        <p className="muted">Tap an exercise to edit, archive or delete it.</p>
        <ExerciseList />
      </section>

      <section className="stack">
        <h2>Archived exercises</h2>
        <ArchivedExercises />
      </section>

      <BackupSection allowRestore />
    </main>
  );
}
