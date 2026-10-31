import { useState } from "react";
import type { Session, SessionEntry } from "../core";
import { MainArea } from "./BottomNav";
import { useCore } from "./CoreContext";
import { STATE_LABELS, formatDate, formatKg, formatSet } from "./format";
import { Icon } from "./icons";
import { SetForm } from "./SetForm";
import { TrainerCard } from "./TrainerCard";
import { useAction } from "./useAction";

const doneCount = (session: Session) => session.entries.filter((e) => e.state === "done").length;

/** "October", or "October 2025" for another year. */
function monthHeading(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-GB", { month: "long", ...(!sameYear && { year: "numeric" }) });
}

/** Past sessions, newest first, by month. Tapping one opens it to review, correct or delete it. */
export function HistoryScreen() {
  const core = useCore();
  const [openId, setOpenId] = useState<string | null>(null);
  const sessions = core.listSessions();
  const open = sessions.find((s) => s.id === openId);

  if (open) return <SessionDetail session={open} onBack={() => setOpenId(null)} />;

  const months: { heading: string; sessions: Session[] }[] = [];
  for (const session of sessions) {
    const heading = monthHeading(session.startedAt);
    if (months.at(-1)?.heading !== heading) months.push({ heading, sessions: [] });
    months.at(-1)!.sessions.push(session);
  }

  return (
    <MainArea area="history">
      <div className="page area">
        <div>
          <h1 className="h1">History</h1>
          {sessions.length > 0 && (
            <div className="page-sub num">
              {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
            </div>
          )}
        </div>
        {sessions.length === 0 ? (
          <div className="nothing area-empty">
            <div className="ghost-days" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h2 className="nothing-t">No sessions yet.</h2>
            <p className="body mut">They'll appear here once you end one.</p>
          </div>
        ) : (
          months.map((month) => (
            <div key={month.heading}>
              <div className="sec">{month.heading}</div>
              <div className="list">
                {month.sessions.map((session) => {
                  const date = new Date(session.startedAt);
                  return (
                    <button key={session.id} className="li history-row" onClick={() => setOpenId(session.id)}>
                      <span className="d" aria-hidden="true">
                        <b className="num">{date.getDate()}</b>
                        <span>{date.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</span>
                      </span>
                      <span className="li-m">
                        <span className="li-t">{formatDate(session.startedAt)}</span>
                        <span className="li-s">
                          {session.routineName} · {doneCount(session)} of {session.entries.length} done
                        </span>
                        <span className="dots" aria-hidden="true">
                          {session.entries.map((entry) => (
                            <i
                              key={entry.id}
                              className={entry.state === "incomplete" ? "h" : entry.state === "skipped" ? "s" : undefined}
                            />
                          ))}
                        </span>
                      </span>
                      <span className="chev">
                        <Icon name="next" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </MainArea>
  );
}

function SessionDetail({ session, onBack }: { session: Session; onBack: () => void }) {
  const core = useCore();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState<{ entry: SessionEntry; index: number } | null>(null);
  const { error, run } = useAction();
  const locked = !core.canEditHistory();
  const increased = core.increasedEntryIds(session.id);

  async function remove() {
    if (await run(() => core.deleteSession(session.id))) onBack();
  }

  return (
    <main className="screen">
      <div className="top">
        <button className="ib" aria-label="Back to history" onClick={onBack}>
          <Icon name="back" />
        </button>
      </div>
      <div className="page detail">
        <div>
          <h1 className="detail-t">{formatDate(session.startedAt)}</h1>
          <div className="detail-sub">
            {session.routineName} · {doneCount(session)} of {session.entries.length} done
            {!locked && " · tap a set to correct it"}
          </div>
        </div>

        {locked && (
          <div className="banner" role="status">
            <Icon name="lock" />
            <span>A session is running. You can correct or delete past sessions once it has ended.</span>
          </div>
        )}

        {session.entries.map((entry) => (
          <div key={entry.id} className={increased.includes(entry.id) ? "ex raised" : "ex"}>
            <div className="exh">
              <b className={entry.state === "skipped" ? "mut" : undefined}>{entry.exerciseName}</b>
              {increased.includes(entry.id) && <span className="tag raised">↑ Weight up</span>}
              <StateTag state={entry.state} />
            </div>
            {entry.loggedSets.map((set, index) => {
              const on = editing?.entry === entry && editing.index === index;
              return (
                <button
                  key={index}
                  className={on ? "set on" : "set"}
                  disabled={locked || editing !== null}
                  onClick={() => setEditing({ entry, index })}
                >
                  <span className="k">Set {index + 1}</span>
                  <span className="v num">{formatSet(set)}</span>
                </button>
              );
            })}
          </div>
        ))}

        <TrainerCard sessionId={session.id} inHistory />

        {error && <p className="errmsg">{error}</p>}
      </div>

      {!locked && !editing && (
        <div className="dock">
          <button className="btn dngo w" onClick={() => setConfirmingDelete(true)}>
            <Icon name="trash" />
            Delete session
          </button>
        </div>
      )}

      {editing && (
        <CorrectSet
          sessionId={session.id}
          entry={editing.entry}
          index={editing.index}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmingDelete && (
        <>
          <div className="scrim" onClick={() => setConfirmingDelete(false)} />
          <div className="dlg" role="alertdialog" aria-labelledby="delete-title">
            <div className="dlg-t" id="delete-title">
              Delete this session?
            </div>
            <div className="dlg-b">
              Its sets are removed. Weights it changed go back to what they were before.
            </div>
            <button className="btn lg out" onClick={() => setConfirmingDelete(false)}>
              Keep it
            </button>
            <button className="btn lg dng" onClick={remove}>
              Delete session
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function StateTag({ state }: { state: SessionEntry["state"] }) {
  if (state === "skipped") return <span className="tag skip">– {STATE_LABELS.skipped}</span>;
  if (state === "incomplete") return <span className="tag inc">◐ {STATE_LABELS.incomplete}</span>;
  return (
    <span className="tag done">
      <Icon name="check" size="s" />
      {STATE_LABELS[state]}
    </span>
  );
}

/** The sheet for correcting one set of a past session. */
function CorrectSet({ sessionId, entry, index, onClose }: { sessionId: string; entry: SessionEntry; index: number; onClose: () => void }) {
  const core = useCore();
  const set = entry.loggedSets[index];
  const recalculates = core.editRecalculatesWeight(sessionId, entry.id);
  const currentWeight = core.getData().exercises.find((e) => e.id === entry.exerciseId)?.weight;

  return (
    <SetForm
      key={`${entry.id}-${index}`}
      title={`Correct ${entry.exerciseName}, set ${index + 1}`}
      submitLabel="Save"
      weighted={entry.sessionWeight !== undefined}
      initialReps={String(set.reps)}
      initialWeight={set.weight}
      autoFocus
      onSubmit={async (reps, weight) => {
        await core.editPastSet(sessionId, entry.id, index, { reps, weight });
        onClose();
      }}
      onCancel={onClose}
      note={
        recalculates &&
        currentWeight !== undefined && (
          <>
            This is {entry.exerciseName}'s latest result, so saving also updates its current weight (now{" "}
            {formatKg(currentWeight)}).
          </>
        )
      }
    />
  );
}
