import { useState } from "react";
import { EXERCISE_TYPE_LABELS, type EndSessionResult, type SessionEntry } from "../core";
import { CompactProgress } from "./CompactProgress";
import { Badge } from "./Badge";
import { useCore } from "./CoreContext";
import { formatKg, formatNumber, formatReps, formatSet, parseNumber } from "./format";
import { Icon } from "./icons";
import { Progress } from "./Progress";
import { SetForm } from "./SetForm";
import { useAction } from "./useAction";

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
        // Keyed by entry, so moving to the next exercise starts fresh (and slides in).
        <CurrentExercise key={current.id} entry={current} />
      ) : (
        <AllDone />
      )}

      {error && <p className="errmsg session-error">{error}</p>}

      {!current && (
        <div className="dock sheet">
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

function CurrentExercise({ entry }: { entry: SessionEntry }) {
  const core = useCore();
  const session = core.activeSession()!;
  const exercise = core.getExercise(entry.exerciseId);
  const weighted = entry.sessionWeight !== undefined;
  const step = core.weightStep(entry.exerciseId);
  const last = core.lastResult(entry.exerciseId);
  const weightChange = core.weightChangeSinceLastTime(entry.exerciseId);
  const upNext = core.upNext();
  const finished = core.finishedEntries();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { error, run } = useAction();
  const editing = editingIndex !== null;

  const nextSetNumber = entry.loggedSets.length + 1;
  const extraSet = nextSetNumber > entry.sets;
  const target = `${entry.sets} × ${entry.repMin}–${entry.repMax} reps`;
  const position = (id: string) => session.entries.findIndex((e) => e.id === id) + 1;

  return (
    <>
      <section className="current">
        <div className="nrow">
          <div>
            <h1 className="ename">{entry.exerciseName}</h1>
            <div className="etype">
              {EXERCISE_TYPE_LABELS[entry.type]}
              {weighted && ` · steps of ${formatKg(step)}`}
            </div>
          </div>
          {core.canSkip() && !editing && (
            <button className="btn sm" onClick={() => run(() => core.skipCurrent())}>
              Skip for now
            </button>
          )}
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

        {!editing &&
          (last ? (
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
          ))}

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
            <div className="sec">Up next</div>
            {upNext.length > 0 ? (
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
            ) : (
              <div className="empty">This is the last one.</div>
            )}
            {finished.length > 0 && (
              <>
                <div className="sec">Finished</div>
                <FinishedList entries={finished} />
              </>
            )}
          </>
        )}

        {error && <p className="errmsg session-error">{error}</p>}
      </section>

      {editing ? (
        <SetForm
          key={`edit-${editingIndex}`}
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
          submitLabel="Log set"
          weighted={weighted}
          initialReps=""
          initialWeight={entry.sessionWeight}
          autoFocus
          onSubmit={(reps, weight) => core.logSet(entry.id, { reps, weight })}
        />
      )}
    </>
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
        <div>
          <div className="hero-t">All exercises done!</div>
          <div className="hero-s">Correct anything below, or end the session.</div>
        </div>
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
          // Sized to the number, so "kg" sits right after it.
          style={{ width: `${Math.max(1, text.length) * 0.6}em` }}
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
