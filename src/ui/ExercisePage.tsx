import { useState } from "react";
import type { RepsPoint } from "../core";
import { Chart, SERIES_COLORS, type Series, toDrawPoints } from "./charts";
import { useCore } from "./CoreContext";
import { ExerciseActions } from "./ExerciseActions";
import { ExerciseForm } from "./ExerciseForm";
import { describeExercise } from "./ExerciseList";
import { formatKg, formatNumber, formatShortDate, lastIncreaseText } from "./format";

/** One line per set number: set 1's reps across sessions, set 2's, and so on. */
function repsSeries(points: RepsPoint[]): Series[] {
  const setCount = Math.max(0, ...points.map((p) => p.reps.length));
  return Array.from({ length: setCount }, (_, set) => ({
    color: SERIES_COLORS[set % SERIES_COLORS.length],
    points: points.flatMap((p, index) =>
      set < p.reps.length
        ? [
            {
              index,
              value: p.reps[set],
              hollow: p.incomplete,
              label: `${formatShortDate(p.date, true)}, set ${set + 1}: ${p.reps[set]} reps${p.incomplete ? " (incomplete)" : ""}`,
            },
          ]
        : [],
    ),
  }));
}

/** An exercise's page: its weight and reps graphs and its settings. */
export function ExercisePage({ exerciseId, onBack }: { exerciseId: string; onBack: () => void }) {
  const core = useCore();
  const [editing, setEditing] = useState(false);
  const exercise = core.getExercise(exerciseId);
  const history = core.exerciseHistory(exerciseId);
  const dates = history.reps.map((p) => p.date);
  const weightDates = history.weight?.map((p) => p.date) ?? [];
  const reps = repsSeries(history.reps);
  const anyIncomplete = history.reps.some((p) => p.incomplete);
  const increase = lastIncreaseText(exercise, core.lastIncreaseDate(exerciseId));

  return (
    <main className="screen">
      <header className="row header">
        <button className="secondary" onClick={onBack}>
          ← Back
        </button>
        <h1 className="grow">{exercise.name}</h1>
      </header>

      <section className="card">
        <strong>{exercise.weight === undefined ? "Bodyweight" : formatKg(exercise.weight)}</strong>
        {increase && <span className="muted">{increase}</span>}
        <span className="muted">{describeExercise(exercise)}</span>
      </section>

      {history.weight && (
        <section className="stack">
          <h2>Weight (kg)</h2>
          <div className="card">
            <Chart
              title={`${exercise.name}: weight per session`}
              series={[{ color: SERIES_COLORS[0], points: toDrawPoints(history.weight, "kg") }]}
              count={history.weight.length}
              xLabel={(i) => formatShortDate(weightDates[i])}
              yLabel={formatNumber}
            />
          </div>
        </section>
      )}

      <section className="stack">
        <h2>Reps per set</h2>
        <div className="card">
          <Chart
            title={`${exercise.name}: reps of each set per session`}
            series={reps}
            count={history.reps.length}
            xLabel={(i) => formatShortDate(dates[i])}
            yLabel={String}
            band={{ from: exercise.repMin, to: exercise.repMax }}
          />
          {reps.length > 0 && (
            <div className="chart-legend">
              {reps.map((s, i) => (
                <span key={i}>
                  <span className="legend-swatch" style={{ background: s.color }} /> Set {i + 1}
                </span>
              ))}
              <span>
                <span className="legend-swatch band" /> Target {exercise.repMin}–{exercise.repMax}
              </span>
            </div>
          )}
        </div>
      </section>

      {anyIncomplete && <p className="muted">Hollow points are sessions where the exercise was left incomplete.</p>}

      <section className="stack">
        <h2>Settings</h2>
        {editing ? (
          <>
            <ExerciseForm
              initial={exercise}
              submitLabel="Save"
              onSubmit={async (input) => {
                await core.updateExercise(exercise.id, input);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
            {/* Archived or deleted, the exercise leaves the overview, so go back to it. */}
            <ExerciseActions exerciseId={exercise.id} onDone={onBack} />
          </>
        ) : (
          <button className="secondary wide" onClick={() => setEditing(true)}>
            Edit {exercise.name}
          </button>
        )}
      </section>
    </main>
  );
}
