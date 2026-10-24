import { isWeighted } from "../core";
import { Chart, SERIES_COLORS, toDrawPoints } from "./charts";
import { useCore } from "./CoreContext";
import { formatNumber, formatShortDate } from "./format";

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
        yLabel={weighted ? formatNumber : String}
        height={120}
      />
    </div>
  );
}
