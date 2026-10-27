import { type CSSProperties, useState } from "react";
import { EXERCISE_TYPE_LABELS, type EndSessionResult, type SessionEntry } from "../core";
import { CompactProgress } from "./CompactProgress";
import { Badge } from "./Badge";
import { useCore } from "./CoreContext";
import { formatKg, formatNumber, formatReps, formatSet, parseNumber } from "./format";
import { Icon } from "./icons";
import { Progress } from "./Progress";
import { SetForm } from "./SetForm";
import { useAction } from "./useAction";
import { useSwipe } from "./useSwipe";

interface Props {
  onLeave: () => void;
  onEnded: (result: EndSessionResult) => void;
}

export function SessionScreen({ onLeave, onEnded }: Props) {
  const core = useCore();
  const session = core.activeSession();
  const current = core.currentEntry();
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const { error, run } = useAction();
  // Which side an exercise slides in from: the left when flipping back to an earlier one.
  const index = session && current ? session.entries.indexOf(current) : -1;
  const [shown, setShown] = useState({ index, from: "right" });
  if (shown.index !== index) setShown({ index, from: index !== -1 && index < shown.index ? "left" : "right" });

  if (!session) return null;
  const pending = core.pendingCount();
  const notDone = session.entries.filter((e) => e.state === "pending");

  async function end() {
    let result: EndSessionResult | undefined;
    if (await run(async () => (result = await core.endSession()))) onEnded(result!);
  }

  return (
    <main className="screen session">
      <header className="hdr">
        <button className="ib" aria-label="Back to home (the session keeps running)" onClick={onLeave}>
          <Icon name="home" />
        </button>
        <div className="hdr-t num">
          {session.routineName} · {session.entries.length - pending} of {session.entries.length} done
        </div>
        {current ? (
          <button className="btn sm out" onClick={() => (pending > 0 ? setConfirmingEnd(true) : end())}>
            End
          </button>
        ) : (
          <span className="hdr-space" />
        )}
      </header>
      <Progress session={session} />

      {current ? (
        // Keyed by entry, so moving to another exercise starts fresh (and slides in).
        <CurrentExercise key={current.id} entry={current} enterFrom={shown.from} />
      ) : (
        <AllDone />
      )}

      {error && <p className="errmsg session-error">{error}</p>}

      {!current && (
        <div className="dock sheet push-down">
          <button className="btn lg pri" onClick={end}>
            End session
          </button>
        </div>
      )}

      {confirmingEnd && (
        <>
          <div className="scrim" onClick={() => setConfirmingEnd(false)} />
          <div className="dlg" role="alertdialog" aria-labelledby="end-title" aria-describedby="end-body">
            <div className="dlg-t" id="end-title">
              {pending} {pending === 1 ? "exercise" : "exercises"} not done. End anyway?
            </div>
            <div className="dlg-b" id="end-body">
              {joinNames(notDone.map((e) => e.exerciseName))} {pending === 1 ? "is" : "are"} saved as incomplete or skipped.
            </div>
            <button className="btn lg out" onClick={() => setConfirmingEnd(false)}>
              Keep going
            </button>
            <button className="btn lg dark" onClick={end}>
              End session
            </button>
          </div>
        </>
      )}
    </main>
  );
}

