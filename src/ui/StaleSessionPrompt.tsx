import { useEffect, useState } from "react";
import type { EndSessionResult } from "../core";
import { useCore } from "./CoreContext";
import { formatDay } from "./format";
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

  return (
    <main className="screen">
      <section className="card center">
        <h2>Finish your session from {formatDay(session.startedAt)}?</h2>
        <p className="muted">{session.routineName} is still running. End it to save it under that day.</p>
      </section>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="secondary" onClick={onContinue}>
          Continue
        </button>
        <button className="primary" onClick={end}>
          End it
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
