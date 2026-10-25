import { useEffect, useState } from "react";
import type { EndSessionResult } from "../core";
import { useCore } from "./CoreContext";
import { formatDay } from "./format";
import { Logo } from "./Logo";
import { useAction } from "./useAction";

interface Props {
  onEnded: (result: EndSessionResult) => void;
  onContinue: () => void;
}

/** Asked when the app opens on a session that started more than 6 hours ago. */
export function StaleSessionPrompt({ onEnded, onContinue }: Props) {
  const core = useCore();
  const session = core.activeSession();
  const { error, run } = useAction();

  if (!session) return null;

  async function end() {
    let result: EndSessionResult | undefined;
    if (await run(async () => (result = await core.endStaleSession()))) onEnded(result!);
  }

  const started = new Date(session.startedAt);
  return (
    <main className="screen">
      <div className="prompt-logo">
        <Logo size={40} />
      </div>
      <div className="push-down prompt">
        <div className="day" aria-hidden="true">
          <span className="day-w">{started.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</span>
          <span className="day-d">{started.getDate()}</span>
          <span className="day-m">{started.toLocaleDateString("en-GB", { month: "short" })}</span>
        </div>
        <h1 className="prompt-t">Finish your session from {formatDay(session.startedAt)}?</h1>
        <p className="prompt-b">{session.routineName} is still running. End it to save it under that day.</p>
        {error && <p className="errmsg">{error}</p>}
      </div>
      <div className="dock prompt-actions">
        <button className="btn lg pri" onClick={end}>
          End it
        </button>
        <button className="btn lg out" onClick={onContinue}>
          Continue
        </button>
      </div>
    </main>
  );
}

/**
 * Whether to show the prompt. The core decides if the session is stale; this decides when to ask:
 * when the app opens, or comes back to the front after being in the background. Not on every
 * re-render, so it never pops up in the middle of logging sets, and "Continue" keeps it away until
 * the next time the app is opened.
 */
export function useStaleSessionCheck() {
  const core = useCore();
  const [asking, setAsking] = useState(() => core.isSessionStale());

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") setAsking(core.isSessionStale());
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [core]);

  return { asking: asking && core.activeSession() !== null, dismiss: () => setAsking(false) };
}
