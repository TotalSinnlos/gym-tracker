import { useEffect } from "react";
import type { EndSessionResult, ProgressionSummary, SessionEntry } from "../core";
import { Badge } from "./Badge";
import { BackupSection } from "./BackupSection";
import { useCore } from "./CoreContext";
import { formatDayShort, formatEntryWeight, formatKg, formatNumber, formatReps, STATE_LABELS } from "./format";
import { Icon } from "./icons";
import { StateMark } from "./StateMark";
import { useAction } from "./useAction";

export function SummaryScreen({ result, onDone }: { result: EndSessionResult; onDone: () => void }) {
  const doneButton = (
    <div className="dock">
      <button className={result.session ? "btn lg pri" : "btn lg"} onClick={onDone}>
        Done
      </button>
    </div>
  );

  if (!result.session) {
    return (
      <main className="screen">
        <div className="discarded push-down">
          <div className="discarded-icon" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="5" width="16" height="15" rx="4" />
              <path d="M9 10.5h6M9 14.5h3" />
            </svg>
          </div>
          <h1 className="h1">Session discarded</h1>
          <p className="prompt-b">Nothing was logged, so there was nothing to save.</p>
        </div>
        <div className="push-down" />
        {doneButton}
      </main>
    );
  }

  const { session, summary } = result;
  const done = session.entries.filter((e) => e.state === "done").length;
  const special = summary.increases.length + summary.repRangeBeaten.length + summary.belowRange.length > 0;

  return (
    <main className="screen">
      <div className="summary">
        <div>
          <h1 className="h1">Session saved</h1>
          <div className="summary-sub num">
            {formatDayShort(session.startedAt)} · {session.routineName} · {done} of {session.entries.length}{" "}
            done
          </div>
        </div>
        {special ? (
          <Progression sessionId={session.id} summary={summary} />
        ) : (
          <div className="steady">
            <b>Steady session.</b>{" "}
            <span className="mut">Same weights next time. Beat every set by a rep and they go up.</span>
          </div>
        )}
        {special && <div className="sec tight">Exercises</div>}
        <div className="list">
          {session.entries.map((entry) => (
            <SummaryRow key={entry.id} entry={entry} />
          ))}
        </div>
        <BackupSection />
      </div>
      {doneButton}
    </main>
  );
}

function SummaryRow({ entry }: { entry: SessionEntry }) {
  const skipped = entry.state === "skipped";
  return (
    <div className="li">
      <StateMark state={entry.state} />
      <span className="li-m">
        <span className={skipped ? "li-t mut" : "li-t"}>{entry.exerciseName}</span>
        <span className="li-s num">
          {STATE_LABELS[entry.state]}
          {entry.loggedSets.length > 0 &&
            ` · ${entry.sessionWeight === undefined ? "" : `${formatEntryWeight(entry)} · `}${formatReps(entry)} reps`}
        </span>
      </span>
    </div>
  );
}

/** Increases, bodyweight "rep range beaten" and below-range exercises, with the "lower weight" button. */
function Progression({ sessionId, summary }: { sessionId: string; summary: ProgressionSummary }) {
  const core = useCore();
  const { error, run } = useAction();
  const { increases, repRangeBeaten, belowRange } = summary;

  // One short haptic tick for a weight going up, where the phone supports it.
  useEffect(() => {
    if (increases.length > 0) navigator.vibrate?.(12);
  }, [increases.length]);

  return (
    <>
      {increases.length > 0 && (
        <section className="reward">
          <div className="reward-head">
            <Badge size={56} mark="up" />
            <div>
              <div className="reward-t">Weight goes up</div>
              <div className="reward-s">
                You earned it on {increases.length} {increases.length === 1 ? "exercise" : "exercises"}
              </div>
            </div>
          </div>
          {increases.map((item, i) => (
            <div key={item.exerciseId} className="up" style={{ animationDelay: `${150 + i * 60}ms` }}>
              <div>
                <div className="up-n">{item.name}</div>
                <div className="up-s">next time</div>
              </div>
              <div className="up-v num">
                <span className="o">{formatNumber(item.fromKg)}</span>
                <span className="a">→</span>
                <b>{formatNumber(item.toKg)}</b>
                <span className="u">kg</span>
              </div>
            </div>
          ))}
        </section>
      )}
      {repRangeBeaten.map((item) => (
        <div key={item.exerciseId} className="card beaten">
          <span className="badge">
            <Icon name="star" />
          </span>
          <div>
            <div className="beaten-t">{item.name}: rep range beaten</div>
            <div className="beaten-s">Time for a harder variation?</div>
          </div>
        </div>
      ))}
      {belowRange.map((item) => (
        <div key={item.entryId} className="below">
          <div className="below-head">
            <span className="badge">
              <Icon name="arrowDown" />
            </span>
            <div className="below-t">{item.name}: a set was below the rep range.</div>
          </div>
          {item.lowerToKg !== undefined &&
            (core.wasLowered(sessionId, item.entryId) ? (
              <div className="lowered">
                <Icon name="check" size="s" />
                Lowered to {formatKg(item.lowerToKg)} for next time.
              </div>
            ) : (
              <button
                className="btn sm white"
                onClick={() => run(() => core.lowerWeightAfterSession(sessionId, item.entryId))}
              >
                Lower to {formatKg(item.lowerToKg)} next time?
              </button>
            ))}
        </div>
      ))}
      {error && <p className="errmsg">{error}</p>}
    </>
  );
}
