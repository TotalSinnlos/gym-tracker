// Automatic server backup: uploads whenever the core says the server is missing changes, and tries
// again later when that fails. It never interrupts: failures are shown in settings and on the summary.

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import type { Core } from "../core";

/** While the app is open, a waiting backup is tried again this often. */
const RETRY_MS = 5 * 60 * 1000;

interface AutoBackupState {
  /** Whether a server backup is being uploaded right now. */
  running: boolean;
  /** Tries a waiting backup now, e.g. when a session has just been saved or on "Try again". */
  tryNow: () => void;
}

const AutoBackupContext = createContext<AutoBackupState>({ running: false, tryNow: () => {} });

export const useAutoBackup = () => useContext(AutoBackupContext);

export function AutoBackup({ core, children }: { core: Core; children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const busy = useRef(false);
  const attemptRef = useRef(() => {});

  useEffect(() => {
    async function attempt() {
      if (busy.current || !core.serverBackup()?.due || document.visibilityState !== "visible") return;
      busy.current = true;
      setRunning(true);
      let succeeded = false;
      try {
        await core.backUpToServer();
        succeeded = true;
      } catch {
        // The core remembers the error; the next attempt comes with the next trigger below.
      } finally {
        busy.current = false;
        setRunning(false);
      }
      // Still due after a success: something changed during the upload, so send that too.
      if (succeeded && core.serverBackup()?.due) attempt();
    }
    attemptRef.current = attempt;

    // A backup becoming due (e.g. history corrected) starts one. Only the change from "not due" to "due"
    // counts, so a failed attempt, which also changes the data, doesn't loop.
    let wasDue = core.serverBackup()?.due ?? false;
    const unsubscribe = core.subscribe(() => {
      const due = core.serverBackup()?.due ?? false;
      if (due && !wasDue) attempt();
      wasDue = due;
    });
    // Coming back to the app, or back online, is a good moment to try again: Tailscale may be on now.
    const onVisible = () => attempt();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    const timer = setInterval(attempt, RETRY_MS);
    attempt();

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      clearInterval(timer);
    };
  }, [core]);

  const tryNow = () => attemptRef.current();
  return <AutoBackupContext.Provider value={{ running, tryNow }}>{children}</AutoBackupContext.Provider>;
}
