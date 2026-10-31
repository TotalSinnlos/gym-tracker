// Writes trainer summaries in the background: straight after a session, and again later when that
// failed (on coming back to the app, back online, and every so often while it's open). One at a time,
// which keeps well under the AI's free requests per minute. It never interrupts: the cards show how it went.

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import type { Core } from "../core";

/** While the app is open, a waiting summary is tried again this often. */
const RETRY_MS = 15 * 60 * 1000;

interface AutoTrainerState {
  /** The session whose summary is being written right now, or null. */
  writingId: string | null;
  /** Writes (or writes again) one session's summary now. Resolves to an error message, or null when it worked. */
  write: (sessionId: string) => Promise<string | null>;
}

const AutoTrainerContext = createContext<AutoTrainerState>({ writingId: null, write: async () => null });

export const useAutoTrainer = () => useContext(AutoTrainerContext);

export function AutoTrainer({ core, children }: { core: Core; children: ReactNode }) {
  const [writingId, setWritingId] = useState<string | null>(null);
  const busy = useRef(false);
  const writeRef = useRef<AutoTrainerState["write"]>(async () => null);

  useEffect(() => {
    /** Writes one summary, keeping it to one at a time. */
    async function writeOne(sessionId: string): Promise<string | null> {
      if (busy.current) return "Another summary is being written. Try again in a moment";
      busy.current = true;
      setWritingId(sessionId);
      try {
        await core.writeTrainerSummary(sessionId);
        return null;
      } catch (error) {
        // The core remembers the error on a due summary, and the cards show it.
        return error instanceof Error ? error.message : String(error);
      } finally {
        busy.current = false;
        setWritingId(null);
      }
    }
    writeRef.current = writeOne;

    /** Writes the due summaries, oldest first. `onlyNew` skips those that failed before. */
    async function attempt(onlyNew: boolean) {
      if (busy.current || !core.trainer().enabled || document.visibilityState !== "visible") return;
      for (const due of core.trainerDue()) {
        if (onlyNew && due.lastError !== undefined) continue;
        await writeOne(due.sessionId);
        // Offline or the AI busy: the others would fail the same way, so wait for the next try.
        const after = core.trainerDue().find((d) => d.sessionId === due.sessionId);
        if (after?.temporary) return;
      }
    }

    const hasNew = () => core.trainerDue().some((d) => d.lastError === undefined);
    // A session just ended: write its summary straight away.
    const unsubscribe = core.subscribe(() => {
      if (hasNew()) attempt(true);
    });
    const retry = () => attempt(false);
    document.addEventListener("visibilitychange", retry);
    window.addEventListener("online", retry);
    const timer = setInterval(retry, RETRY_MS);
    retry();

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", retry);
      window.removeEventListener("online", retry);
      clearInterval(timer);
    };
  }, [core]);

  const write = (sessionId: string) => writeRef.current(sessionId);
  return <AutoTrainerContext.Provider value={{ writingId, write }}>{children}</AutoTrainerContext.Provider>;
}
