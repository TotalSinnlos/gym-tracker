import { isWeighted } from "../core";
import { Sparkline, toDrawPoints } from "./charts";
import { useCore } from "./CoreContext";

/** The small chart next to "Last time" on the session screen: recent weight (or total reps for bodyweight). */
export function CompactProgress({ exerciseId }: { exerciseId: string }) {
  const core = useCore();
  const exercise = core.getExercise(exerciseId);
  const trend = core.exerciseTrend(exerciseId);
  if (trend.length < 2) return null;
  const weighted = isWeighted(exercise.type);
  return (
    <div className="last-chart">
      <Sparkline
        points={toDrawPoints(trend, weighted ? "kg" : "reps")}
        title={`${exercise.name}: ${weighted ? "weight" : "total reps"} over the last ${trend.length} sessions`}
        width={104}
        height={56}
      />
      {!weighted && <span className="last-chart-label">Total reps</span>}
    </div>
  );
}
