import { Sparkline } from "./charts";
import { useCore } from "./CoreContext";
import { lastIncreaseText } from "./ExercisePage";
import { formatKg } from "./format";

/** Every active exercise with its current weight, last increase and trend line. */
export function OverviewScreen({ onBack, onOpenExercise }: { onBack: () => void; onOpenExercise: (id: string) => void }) {
  const core = useCore();
  const rows = core.overview();

  return (
    <main className="screen">
      <header className="row header">
        <button className="secondary" onClick={onBack}>
          ← Home
        </button>
        <h1 className="grow">Progress</h1>
      </header>

      {rows.length === 0 && <p className="muted">No exercises yet.</p>}
      {rows.map(({ exercise, lastIncrease, trend }) => (
        <button key={exercise.id} className="card list-item overview-row" onClick={() => onOpenExercise(exercise.id)}>
          <span className="grow stack-tight">
            <strong>{exercise.name}</strong>
            <span>{exercise.weight === undefined ? "Bodyweight" : formatKg(exercise.weight)}</span>
            {lastIncreaseText(exercise, lastIncrease) && <span className="muted">{lastIncreaseText(exercise, lastIncrease)}</span>}
          </span>
          <Sparkline
            title={`${exercise.name}: trend over the last ${trend.length} sessions`}
            points={trend.map((p, index) => ({ index, value: p.value, hollow: p.incomplete, label: "" }))}
          />
        </button>
      ))}
      <p className="muted">Trend: weight per session (total reps for bodyweight). Tap an exercise for its graphs.</p>
    </main>
  );
}
