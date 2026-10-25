import { useState } from "react";
import { type Exercise, type RepsPoint, isWeighted } from "../core";
import { Chart, type Series, seriesStyle, toDrawPoints } from "./charts";
import { useCore } from "./CoreContext";
import { useExerciseActions } from "./ExerciseActions";
import { ExerciseEditor, describeExercise } from "./ExerciseList";
import { formatKg, formatNumber, formatShortDate } from "./format";
import { Icon } from "./icons";

/** One line per set number: set 1's reps across sessions, set 2's, and so on. */
function repsSeries(points: RepsPoint[]): Series[] {
  const setCount = Math.max(0, ...points.map((p) => p.reps.length));
  return Array.from({ length: setCount }, (_, set) => ({
    style: set,
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

const month = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short" });
const monthLong = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "long" });

/** "25 sessions · Jul to Oct" */
function sessionsSpan(dates: string[]): string {
  const count = `${dates.length} ${dates.length === 1 ? "session" : "sessions"}`;
  const first = month(dates[0]);
  const last = month(dates[dates.length - 1]);
  return first === last ? `${count} · ${first}` : `${count} · ${first} to ${last}`;
}

/** An exercise's page: its weight and reps graphs and its settings. */
export function ExercisePage({ exerciseId, onBack }: { exerciseId: string; onBack: () => void }) {
  const core = useCore();
  const [editing, setEditing] = useState(false);
  // Gone for a moment after "Delete", before the page closes.
  const exercise = core.getData().exercises.find((e) => e.id === exerciseId);
  if (!exercise) return null;
  if (editing) return <ExerciseEditor exerciseId={exerciseId} onClose={() => setEditing(false)} />;
  return <ExerciseDetails exercise={exercise} onBack={onBack} onEdit={() => setEditing(true)} />;
}

function ExerciseDetails({ exercise, onBack, onEdit }: { exercise: Exercise; onBack: () => void; onEdit: () => void }) {
  const core = useCore();
  // Archived or deleted, the exercise leaves the overview, so go back to it.
  const actions = useExerciseActions(exercise, onBack);
  const history = core.exerciseHistory(exercise.id);
  const dates = history.reps.map((p) => p.date);
  const weightDates = history.weight?.map((p) => p.date) ?? [];
  const reps = repsSeries(history.reps);
  const anyIncomplete = history.reps.some((p) => p.incomplete);
  const lastIncrease = core.lastIncreaseDate(exercise.id);
  const firstWeight = history.weight?.[0];
  const gained = exercise.weight !== undefined && firstWeight ? exercise.weight - firstWeight.value : 0;

  return (
    <main className="screen">
      <div className="top">
        <button className="ib" aria-label="Back to progress" onClick={onBack}>
          <Icon name="back" />
        </button>
      </div>
      <div className="page">
        <div>
          <h1 className="h1">{exercise.name}</h1>
          <div className="page-sub">{describeExercise(exercise)}</div>
        </div>

        {isWeighted(exercise.type) && exercise.weight !== undefined && (
          <div className="g2">
            <div className="tile">
              <div className="tile-l">Current weight</div>
              <div className="tile-v num">
                {formatNumber(exercise.weight)}
                <span> kg</span>
              </div>
            </div>
            {lastIncrease ? (
              <div className="tile tile-up">
                <div className="tile-l">Last increase</div>
                <div className="tile-d">{formatShortDate(lastIncrease, true)}</div>
                {gained > 0 && firstWeight && (
                  <div className="tile-s">
                    +{formatKg(gained)} since {monthLong(firstWeight.date)}
                  </div>
                )}
              </div>
            ) : (
              <div className="tile">
                <div className="tile-l">Last increase</div>
                <div className="tile-none">No increase yet</div>
              </div>
            )}
          </div>
        )}

        {history.reps.length < 2 ? (
          <div className="card chart-card">
            <div className="ct">{history.weight ? "Weight over time" : "Reps per set"}</div>
            <div className="chart-empty">
              <div className="chart-empty-t">
                {history.reps.length === 0 ? "No sessions yet" : "1 session so far"}
              </div>
              <div className="cs">Charts appear after your second session.</div>
            </div>
          </div>
        ) : (
          <>
            {history.weight && history.weight.length > 0 && (
              <section className="card chart-card">
                <div className="ct">Weight over time</div>
                <div className="cs">{sessionsSpan(weightDates)}</div>
                <Chart
                  title={`${exercise.name}: weight per session`}
                  series={[{ style: 0, points: toDrawPoints(history.weight, "kg") }]}
                  count={history.weight.length}
                  xLabel={(i) => formatShortDate(weightDates[i])}
                  yLabel={formatNumber}
                />
                <div className="leg">
                  <span>
                    <i className="leg-dot" /> Done
                  </span>
                  {anyIncomplete && (
                    <span>
                      <i className="leg-dot hollow" /> Incomplete
                    </span>
                  )}
                  <span>
                    <i className="leg-dot latest" /> Latest
                  </span>
                </div>
              </section>
            )}
            <section className="card chart-card">
              <div className="ct">Reps per set</div>
              <div className="cs">
                Shaded band is the target, {exercise.repMin}–{exercise.repMax} reps
              </div>
              <Chart
                title={`${exercise.name}: reps of each set per session`}
                series={reps}
                count={history.reps.length}
                xLabel={(i) => formatShortDate(dates[i])}
                yLabel={String}
                band={{ from: exercise.repMin, to: exercise.repMax }}
              />
              <div className="leg">
                {reps.map((s, i) => (
                  <span key={i}>
                    <svg width="22" height="8" aria-hidden="true">
                      <line
                        x1="1"
                        x2="21"
                        y1="4"
                        y2="4"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        stroke={seriesStyle(s.style).stroke}
                        strokeDasharray={seriesStyle(s.style).dash}
                      />
                    </svg>
                    Set {i + 1}
                  </span>
                ))}
                <span>
                  <i className="leg-band" /> Target range
                </span>
              </div>
            </section>
          </>
        )}

        {anyIncomplete && history.reps.length >= 2 && (
          <p className="note">Hollow points are sessions where the exercise was left incomplete.</p>
        )}

        <div>
          <div className="sec">Settings</div>
          <div className="list">
            <button className="li li-action" onClick={onEdit}>
              <Icon name="edit" />
              <span className="li-m li-t">Edit {exercise.name}</span>
              <span className="chev">
                <Icon name="next" />
              </span>
            </button>
            <button className="li li-action" onClick={() => actions.ask("archive")}>
              <Icon name="archive" />
              <span className="li-m li-t">Archive</span>
            </button>
            {actions.canDelete && (
              <button className="li li-action dng" onClick={() => actions.ask("delete")}>
                <Icon name="trash" />
                <span className="li-m li-t">Delete</span>
              </button>
            )}
          </div>
          {!actions.canDelete && <p className="hint">This exercise has history, so it can be archived but not deleted.</p>}
        </div>
      </div>
      {actions.dialog}
    </main>
  );
}
