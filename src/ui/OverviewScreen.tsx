import { isWeighted } from "../core";
import { MainArea } from "./BottomNav";
import { Sparkline, toDrawPoints } from "./charts";
import { useCore } from "./CoreContext";
import { formatNumber, lastIncreaseText } from "./format";
import { Icon } from "./icons";

/** Every active exercise with its current weight, last increase and trend line. */
export function OverviewScreen({ onOpenExercise }: { onOpenExercise: (id: string) => void }) {
  const core = useCore();
  const rows = core.overview();

  return (
    <MainArea area="overview">
      <div className="page area">
        <div>
          <h1 className="h1">Progress</h1>
          {rows.length > 0 && (
            <p className="page-intro">
              The last 10 sessions: weight, or total reps for bodyweight.
            </p>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="nothing area-empty">
            <Icon name="progress" />
            <h2 className="nothing-t">No exercises yet.</h2>
            <p className="body mut">Add some in settings and your trends will show up here.</p>
          </div>
        ) : (
          <div className="list">
            {rows.map(({ exercise, lastIncrease, trend }) => {
              const increase = lastIncreaseText(exercise, lastIncrease);
              return (
                <button key={exercise.id} className="li progress-row" onClick={() => onOpenExercise(exercise.id)}>
                  <span className="li-m">
                    <span className="li-t">{exercise.name}</span>
                    {exercise.weight === undefined ? (
                      <span className="li-w bw">Bodyweight</span>
                    ) : (
                      <span className="li-w num">{formatNumber(exercise.weight)} kg</span>
                    )}
                    {increase && <span className="li-s">{increase}</span>}
                  </span>
                  <Sparkline
                    title={`${exercise.name}: trend over the last ${trend.length} sessions`}
                    points={toDrawPoints(trend, isWeighted(exercise.type) ? "kg" : "reps")}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </MainArea>
  );
}
