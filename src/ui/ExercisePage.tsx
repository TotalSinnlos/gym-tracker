import { type ChartPoint, type Exercise, type RepsPoint, isWeighted } from "../core";
import { Chart, type DrawPoint, SERIES_COLORS, type Series, formatShortDate } from "./charts";
import { useCore } from "./CoreContext";
import { describeExercise } from "./ExerciseList";
import { formatKg } from "./format";

const kgLabel = (kg: number) => kg.toLocaleString("en", { maximumFractionDigits: 2 });

/** Points for a one-line chart: a session's weight, or its total reps. */
function toDrawPoints(points: ChartPoint[], unit: string): DrawPoint[] {
  return points.map((p, index) => ({
    index,
    value: p.value,
    hollow: p.incomplete,
    label: `${formatShortDate(p.date, true)}: ${kgLabel(p.value)} ${unit}${p.incomplete ? " (incomplete)" : ""}`,
  }));
}

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

export function lastIncreaseText(exercise: Exercise, lastIncrease: string | null) {
  if (!isWeighted(exercise.type)) return null;
  return lastIncrease ? `Last increase: ${formatShortDate(lastIncrease, true)}` : "No increase yet";
}

/** An exercise's page: its weight and reps graphs and its settings. */
export function ExercisePage({ exerciseId, onBack }: { exerciseId: string; onBack: () => void }) {
  const core = useCore();
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
              yLabel={kgLabel}
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
    </main>
  );
}

/** The compact chart on the session screen: the exercise's recent weight (or total reps for bodyweight). */
export function CompactProgress({ exerciseId }: { exerciseId: string }) {
  const core = useCore();
  const exercise = core.getExercise(exerciseId);
  const trend = core.exerciseTrend(exerciseId);
  if (trend.length === 0) return null;
  const weighted = isWeighted(exercise.type);
  return (
    <div className="compact-chart">
      <span className="muted">
        {weighted ? "Weight" : "Total reps"}, last {trend.length} {trend.length === 1 ? "session" : "sessions"}
      </span>
      <Chart
        title={`${exercise.name}: recent ${weighted ? "weight" : "total reps"}`}
        series={[{ color: SERIES_COLORS[0], points: toDrawPoints(trend, weighted ? "kg" : "reps") }]}
        count={trend.length}
        xLabel={(i) => formatShortDate(trend[i].date)}
        yLabel={weighted ? kgLabel : String}
        height={120}
      />
    </div>
  );
}