/** "A", "A and B", "A, B and C". */
function joinNames(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function CurrentExercise({ entry, enterFrom }: { entry: SessionEntry; enterFrom: string }) {
  const core = useCore();
  const session = core.activeSession()!;
  const exercise = core.getExercise(entry.exerciseId);
  const weighted = entry.sessionWeight !== undefined;
  const step = core.weightStep(entry.exerciseId);
  const last = core.lastResult(entry.exerciseId);
  const weightChange = core.weightChangeSinceLastTime(entry.exerciseId);
  const upNext = core.upNext();
  const finished = core.finishedEntries();
  const { previous, next } = core.neighbourEntries();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // The keyboard stays up between sets, but doesn't pop up when an exercise first appears.
  const [loggedHere, setLoggedHere] = useState(false);
  const { error, run } = useAction();
  const editing = editingIndex !== null;
  const flip = (to: SessionEntry | null) => run(() => (to ? core.goToEntry(to.id) : Promise.resolve()));
  const swipe = useSwipe((direction) => flip(direction === 1 ? next : previous), {
    previous: !editing && previous !== null,
    next: !editing && next !== null,
  });

  const nextSetNumber = entry.loggedSets.length + 1;
  const extraSet = nextSetNumber > entry.sets;
  const target = `${entry.sets} × ${entry.repMin}–${entry.repMax} reps`;
  const position = (id: string) => session.entries.findIndex((e) => e.id === id) + 1;

  return (
    <section
      className={`current swipe from-${enterFrom}${swipe.dragging ? " dragging" : ""}`}
      style={swipe.offset ? { transform: `translateX(${swipe.offset}px)` } : undefined}
      {...swipe.handlers}
    >
      <div className="nrow">
        <div>
          <h1 className="ename">{entry.exerciseName}</h1>
          <div className="etype">
            {EXERCISE_TYPE_LABELS[entry.type]}
            {weighted && ` · steps of ${formatKg(step)}`}
          </div>
        </div>
        <div className="flip">
          <button
            className="ib"
            aria-label={previous ? `Previous exercise: ${previous.exerciseName}` : "Previous exercise"}
            disabled={editing || !previous}
            onClick={() => flip(previous)}
          >
            <Icon name="back" />
          </button>
          <button
            className="ib"
            aria-label={next ? `Next exercise: ${next.exerciseName}` : "Next exercise"}
            disabled={editing || !next}
            onClick={() => flip(next)}
          >
            <Icon name="next" />
          </button>
        </div>
      </div>

      <div className={editing ? "dimmed" : undefined}>
        {weighted ? (
          <>
            <WeightStepper
              key={entry.sessionWeight}
              weight={entry.sessionWeight!}
              step={step}
              onChange={(weight) => run(() => core.setSessionWeight(entry.id, weight))}
            />
            <div className="setrow">
              <div className="setpill num" key={nextSetNumber}>
                {extraSet ? (
                  "Extra set"
                ) : (
                  <>
                    Set {nextSetNumber} <span>of {entry.sets}</span>
                  </>
                )}
              </div>
              <div className="tgt">Target: {target}</div>
            </div>
          </>
        ) : (
          // Bodyweight: no weight to show, so the set number takes the big panel.
          <div className="slab slab-sets">
            <div className="wt num" key={nextSetNumber}>
              {extraSet ? (
                <b>Extra set</b>
              ) : (
                <>
                  <b>Set {nextSetNumber}</b>
                  <span>of {entry.sets}</span>
                </>
              )}
            </div>
            <div className="tgt">
              Target
              <br />
              {target}
            </div>
          </div>
        )}
      </div>

      {editing ? (
        <SetForm
          key={`edit-${editingIndex}`}
          inline
          title={`Correct set ${editingIndex + 1}`}
          submitLabel="Save"
          weighted={weighted}
          initialReps={String(entry.loggedSets[editingIndex].reps)}
          initialWeight={entry.loggedSets[editingIndex].weight}
          autoFocus
          onSubmit={async (reps, weight) => {
            await core.editSet(entry.id, editingIndex, { reps, weight });
            setEditingIndex(null);
          }}
          onCancel={() => setEditingIndex(null)}
        />
      ) : (
        <SetForm
          // Re-created after each set and whenever the session weight changes, so the weight field follows it.
          key={`${entry.loggedSets.length}-${entry.sessionWeight}`}
          inline
          submitLabel="Log set"
          weighted={weighted}
          initialReps=""
          initialWeight={entry.sessionWeight}
          autoFocus={loggedHere}
          onSubmit={(reps, weight) => {
            // Before logging, so the fresh form that replaces this one already takes the focus.
            setLoggedHere(true);
            return core.logSet(entry.id, { reps, weight });
          }}
        />
      )}

      {error && <p className="errmsg session-error">{error}</p>}

      {entry.loggedSets.length > 0 && (
        <>
          <div className="sec">Logged</div>
          <ol className="logged-list">
            {entry.loggedSets.map((set, index) => (
              <li key={index} className={editingIndex === index ? "logged on" : "logged"}>
                <button className="logged-open" disabled={editing} onClick={() => setEditingIndex(index)}>
                  <span className="k">Set {index + 1}</span>
                  <span className="v num">{formatSet(set)}</span>
                </button>
                {editingIndex === index ? (
                  <span className="e">Editing</span>
                ) : (
                  !editing && (
                    <button
                      className="ib plain"
                      aria-label={`Remove set ${index + 1}`}
                      onClick={() => run(() => core.removeSet(entry.id, index))}
                    >
                      <Icon name="close" />
                    </button>
                  )
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      {!editing && (
        <>
          {last ? (
            <div className="last">
              <div className="last-m">
                <div className="lab">Last time</div>
                <div className="last-v num">{last.entry.loggedSets.map(formatSet).join(", ")}</div>
                {weightChange !== null && weightChange > 0 && (
                  <div className="chip">↑ +{formatKg(weightChange)} since last time</div>
                )}
              </div>
              <CompactProgress exerciseId={exercise.id} />
            </div>
          ) : (
            <div className="first">
              <Icon name="star" />
              <span>
                <b>First time for this one.</b> <span className="mut">Nothing to compare with yet.</span>
              </span>
            </div>
          )}

          {upNext.length > 0 && (
            <>
              <div className="sec">Up next</div>
              <div className="list">
                {upNext.map((next) => {
                  const partly = next.loggedSets.length > 0;
                  return (
                    <button key={next.id} className="li" onClick={() => run(() => core.goToEntry(next.id))}>
                      <span className={partly ? "nx part" : "nx"}>{partly ? "½" : position(next.id)}</span>
                      <span className="li-m">
                        <span className="li-t">{next.exerciseName}</span>
                        <span className={partly ? "li-s part" : "li-s"}>
                          {partly
                            ? `${next.loggedSets.length} of ${next.sets} sets logged · tap to continue`
                            : "Tap to do this now"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {finished.length > 0 && (
            <>
              <div className="sec">Finished</div>
              <FinishedList entries={finished} />
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Finished exercises, each tappable to reopen and correct it. `withWeight` adds the weight instead of the hint. */
function FinishedList({ entries, withWeight = false }: { entries: SessionEntry[]; withWeight?: boolean }) {
  const core = useCore();
  const { run } = useAction();
  return (
    <div className="list">
      {entries.map((entry) => (
        <button key={entry.id} className="li" onClick={() => run(() => core.goToEntry(entry.id))}>
          <span className="st">
            <Icon name="check" size="s" />
          </span>
          <span className="li-m">
            <span className="li-t">{entry.exerciseName}</span>
            <span className="li-s num">
              {formatReps(entry)} reps ·{" "}
              {withWeight
                ? entry.sessionWeight === undefined
                  ? "bodyweight"
                  : formatKg(entry.sessionWeight)
                : "tap to correct"}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function AllDone() {
  const core = useCore();
  return (
    <section className="current">
      <div className="hero">
        <Badge />
        <div className="hero-t">All exercises done!</div>
      </div>
      <div className="sec">Finished · tap one to correct it</div>
      <FinishedList entries={core.finishedEntries()} withWeight />
    </section>
  );
}

function WeightStepper({ weight, step, onChange }: { weight: number; step: number; onChange: (kg: number) => void }) {
  const [text, setText] = useState(formatNumber(weight));

  function commit(value: number) {
    if (Number.isFinite(value) && value !== weight) onChange(value);
    else setText(formatNumber(weight));
  }

  return (
    <div className="slab">
      <button
        className="ib big"
        aria-label={`Lower weight by ${formatKg(step)}`}
        disabled={weight - step < 0}
        onClick={() => onChange(weight - step)}
      >
        <Icon name="minus" size="l" />
      </button>
      <label className="wt">
        <span className="visually-hidden">Session weight (kg)</span>
        <input
          inputMode="decimal"
          className="wt-in num"
          // Its length sets the font size (see .wt-in), so long weights like "102.5" still fit.
          style={{ "--chars": Math.max(2, text.length) } as CSSProperties}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={() => commit(parseNumber(text))}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <span>kg</span>
      </label>
      <button className="ib big" aria-label={`Raise weight by ${formatKg(step)}`} onClick={() => onChange(weight + step)}>
        <Icon name="plus" size="l" />
      </button>
    </div>
  );
}
